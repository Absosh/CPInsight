const os = require('os');
const crypto = require('crypto');
const outboxRepository = require('./repository');
const { OutboxRetryPolicy } = require('./retryPolicy');
const { rowToDomainEvent } = require('./mapper');
const { createDomainEventBus } = require('../factory');

class OutboxRelayWorker {
  constructor({
    repository = outboxRepository,
    eventBus = createDomainEventBus(),
    retryPolicy = new OutboxRetryPolicy(),
    owner = `${os.hostname()}-${process.pid}-${crypto.randomUUID()}`,
    batchSize = 100,
    leaseMs = 30000,
    pollIntervalMs = 1000,
    logger = null
  } = {}) {
    this.repository = repository;
    this.eventBus = eventBus;
    this.retryPolicy = retryPolicy;
    this.owner = owner;
    this.batchSize = batchSize;
    this.leaseMs = leaseMs;
    this.pollIntervalMs = pollIntervalMs;
    this.logger = logger;
    this.timer = null;
    this.running = false;
    this.stats = {
      pendingEvents: 0,
      publishedEvents: 0,
      failedEvents: 0,
      deadLetters: 0,
      relayThroughput: 0,
      publishLatency: 0,
      retryCount: 0,
      leaseContention: 0,
      queueDepth: 0,
      replayCount: 0
    };
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((error) => this.logger?.warn?.('Outbox relay tick failed', { message: error.message }));
    }, this.pollIntervalMs);
    this.tick().catch((error) => this.logger?.warn?.('Outbox relay initial tick failed', { message: error.message }));
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.running) {
      this.stats.leaseContention += 1;
      return this.snapshotStats();
    }
    this.running = true;
    const startedAt = Date.now();
    try {
      await this.repository.recoverExpiredLeases();
      const records = await this.repository.acquirePending({
        limit: this.batchSize,
        owner: this.owner,
        leaseMs: this.leaseMs
      });
      this.stats.pendingEvents = records.length;
      this.stats.queueDepth = records.length;

      for (const record of records) {
        await this.publishRecord(record);
      }

      const elapsed = Math.max(1, Date.now() - startedAt);
      this.stats.relayThroughput = Math.round((records.length / elapsed) * 1000);
      return this.snapshotStats();
    } finally {
      this.running = false;
    }
  }

  async publishRecord(record) {
    const startedAt = Date.now();
    try {
      await this.eventBus.publish(rowToDomainEvent(record), {
        outboxId: record.id,
        publicationToken: record.publication_token
      });
      const marked = await this.repository.markPublished({
        id: record.id,
        publicationToken: record.publication_token
      });
      if (marked) {
        this.stats.publishedEvents += 1;
        this.stats.publishLatency = Date.now() - startedAt;
      } else {
        this.stats.leaseContention += 1;
      }
    } catch (error) {
      const retryCount = Number(record.retry_count || 0) + 1;
      const normalized = {
        code: error.code || 'OUTBOX_RELAY_FAILURE',
        message: error.message || 'Outbox relay failed',
        stack: error.stack || null
      };
      if (this.retryPolicy.shouldDeadLetter(retryCount)) {
        await this.repository.moveToDeadLetter({
          id: record.id,
          publicationToken: record.publication_token,
          retryCount,
          lastError: normalized
        });
        this.stats.deadLetters += 1;
        return;
      }
      await this.repository.markFailed({
        id: record.id,
        publicationToken: record.publication_token,
        retryCount,
        nextAttemptAt: new Date(Date.now() + this.retryPolicy.nextDelayMs(retryCount)).toISOString(),
        lastError: normalized
      });
      this.stats.failedEvents += 1;
      this.stats.retryCount += 1;
    }
  }

  async replay(filters = {}) {
    const records = await this.repository.findReplayCandidates(filters);
    const results = [];
    for (const record of records) {
      const result = await this.eventBus.publish(rowToDomainEvent(record), {
        replay: true,
        outboxId: record.id
      });
      await this.repository.recordReplay({
        outboxId: record.id,
        eventId: record.event_id,
        requestedBy: filters.requestedBy || null,
        reason: filters.reason || null,
        status: result.dropped ? 'dropped' : 'published'
      });
      this.stats.replayCount += 1;
      results.push(result);
    }
    return results;
  }

  snapshotStats() {
    return Object.freeze({ ...this.stats });
  }
}

module.exports = { OutboxRelayWorker };
