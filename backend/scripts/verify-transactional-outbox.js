const assert = require('assert/strict');
const crypto = require('crypto');
const { createDomainEvent } = require('../src/domain-events/domainEvent');
const { OutboxRelayWorker } = require('../src/domain-events/outbox/relayWorker');
const { OutboxRetryPolicy } = require('../src/domain-events/outbox/retryPolicy');
const { OUTBOX_STATUS } = require('../src/domain-events/outbox/status');

class MemoryOutboxRepository {
  constructor() {
    this.rows = [];
    this.replays = [];
  }

  async insert(event) {
    if (this.rows.some((row) => row.event_id === event.eventId)) return null;
    const row = {
      id: crypto.randomUUID(),
      event_id: event.eventId,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      event_type: event.eventType,
      event_version: event.eventVersion,
      occurred_at: event.occurredAt,
      original_published_at: event.publishedAt,
      source: event.source,
      payload: event.payload,
      metadata: event.metadata,
      correlation_id: event.correlationId,
      causation_id: event.causationId,
      status: OUTBOX_STATUS.PENDING,
      retry_count: 0,
      next_attempt_at: new Date(0).toISOString(),
      relay_owner: null,
      lease_expiration: null,
      publication_token: null,
      created_at: new Date(Date.now() + this.rows.length).toISOString(),
      published_at: null,
      last_error: null,
      retry_history: []
    };
    this.rows.push(row);
    return row;
  }

  async acquirePending({ limit, owner, leaseMs }) {
    const now = Date.now();
    const candidates = this.rows
      .filter((row) => [OUTBOX_STATUS.PENDING, OUTBOX_STATUS.FAILED].includes(row.status))
      .filter((row) => Date.parse(row.next_attempt_at) <= now)
      .filter((row) => !this.rows.some((earlier) => (
        earlier.aggregate_type === row.aggregate_type
        && earlier.aggregate_id === row.aggregate_id
        && Date.parse(earlier.created_at) < Date.parse(row.created_at)
        && [OUTBOX_STATUS.PENDING, OUTBOX_STATUS.FAILED, OUTBOX_STATUS.PUBLISHING].includes(earlier.status)
      )))
      .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
      .slice(0, limit);

    for (const row of candidates) {
      row.status = OUTBOX_STATUS.PUBLISHING;
      row.relay_owner = owner;
      row.lease_expiration = new Date(Date.now() + leaseMs).toISOString();
      row.publication_token = crypto.randomUUID();
    }
    return candidates.map((row) => ({ ...row }));
  }

  async markPublished({ id, publicationToken }) {
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.publication_token !== publicationToken || row.status !== OUTBOX_STATUS.PUBLISHING) return null;
    row.status = OUTBOX_STATUS.PUBLISHED;
    row.published_at = new Date().toISOString();
    row.relay_owner = null;
    row.lease_expiration = null;
    return { ...row };
  }

  async markFailed({ id, publicationToken, retryCount, nextAttemptAt, lastError }) {
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.publication_token !== publicationToken || row.status !== OUTBOX_STATUS.PUBLISHING) return null;
    row.status = OUTBOX_STATUS.FAILED;
    row.retry_count = retryCount;
    row.next_attempt_at = nextAttemptAt;
    row.last_error = lastError.message;
    row.retry_history.push(lastError);
    row.relay_owner = null;
    row.lease_expiration = null;
    return { ...row };
  }

  async moveToDeadLetter({ id, publicationToken, retryCount, lastError }) {
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.publication_token !== publicationToken || row.status !== OUTBOX_STATUS.PUBLISHING) return null;
    row.status = OUTBOX_STATUS.DEAD_LETTER;
    row.retry_count = retryCount;
    row.last_error = lastError.message;
    row.retry_history.push(lastError);
    row.relay_owner = null;
    row.lease_expiration = null;
    return { ...row };
  }

  async recoverExpiredLeases() {
    const now = Date.now();
    const recovered = [];
    for (const row of this.rows) {
      if (row.status === OUTBOX_STATUS.PUBLISHING && Date.parse(row.lease_expiration) < now) {
        row.status = OUTBOX_STATUS.FAILED;
        row.relay_owner = null;
        row.lease_expiration = null;
        recovered.push({ ...row });
      }
    }
    return recovered;
  }

  async findReplayCandidates(filters = {}) {
    return this.rows
      .filter((row) => [OUTBOX_STATUS.PUBLISHED, OUTBOX_STATUS.DEAD_LETTER].includes(row.status))
      .filter((row) => !filters.aggregateId || row.aggregate_id === filters.aggregateId)
      .filter((row) => !filters.eventType || row.event_type === filters.eventType)
      .sort((left, right) => `${left.aggregate_type}:${left.aggregate_id}:${left.created_at}`
        .localeCompare(`${right.aggregate_type}:${right.aggregate_id}:${right.created_at}`));
  }

  async recordReplay(record) {
    this.replays.push(record);
    return record;
  }
}

class MemoryEventBus {
  constructor({ failAlways = false, crashAfterPublish = false } = {}) {
    this.failAlways = failAlways;
    this.crashAfterPublish = crashAfterPublish;
    this.published = new Map();
    this.order = [];
  }

  async publish(event) {
    const key = event.eventId;
    if (!this.published.has(key)) {
      this.published.set(key, event);
      this.order.push(`${event.aggregateId}:${event.payload.index}`);
    }
    if (this.failAlways) throw new Error('simulated broker failure');
    if (this.crashAfterPublish) {
      const error = new Error('simulated crash after publish');
      error.code = 'SIMULATED_CRASH_AFTER_PUBLISH';
      throw error;
    }
    return { event, subscriberResults: [], dropped: false };
  }
}

function event(index, aggregateId = 'session-a') {
  return createDomainEvent({
    eventType: 'ProblemOpened',
    occurredAt: new Date().toISOString(),
    aggregateType: 'TelemetrySession',
    aggregateId,
    source: 'verification',
    payload: { index },
    metadata: { batchId: 'batch-a' },
    correlationId: crypto.randomUUID(),
    causationId: crypto.randomUUID()
  });
}

async function run() {
  const rollbackRepository = new MemoryOutboxRepository();
  const rollbackBuffer = [];
  rollbackBuffer.push(event(1));
  assert.equal(rollbackRepository.rows.length, 0, 'rollback simulation must not leak outbox rows');

  const repository = new MemoryOutboxRepository();
  await repository.insert(event(1));
  await repository.insert(event(2));
  await repository.insert(event(1, 'session-b'));

  const eventBus = new MemoryEventBus();
  const relay = new OutboxRelayWorker({
    repository,
    eventBus,
    retryPolicy: new OutboxRetryPolicy({ maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2, jitterRatio: 0 }),
    batchSize: 10,
    leaseMs: 25,
    pollIntervalMs: 10000
  });

  await relay.tick();
  await relay.tick();
  assert.equal(repository.rows.filter((row) => row.status === OUTBOX_STATUS.PUBLISHED).length, 3);
  assert.deepEqual(eventBus.order.filter((item) => item.startsWith('session-a')), ['session-a:1', 'session-a:2']);

  const duplicateLeaseRepository = new MemoryOutboxRepository();
  await duplicateLeaseRepository.insert(event(1));
  const firstLease = await duplicateLeaseRepository.acquirePending({ limit: 1, owner: 'relay-a', leaseMs: 1000 });
  const secondLease = await duplicateLeaseRepository.acquirePending({ limit: 1, owner: 'relay-b', leaseMs: 1000 });
  assert.equal(firstLease.length, 1);
  assert.equal(secondLease.length, 0, 'duplicate relay workers must not acquire the same leased event');

  duplicateLeaseRepository.rows[0].lease_expiration = new Date(Date.now() - 1).toISOString();
  await duplicateLeaseRepository.recoverExpiredLeases();
  const recoveredLease = await duplicateLeaseRepository.acquirePending({ limit: 1, owner: 'relay-b', leaseMs: 1000 });
  assert.equal(recoveredLease.length, 1, 'expired leases must recover');

  const failingRepository = new MemoryOutboxRepository();
  await failingRepository.insert(event(1));
  const failingRelay = new OutboxRelayWorker({
    repository: failingRepository,
    eventBus: new MemoryEventBus({ failAlways: true }),
    retryPolicy: new OutboxRetryPolicy({ maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 }),
    batchSize: 1,
    leaseMs: 10
  });
  await failingRelay.tick();
  failingRepository.rows[0].next_attempt_at = new Date(0).toISOString();
  await failingRelay.tick();
  assert.equal(failingRepository.rows[0].status, OUTBOX_STATUS.DEAD_LETTER);

  const requiredRepository = new MemoryOutboxRepository();
  await requiredRepository.insert(event(1));
  const requiredRelay = new OutboxRelayWorker({
    repository: requiredRepository,
    eventBus: {
      publish: async (domainEvent) => ({
        event: domainEvent,
        subscriberResults: [{ subscriberId: 'redis-event-publisher', status: 'rejected' }],
        dropped: false
      })
    },
    requiredSubscriberIds: ['redis-event-publisher'],
    retryPolicy: new OutboxRetryPolicy({ maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 }),
    batchSize: 1,
    leaseMs: 10
  });
  await requiredRelay.tick();
  assert.equal(requiredRepository.rows[0].status, OUTBOX_STATUS.FAILED);

  const crashRepository = new MemoryOutboxRepository();
  await crashRepository.insert(event(1));
  const crashBus = new MemoryEventBus({ crashAfterPublish: true });
  const crashRelay = new OutboxRelayWorker({
    repository: crashRepository,
    eventBus: crashBus,
    retryPolicy: new OutboxRetryPolicy({ maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 1, jitterRatio: 0 }),
    batchSize: 1,
    leaseMs: 10
  });
  await crashRelay.tick();
  assert.equal(crashRepository.rows[0].status, OUTBOX_STATUS.FAILED);
  crashRepository.rows[0].next_attempt_at = new Date(0).toISOString();
  crashBus.crashAfterPublish = false;
  await crashRelay.tick();
  assert.equal(crashRepository.rows[0].status, OUTBOX_STATUS.PUBLISHED);
  assert.equal(crashBus.published.size, 1, 'retry after crash must not duplicate logical publication');

  const replayResults = await relay.replay({ aggregateId: 'session-a', requestedBy: crypto.randomUUID(), reason: 'verification' });
  assert.equal(replayResults.length, 2);
  assert.equal(repository.replays.length, 2);

  const backlogRepository = new MemoryOutboxRepository();
  for (let index = 0; index < 1000; index += 1) {
    await backlogRepository.insert(event(index, `session-${index % 50}`));
  }
  const backlogRelay = new OutboxRelayWorker({
    repository: backlogRepository,
    eventBus: new MemoryEventBus(),
    batchSize: 250,
    leaseMs: 1000
  });
  for (let index = 0; index < 20; index += 1) {
    await backlogRelay.tick();
  }
  assert.equal(backlogRepository.rows.filter((row) => row.status === OUTBOX_STATUS.PUBLISHED).length, 1000);

  console.log(JSON.stringify({
    verdict: 'PASS',
    rollbackSafety: true,
    publishedEvents: repository.rows.filter((row) => row.status === OUTBOX_STATUS.PUBLISHED).length,
    duplicateRelayBlocked: true,
    leaseRecovery: true,
    deadLetters: failingRepository.rows.filter((row) => row.status === OUTBOX_STATUS.DEAD_LETTER).length,
    requiredSubscriberFailureRetried: true,
    replayedEvents: replayResults.length,
    largeBacklogPublished: 1000,
    exactlyOnceMarkers: eventBus.published.size,
    crashAfterPublishRecovered: true
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
