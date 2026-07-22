import assert from 'node:assert/strict';
import { StorageKey } from '../constants/storage-keys.js';
import { ObservabilityRuntimeConfig } from '../observability/config/runtime-config.js';
import { PersistentStore } from '../observability/storage/persistent-store.js';
import { BatchBuilder } from '../observability/upload/batch-builder.js';
import { RetryPolicy } from '../observability/upload/retry-policy.js';
import { UploadStateStore } from '../observability/upload/upload-state-store.js';
import { TelemetryUploadScheduler } from '../observability/upload/upload-scheduler.js';
import { HttpTelemetryTransport, TelemetryUploadError } from '../observability/upload/http-telemetry-transport.js';

class MemoryStorage {
  constructor(seed = {}) {
    this.values = structuredClone(seed);
  }

  async get(key, fallback = null) {
    return Object.prototype.hasOwnProperty.call(this.values, key)
      ? structuredClone(this.values[key])
      : fallback;
  }

  async set(key, value) {
    this.values[key] = structuredClone(value);
    return value;
  }
}

function logger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {}
  };
}

function event(index, patch = {}) {
  return {
    eventId: crypto.randomUUID(),
    sessionId: 'contest_session_test',
    userId: null,
    platform: 'codeforces',
    contestId: '1999',
    contestName: 'Codeforces Round 1999',
    problemId: index % 2 === 0 ? 'A:A' : null,
    eventType: index % 2 === 0 ? 'PROBLEM_OPENED' : 'SESSION_STARTED',
    timestamp: new Date(Date.now() + index).toISOString(),
    pageUrl: `https://codeforces.com/contest/1999${index % 2 === 0 ? '/problem/A' : ''}`,
    metadata: {
      collectorId: 'codeforces-contest-session',
      dedupeKey: `event-${index}`
    },
    ...patch
  };
}

function createHarness({ transport } = {}) {
  const storage = new MemoryStorage();
  const store = new PersistentStore({ storage, config: ObservabilityRuntimeConfig, logger: logger() });
  const uploadStateStore = new UploadStateStore({ storage, logger: logger() });
  const scheduler = new TelemetryUploadScheduler({
    store,
    uploadStateStore,
    logger: logger(),
    transport,
    config: {
      enabled: true,
      maxEventsPerBatch: 3,
      maxPayloadBytes: 100000,
      requestTimeoutMs: 1000,
      schedulePeriodMinutes: 1,
      initialRetryDelayMs: 1000,
      maxRetryDelayMs: 30000,
      expiredEventTtlMs: 7 * 24 * 60 * 60 * 1000,
      lowStorageWarningThreshold: 5,
      sdkVersion: 'observability-sdk-v1',
      schemaVersion: 1
    },
    retryPolicy: new RetryPolicy({ initialDelayMs: 1000, maxDelayMs: 30000, random: () => 0.5 }),
    batchBuilder: new BatchBuilder({
      maxEventsPerBatch: 3,
      maxPayloadBytes: 100000,
      sdkVersion: 'observability-sdk-v1',
      schemaVersion: 1
    })
  });
  return { storage, store, uploadStateStore, scheduler };
}

async function seedQueue(store, count) {
  for (let i = 1; i <= count; i += 1) {
    await store.enqueue(event(i));
  }
}

async function run() {
  const uploadedBatches = [];
  const fullAckHarness = createHarness({
    transport: {
      async upload(batch) {
        uploadedBatches.push(batch);
        return {
          acknowledgedEventIds: batch.events.map((item) => item.event.eventId),
          highestSequenceNumber: Math.max(...batch.events.map((item) => item.sequenceNumber)),
          serverTimestamp: new Date().toISOString()
        };
      }
    }
  });
  await seedQueue(fullAckHarness.store, 5);
  const fullAckResult = await fullAckHarness.scheduler.flush('test_full_ack');
  assert.equal(fullAckResult.uploaded, true);
  assert.equal(uploadedBatches[0].events.length, 3, 'batch builder must honor maxEventsPerBatch');
  assert.deepEqual(uploadedBatches[0].events.map((item) => item.sequenceNumber), [1, 2, 3]);
  assert.equal((await fullAckHarness.store.getQueue()).length, 2, 'only acknowledged events are removed');
  await fullAckHarness.scheduler.flush('test_second_batch');
  assert.equal((await fullAckHarness.store.getQueue()).length, 0);
  assert.equal((await fullAckHarness.uploadStateStore.getState()).retry.attemptCount, 0);

  const partialHarness = createHarness({
    transport: {
      async upload(batch) {
        throw new TelemetryUploadError('server unavailable after partial ack', {
          status: 500,
          retryable: true,
          acknowledgedEventIds: [batch.events[0].event.eventId]
        });
      }
    }
  });
  await seedQueue(partialHarness.store, 3);
  const partialResult = await partialHarness.scheduler.flush('test_partial_ack');
  assert.equal(partialResult.uploaded, false);
  assert.equal((await partialHarness.store.getQueue()).length, 2, 'partial ack must keep failed events queued');
  assert.equal((await partialHarness.uploadStateStore.getState()).retry.attemptCount, 1);

  const retryBlocked = await partialHarness.scheduler.flush('test_retry_blocked');
  assert.equal(retryBlocked.skipped, true);
  assert.equal(retryBlocked.reason, 'retry_backoff');

  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true
  });
  const offlineHarness = createHarness({ transport: { async upload() { throw new Error('must not upload offline'); } } });
  await seedQueue(offlineHarness.store, 1);
  const offlineResult = await offlineHarness.scheduler.flush('test_offline');
  assert.equal(offlineResult.skipped, true);
  assert.equal(offlineResult.reason, 'offline');
  delete globalThis.navigator;

  const corruptedStorage = new MemoryStorage({
    [StorageKey.OBSERVABILITY_QUEUE]: 'corrupted',
    [StorageKey.TELEMETRY_UPLOAD_STATE]: 'corrupted'
  });
  const corruptedStore = new PersistentStore({ storage: corruptedStorage, config: ObservabilityRuntimeConfig, logger: logger() });
  const corruptedUploadState = new UploadStateStore({ storage: corruptedStorage, logger: logger() });
  assert.deepEqual(await corruptedStore.getQueue(), [], 'corrupted queue must recover to empty array');
  assert.equal((await corruptedUploadState.getState()).schemaVersion, 1);

  const builder = new BatchBuilder({ maxEventsPerBatch: 10, maxPayloadBytes: 100, sdkVersion: 'test', schemaVersion: 1 });
  assert.throws(() => builder.build([{ ...event(99), uploadSequenceNumber: 1, metadata: { large: 'x'.repeat(1000) } }], 1), /maximum upload payload size/);

  const transportBatch = uploadedBatches[0];
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (_url, options) => {
    fetchCalls.push(options.headers.authorization);
    if (fetchCalls.length === 1) {
      return { ok: false, status: 401, headers: new Headers(), json: async () => ({ error: { message: 'expired' } }) };
    }
    return {
      ok: true,
      status: 202,
      headers: new Headers(),
      json: async () => ({
        acknowledgedEventIds: transportBatch.events.map((item) => item.event.eventId),
        highestSequenceNumber: 3,
        serverTimestamp: new Date().toISOString()
      })
    };
  };
  const refreshedTransport = new HttpTelemetryTransport({
    timeoutMs: 1000,
    tokenProvider: {
      async getAccessToken() { return 'expired-token'; },
      async refreshAccessToken() { return 'fresh-token'; }
    }
  });
  const refreshedAck = await refreshedTransport.upload(transportBatch);
  assert.equal(refreshedAck.acknowledgedEventIds.length, 3);
  assert.deepEqual(fetchCalls, ['Bearer expired-token', 'Bearer fresh-token']);

  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    headers: new Headers({ 'retry-after': '2' }),
    json: async () => ({ error: { message: 'rate limited' } })
  });
  await assert.rejects(
    () => refreshedTransport.upload(transportBatch),
    (error) => error instanceof TelemetryUploadError && error.status === 429 && error.retryAfterMs === 2000
  );

  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  });
  const timeoutTransport = new HttpTelemetryTransport({
    timeoutMs: 1,
    tokenProvider: {
      async getAccessToken() { return 'token'; },
      async refreshAccessToken() { return null; }
    }
  });
  await assert.rejects(
    () => timeoutTransport.upload(transportBatch),
    (error) => error instanceof TelemetryUploadError && /timed out/.test(error.message)
  );
  globalThis.fetch = originalFetch;

  console.log(JSON.stringify({
    verdict: 'PASS',
    fullAckBatches: uploadedBatches.length,
    partialQueueLength: (await partialHarness.store.getQueue()).length,
    offlineSkipped: offlineResult.reason,
    retryAttemptCount: (await partialHarness.uploadStateStore.getState()).retry.attemptCount
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
