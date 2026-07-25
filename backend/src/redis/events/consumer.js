const crypto = require('crypto');

class RedisStreamConsumer {
  constructor({
    connectionManager,
    stream,
    group,
    consumerName = `${process.pid}-${crypto.randomUUID()}`,
    batchSize = 50,
    blockMs = 5000,
    idleMs = 30000,
    maxRetries = 5,
    deadLetterStream = `${stream}.dead-letter`,
    logger = null
  }) {
    this.connectionManager = connectionManager;
    this.stream = stream;
    this.group = group;
    this.consumerName = consumerName;
    this.batchSize = batchSize;
    this.blockMs = blockMs;
    this.idleMs = idleMs;
    this.maxRetries = maxRetries;
    this.deadLetterStream = deadLetterStream;
    this.logger = logger;
    this.running = false;
    this.blockingClient = null;
    this.metrics = {
      consumedEvents: 0,
      acknowledgedEvents: 0,
      retries: 0,
      failures: 0,
      pendingRecovered: 0,
      lag: 0,
      lastHeartbeatAt: null
    };
  }

  async initialize() {
    const client = await this.connectionManager.connect();
    try {
      await client.xgroup('CREATE', this.stream, this.group, '0', 'MKSTREAM');
    } catch (error) {
      if (!String(error.message).includes('BUSYGROUP')) throw error;
    }
  }

  async consume(handler) {
    this.running = true;
    await this.initialize();
    while (this.running) {
      await this.consumeOnce(handler);
    }
  }

  async consumeOnce(handler) {
    await this.recoverPending(handler);
    const client = await this.blockingReadClient();
    const result = await client.xreadgroup(
      'GROUP',
      this.group,
      this.consumerName,
      'COUNT',
      this.batchSize,
      'BLOCK',
      this.blockMs,
      'STREAMS',
      this.stream,
      '>'
    );
    if (!result) return [];
    return this.processReadResult(result, handler);
  }

  async blockingReadClient() {
    if (this.blockingClient && this.blockingClient.status === 'ready') {
      return this.blockingClient;
    }

    const baseClient = await this.connectionManager.connect();
    this.blockingClient = baseClient.duplicate({
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true
    });
    await this.blockingClient.connect();
    return this.blockingClient;
  }

  async recoverPending(handler) {
    const client = await this.connectionManager.connect();
    const claimed = await client.xautoclaim(
      this.stream,
      this.group,
      this.consumerName,
      this.idleMs,
      '0-0',
      'COUNT',
      this.batchSize
    );
    const entries = claimed?.[1] || [];
    if (!entries.length) return [];
    this.metrics.pendingRecovered += entries.length;
    return this.processEntries(entries, handler);
  }

  async processReadResult(result, handler) {
    const entries = result.flatMap(([, messages]) => messages);
    return this.processEntries(entries, handler);
  }

  async processEntries(entries, handler) {
    const results = [];
    for (const [id, fields] of entries) {
      const message = this.fieldsToObject(fields);
      try {
        await handler.consume({
          id,
          stream: this.stream,
          event: JSON.parse(message.payload),
          raw: message
        });
        await this.ack([id]);
        this.metrics.consumedEvents += 1;
        results.push({ id, status: 'acknowledged' });
      } catch (error) {
        await this.retryOrDeadLetter({ id, message, error });
        results.push({ id, status: 'failed', error: error.message });
      }
    }
    this.metrics.lastHeartbeatAt = new Date().toISOString();
    return results;
  }

  async ack(ids) {
    if (!ids.length) return 0;
    const client = await this.connectionManager.connect();
    const count = await client.xack(this.stream, this.group, ...ids);
    this.metrics.acknowledgedEvents += count;
    return count;
  }

  async retryOrDeadLetter({ id, message, error }) {
    const client = await this.connectionManager.connect();
    const deliveryCount = await this.pendingDeliveryCount(id);
    const retryCount = Math.max(Number(message.retryCount || 0) + 1, deliveryCount);
    if (retryCount >= this.maxRetries) {
      await client.xadd(
        this.deadLetterStream,
        '*',
        'stream',
        this.stream,
        'messageId',
        id,
        'error',
        error.message,
        'payload',
        message.payload
      );
      await client.xack(this.stream, this.group, id);
      this.metrics.failures += 1;
      return;
    }
    this.metrics.retries += 1;
    this.logger?.warn?.('Redis stream consumer retry scheduled', {
      stream: this.stream,
      group: this.group,
      id,
      retryCount
    });
  }

  async pendingDeliveryCount(id) {
    try {
      const client = await this.connectionManager.connect();
      const pending = await client.xpending(this.stream, this.group, id, id, 1);
      const row = Array.isArray(pending) ? pending[0] : null;
      return Number(row?.[3] || 1);
    } catch {
      return 1;
    }
  }

  async shutdown() {
    this.running = false;
    if (this.blockingClient) {
      await this.blockingClient.quit().catch(() => this.blockingClient.disconnect());
      this.blockingClient = null;
    }
  }

  fieldsToObject(fields) {
    const object = {};
    for (let index = 0; index < fields.length; index += 2) {
      object[fields[index]] = fields[index + 1];
    }
    return object;
  }

  snapshotMetrics() {
    return Object.freeze({ ...this.metrics });
  }
}

module.exports = { RedisStreamConsumer };
