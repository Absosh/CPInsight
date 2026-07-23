const env = require('../config/env');

function reviewWorkerConfig(overrides = {}) {
  return {
    enabled: env.reviewWorker.enabled,
    concurrency: env.reviewWorker.concurrency,
    pollIntervalMs: env.reviewWorker.pollIntervalMs,
    retryLimit: env.reviewWorker.retryLimit,
    batchSize: env.reviewWorker.batchSize,
    leaseMs: env.reviewWorker.leaseMs,
    providerTimeoutMs: env.reviewWorker.providerTimeoutMs,
    queueCleanupDays: env.reviewWorker.queueCleanupDays,
    ...overrides
  };
}

module.exports = { reviewWorkerConfig };
