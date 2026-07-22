const assert = require('assert/strict');
const crypto = require('crypto');
const { createTelemetryProcessingPipeline } = require('../src/telemetry/pipeline/factory');
const { TelemetryPipelineError } = require('../src/telemetry/pipeline/errors');

class MemoryTelemetryRepository {
  constructor({ failOnInsert = false } = {}) {
    this.failOnInsert = failOnInsert;
    this.events = new Map();
    this.processed = new Map();
    this.batches = new Map();
    this.metrics = [];
  }

  async findExistingEvents(eventIds) {
    return eventIds
      .filter((eventId) => this.events.has(eventId))
      .map((eventId) => this.events.get(eventId));
  }

  async upsertBatch({ userId, batch }) {
    const row = {
      id: crypto.randomUUID(),
      user_id: userId,
      batch_id: batch.batchId,
      sequence_number: batch.sequenceNumber
    };
    this.batches.set(`${userId}:${batch.batchId}`, row);
    return row;
  }

  async insertEvent({ userId, item }) {
    if (this.failOnInsert) throw new Error('simulated storage failure');
    if (this.events.has(item.event.eventId)) return null;
    const row = {
      id: crypto.randomUUID(),
      event_id: item.event.eventId,
      user_id: userId
    };
    this.events.set(item.event.eventId, row);
    return row;
  }

  async insertProcessedEvent({ item }) {
    if (this.processed.has(item.event.eventId)) return null;
    const row = {
      event_id: item.event.eventId,
      classification: item.classification.category,
      processing_metadata: item.processed
    };
    this.processed.set(item.event.eventId, row);
    return row;
  }

  async insertPipelineMetrics(record) {
    this.metrics.push(record);
    return record;
  }
}

function event(sequenceNumber, patch = {}) {
  return {
    sequenceNumber,
    event: {
      eventId: patch.eventId || crypto.randomUUID(),
      sessionId: 'contest_session_pipeline',
      userId: null,
      platform: patch.platform || 'codeforces',
      contestId: patch.contestId || '1999',
      contestName: patch.contestName || 'Codeforces Round 1999',
      problemId: patch.problemId || null,
      eventType: patch.eventType || 'SESSION_STARTED',
      timestamp: patch.timestamp || new Date().toISOString(),
      pageUrl: patch.pageUrl || 'https://codeforces.com/contest/1999',
      metadata: patch.metadata || { collectorId: 'codeforces-contest-session' }
    }
  };
}

function batch(events, patch = {}) {
  return {
    batchId: patch.batchId || crypto.randomUUID(),
    sequenceNumber: patch.sequenceNumber || 1,
    createdAt: patch.createdAt || new Date().toISOString(),
    sdkVersion: patch.sdkVersion || 'observability-sdk-v1',
    schemaVersion: patch.schemaVersion || 1,
    collectorVersion: patch.collectorVersion || 'codeforces-contest-session',
    events
  };
}

async function process(repository, payload, userId = '00000000-0000-4000-8000-000000000001') {
  const pipeline = createTelemetryProcessingPipeline({ repository, serverNode: 'test-node' });
  await pipeline.initialize();
  const result = await pipeline.process({
    userId,
    batch: payload,
    headers: { 'idempotency-key': payload.batchId },
    receivedAt: new Date().toISOString(),
    requestId: crypto.randomUUID()
  });
  await pipeline.flush();
  await pipeline.shutdown();
  return result;
}

async function assertPipelineError(fn, code) {
  await assert.rejects(fn, (error) => error instanceof TelemetryPipelineError && error.code === code);
}

async function run() {
  const repository = new MemoryTelemetryRepository();
  const normalBatch = batch([event(1), event(2, { eventType: 'PROBLEM_OPENED', problemId: 'A:A' })]);
  const normal = await process(repository, normalBatch);
  assert.deepEqual(normal.acknowledgement.acknowledgedEventIds, normalBatch.events.map((item) => item.event.eventId));
  assert.equal(repository.events.size, 2);
  assert.equal(repository.processed.size, 2);
  assert.equal(repository.processed.get(normalBatch.events[1].event.eventId).classification, 'problem_navigation');
  assert.equal(normal.metrics.eventsProcessed, 2);

  const replay = await process(repository, normalBatch);
  assert.equal(replay.metrics.duplicatesRemoved, 2);
  assert.equal(replay.metrics.eventsProcessed, 0);
  assert.equal(repository.events.size, 2, 'duplicate upload must not create duplicate raw events');

  const duplicateEventId = normalBatch.events[0].event.eventId;
  const duplicateEventBatch = batch([event(1, { eventId: duplicateEventId }), event(2)]);
  const duplicateEvent = await process(repository, duplicateEventBatch);
  assert.equal(duplicateEvent.metrics.duplicatesRemoved, 1);
  assert.equal(duplicateEvent.metrics.eventsProcessed, 1);

  await assertPipelineError(
    () => process(repository, batch([event(1)], { schemaVersion: 99 })),
    'UNSUPPORTED_SCHEMA_VERSION'
  );
  await assertPipelineError(
    () => process(repository, batch([event(1), event(1)])),
    'DUPLICATE_SEQUENCE_NUMBER'
  );
  await assertPipelineError(
    () => process(repository, batch([event(1), event(3)])),
    'MISSING_SEQUENCE_NUMBER'
  );
  await assertPipelineError(
    () => process(repository, batch([event(2), event(1)])),
    'OUT_OF_ORDER_EVENTS'
  );

  const storageFailureRepository = new MemoryTelemetryRepository({ failOnInsert: true });
  await assertPipelineError(
    () => process(storageFailureRepository, batch([event(1)])),
    'PIPELINE_TRANSIENT_FAILURE'
  );

  const largeRepository = new MemoryTelemetryRepository();
  const largeEvents = Array.from({ length: 250 }, (_, index) => event(index + 1));
  const large = await process(largeRepository, batch(largeEvents));
  assert.equal(large.metrics.eventsProcessed, 250);
  assert.equal(largeRepository.processed.size, 250);

  const mixedRepository = new MemoryTelemetryRepository();
  const mixed = await process(mixedRepository, batch([
    event(1, { platform: 'codeforces', metadata: { collectorId: 'codeforces-contest-session' } }),
    event(2, {
      platform: 'codechef',
      contestId: 'START200',
      pageUrl: 'https://www.codechef.com/START200',
      metadata: { collectorId: 'codechef-contest-session' }
    })
  ], { collectorVersion: 'mixed' }));
  assert.equal(mixed.metrics.eventsProcessed, 2);
  assert.equal(mixedRepository.processed.size, 2);

  const restartRepository = new MemoryTelemetryRepository();
  const restartBatch = batch([event(1), event(2)]);
  await process(restartRepository, restartBatch);
  const afterRestart = await process(restartRepository, restartBatch);
  assert.equal(afterRestart.metrics.duplicatesRemoved, 2, 'pipeline restart/replay must dedupe previously processed events');

  console.log(JSON.stringify({
    verdict: 'PASS',
    normalEventsProcessed: normal.metrics.eventsProcessed,
    duplicateReplayRemoved: replay.metrics.duplicatesRemoved,
    largeBatchProcessed: large.metrics.eventsProcessed,
    mixedCollectorsProcessed: mixed.metrics.eventsProcessed,
    metricsRecords: repository.metrics.length
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
