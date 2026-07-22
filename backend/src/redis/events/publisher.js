const { streamForEvent, STREAM_VERSION } = require('./streamTopology');

function serializeEvent(event) {
  return JSON.stringify({
    ...event,
    metadata: {
      ...event.metadata,
      streamVersion: STREAM_VERSION
    }
  });
}

class RedisEventPublisher {
  constructor({
    connectionManager,
    maxStreamLength = 1000000,
    logger = null
  }) {
    this.connectionManager = connectionManager;
    this.maxStreamLength = maxStreamLength;
    this.logger = logger;
    this.metrics = {
      publishedEvents: 0,
      failedPublishes: 0,
      publishLatencyMs: 0,
      lastPublishedAt: null
    };
  }

  async publish(event) {
    const startedAt = Date.now();
    const client = await this.connectionManager.connect();
    const stream = streamForEvent(event);
    const id = await client.xadd(
      stream,
      'MAXLEN',
      '~',
      this.maxStreamLength,
      '*',
      'eventId',
      event.eventId,
      'eventType',
      event.eventType,
      'aggregateType',
      event.aggregateType,
      'aggregateId',
      event.aggregateId,
      'eventVersion',
      String(event.eventVersion),
      'source',
      event.source,
      'payload',
      serializeEvent(event)
    );
    this.metrics.publishedEvents += 1;
    this.metrics.publishLatencyMs = Date.now() - startedAt;
    this.metrics.lastPublishedAt = new Date().toISOString();
    return { stream, id };
  }

  async publishBatch(events) {
    if (!events.length) return [];
    const client = await this.connectionManager.connect();
    const pipeline = client.pipeline();
    const commands = events.map((event) => {
      const stream = streamForEvent(event);
      pipeline.xadd(
        stream,
        'MAXLEN',
        '~',
        this.maxStreamLength,
        '*',
        'eventId',
        event.eventId,
        'eventType',
        event.eventType,
        'aggregateType',
        event.aggregateType,
        'aggregateId',
        event.aggregateId,
        'eventVersion',
        String(event.eventVersion),
        'source',
        event.source,
        'payload',
        serializeEvent(event)
      );
      return { stream };
    });
    const results = await pipeline.exec();
    return results.map(([error, id], index) => {
      if (error) {
        this.metrics.failedPublishes += 1;
        throw error;
      }
      this.metrics.publishedEvents += 1;
      return { ...commands[index], id };
    });
  }

  snapshotMetrics() {
    return Object.freeze({ ...this.metrics });
  }
}

module.exports = { RedisEventPublisher, serializeEvent };
