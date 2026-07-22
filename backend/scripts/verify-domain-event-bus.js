const assert = require('assert/strict');
const crypto = require('crypto');
const { createDomainEvent } = require('../src/domain-events/domainEvent');
const { DomainEventBus } = require('../src/domain-events/eventBus');
const { DomainEventSubscriber } = require('../src/domain-events/subscriber');
const { validationMiddleware, tracingMiddleware } = require('../src/domain-events/middleware');

class RecordingSubscriber extends DomainEventSubscriber {
  constructor({ id, eventTypes = ['*'], priority = 100, retry, failTimes = 0, sink }) {
    super({ id, eventTypes, priority, retry });
    this.failTimes = failTimes;
    this.sink = sink;
    this.calls = 0;
  }

  async handle(event) {
    this.calls += 1;
    this.sink.push(`${this.id}:${event.aggregateId}:${event.payload.index}`);
    if (this.calls <= this.failTimes) {
      throw new Error(`simulated failure ${this.id}`);
    }
  }
}

function event({ eventType = 'ProblemOpened', aggregateId = 'session-a', index = 1, source = 'verification' } = {}) {
  return createDomainEvent({
    eventType,
    occurredAt: new Date().toISOString(),
    aggregateType: 'TelemetrySession',
    aggregateId,
    source,
    payload: { index },
    metadata: { requestId: crypto.randomUUID() },
    correlationId: crypto.randomUUID()
  });
}

async function run() {
  const sink = [];
  const deadLetters = [];
  const middlewareOrder = [];
  const bus = new DomainEventBus({
    middleware: [
      validationMiddleware,
      (domainEvent) => {
        middlewareOrder.push(`middleware:${domainEvent.payload.index}`);
        return domainEvent;
      },
      tracingMiddleware
    ],
    deadLetterSink: {
      record: (failure) => {
        deadLetters.push(failure);
      }
    }
  });

  const first = new RecordingSubscriber({ id: 'first', priority: 10, sink });
  const retrying = new RecordingSubscriber({
    id: 'retrying',
    priority: 20,
    retry: { maxAttempts: 2, baseDelayMs: 1 },
    failTimes: 1,
    sink
  });
  const failing = new RecordingSubscriber({
    id: 'failing',
    priority: 30,
    retry: { maxAttempts: 2, baseDelayMs: 1 },
    failTimes: 1000,
    sink
  });
  const late = new RecordingSubscriber({ id: 'late', eventTypes: ['ContestStarted'], priority: 40, sink });

  bus.subscribe(first);
  bus.subscribe(retrying);
  bus.subscribe(failing);
  assert.throws(() => bus.subscribe(new RecordingSubscriber({ id: 'first', sink })), /Duplicate/);

  await bus.initialize();
  const sameAggregate = [1, 2, 3, 4, 5].map((index) => bus.publish(event({ index, aggregateId: 'session-a' })));
  const differentAggregate = [1, 2, 3, 4, 5].map((index) => bus.publish(event({ index, aggregateId: 'session-b' })));
  await Promise.all([...sameAggregate, ...differentAggregate]);

  bus.subscribe(late);
  await bus.publish(event({ eventType: 'ContestStarted', aggregateId: 'session-c', index: 1 }));
  await bus.publish(event({
    eventType: 'UserLoggedIn',
    aggregateId: 'user-1',
    index: 1,
    source: 'auth.service'
  }));

  const seenByFirstSessionA = sink
    .filter((entry) => entry.startsWith('first:session-a'))
    .map((entry) => Number(entry.split(':')[2]));
  assert.deepEqual(seenByFirstSessionA, [1, 2, 3, 4, 5], 'same aggregate ordering must be preserved');
  assert.equal(retrying.calls, 13, 'retrying subscriber should retry exactly once for its first event');
  assert.equal(deadLetters.length, 12, 'permanently failing subscriber should route failures without stopping dispatch');
  assert.equal(sink.some((entry) => entry.startsWith('late:session-c')), true, 'late subscriber must receive events after registration');
  assert.equal(middlewareOrder.length, 12, 'middleware should run for every published event');

  const burstSink = [];
  const burstBus = new DomainEventBus();
  burstBus.subscribe(new RecordingSubscriber({ id: 'burst', sink: burstSink }));
  await Promise.all(Array.from({ length: 500 }, (_, index) => (
    burstBus.publish(event({ aggregateId: `burst-${index % 25}`, index }))
  )));
  assert.equal(burstSink.length, 500);

  const constrainedBus = new DomainEventBus({ maxQueueDepth: 1 });
  constrainedBus.subscribe(new RecordingSubscriber({ id: 'slow', sink: [] }));
  const firstPublish = constrainedBus.publish(event({ aggregateId: 'limited', index: 1 }));
  await assert.rejects(
    () => constrainedBus.publish(event({ aggregateId: 'limited', index: 2 })),
    (error) => error.code === 'DOMAIN_EVENT_BACKPRESSURE'
  );
  await firstPublish;

  const metrics = bus.snapshotMetrics();
  assert.equal(metrics.publishedEvents, 12);
  assert.equal(metrics.subscriberFailures, 12);
  assert.equal(metrics.retryCount, 13);
  assert.equal(metrics.queueDepth, 0);

  await bus.shutdown();
  await burstBus.shutdown();

  console.log(JSON.stringify({
    verdict: 'PASS',
    publishedEvents: metrics.publishedEvents,
    subscriberFailures: metrics.subscriberFailures,
    retryCount: metrics.retryCount,
    publishersVerified: ['verification', 'auth.service'],
    orderedAggregateEvents: seenByFirstSessionA.length,
    burstEvents: burstSink.length,
    middlewareExecutions: middlewareOrder.length,
    backpressureRejected: true,
    duplicateSubscriptionRejected: true
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
