const { validateDomainEvent } = require('./domainEvent');

function sleep(ms) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class DomainEventBus {
  constructor({
    middleware = [],
    metricsSink = null,
    deadLetterSink = null,
    logger = null,
    maxQueueDepth = 10000
  } = {}) {
    this.middleware = [...middleware];
    this.metricsSink = metricsSink;
    this.deadLetterSink = deadLetterSink;
    this.logger = logger;
    this.maxQueueDepth = maxQueueDepth;
    this.subscribers = new Map();
    this.aggregateChains = new Map();
    this.metrics = {
      publishedEvents: 0,
      subscriberLatency: {},
      subscriberFailures: 0,
      queueDepth: 0,
      droppedEvents: 0,
      dispatchTime: 0,
      retryCount: 0
    };
  }

  use(middleware) {
    this.middleware.push(middleware);
  }

  subscribe(subscriber) {
    if (this.subscribers.has(subscriber.id)) {
      throw new Error(`Duplicate domain event subscriber: ${subscriber.id}`);
    }
    this.subscribers.set(subscriber.id, subscriber);
    return () => this.unsubscribe(subscriber.id);
  }

  unsubscribe(subscriberId) {
    return this.subscribers.delete(subscriberId);
  }

  async initialize() {
    for (const subscriber of this.subscribers.values()) {
      await subscriber.initialize();
    }
  }

  async publish(event, publishContext = {}) {
    const validation = validateDomainEvent(event);
    if (!validation.valid) {
      this.metrics.droppedEvents += 1;
      throw new Error(`Invalid domain event: ${validation.errors.join(', ')}`);
    }

    if (this.metrics.queueDepth >= this.maxQueueDepth) {
      this.metrics.droppedEvents += 1;
      const error = new Error('Domain event bus backpressure limit exceeded');
      error.code = 'DOMAIN_EVENT_BACKPRESSURE';
      throw error;
    }

    const aggregateKey = `${event.aggregateType}:${event.aggregateId}`;
    this.metrics.queueDepth += 1;
    const previous = this.aggregateChains.get(aggregateKey) || Promise.resolve();
    const dispatch = previous
      .catch(() => {})
      .then(() => this.dispatch(event, publishContext))
      .finally(() => {
        this.metrics.queueDepth = Math.max(0, this.metrics.queueDepth - 1);
        if (this.aggregateChains.get(aggregateKey) === dispatch) {
          this.aggregateChains.delete(aggregateKey);
        }
      });
    this.aggregateChains.set(aggregateKey, dispatch);
    return dispatch;
  }

  async dispatch(event, publishContext) {
    const startedAt = Date.now();
    let currentEvent = event;
    const context = {
      ...publishContext,
      eventBus: this,
      metrics: this.metrics
    };

    for (const middleware of this.middleware) {
      const nextEvent = await middleware(currentEvent, context);
      if (nextEvent === null) {
        this.metrics.droppedEvents += 1;
        return { event: currentEvent, subscriberResults: [], dropped: true };
      }
      currentEvent = nextEvent || currentEvent;
    }

    const matchedSubscribers = [...this.subscribers.values()]
      .filter((subscriber) => subscriber.supports(currentEvent))
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));

    const subscriberResults = [];
    for (const subscriber of matchedSubscribers) {
      subscriberResults.push(await this.dispatchToSubscriber(subscriber, currentEvent, context));
    }

    this.metrics.publishedEvents += 1;
    this.metrics.dispatchTime += Date.now() - startedAt;
    await Promise.resolve(
      this.metricsSink?.recordPublish?.({ event: currentEvent, subscriberResults, durationMs: Date.now() - startedAt })
    ).catch(() => {});
    return { event: currentEvent, subscriberResults, dropped: false };
  }

  async dispatchToSubscriber(subscriber, event, context) {
    const startedAt = Date.now();
    let attempt = 0;
    let lastError = null;

    while (attempt < subscriber.retry.maxAttempts) {
      attempt += 1;
      try {
        await subscriber.handle(event, context);
        const latency = Date.now() - startedAt;
        this.metrics.subscriberLatency[subscriber.id] = latency;
        return { subscriberId: subscriber.id, status: 'fulfilled', attempts: attempt, latencyMs: latency };
      } catch (error) {
        lastError = error;
        this.metrics.retryCount += attempt < subscriber.retry.maxAttempts ? 1 : 0;
        if (attempt < subscriber.retry.maxAttempts) {
          await sleep(subscriber.retry.baseDelayMs * attempt);
        }
      }
    }

    this.metrics.subscriberFailures += 1;
    const failure = {
      subscriberId: subscriber.id,
      eventId: event.eventId,
      eventType: event.eventType,
      errorCode: lastError?.code || 'DOMAIN_EVENT_SUBSCRIBER_FAILURE',
      errorMessage: lastError?.message || 'Subscriber failed',
      attempts: attempt
    };
    await Promise.resolve(this.deadLetterSink?.record?.({ event, failure })).catch(() => {});
    this.logger?.warn?.('Domain event subscriber failed', failure);
    return {
      subscriberId: subscriber.id,
      status: 'rejected',
      attempts: attempt,
      latencyMs: Date.now() - startedAt,
      error: failure
    };
  }

  async shutdown() {
    await Promise.allSettled([...this.aggregateChains.values()]);
    for (const subscriber of [...this.subscribers.values()].reverse()) {
      await subscriber.shutdown();
    }
  }

  snapshotMetrics() {
    return Object.freeze({
      ...this.metrics,
      subscriberLatency: Object.freeze({ ...this.metrics.subscriberLatency })
    });
  }
}

module.exports = { DomainEventBus };
