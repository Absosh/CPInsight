import { Environment, CURRENT_ENVIRONMENT } from './environment.js';

export const AppConfig = Object.freeze({
  environment: CURRENT_ENVIRONMENT,
  api: {
    baseUrl: CURRENT_ENVIRONMENT === Environment.PRODUCTION
      ? 'https://api.cpinsight.app'
      : 'http://localhost:4000/api',
    timeoutMs: 15000
  },
  sync: {
    batchSize: 100,
    maxRetryAttempts: 3,
    retryBaseDelayMs: 30000,
    leetcodeCollectionPath: '/extension/leetcode/collection',
    leetcodeStageTimeoutMs: {
      profile: 60000,
      navigating: 30000,
      progress: 120000,
      merging: 30000,
      uploading: 60000
    }
  },
  messaging: {
    requestTimeoutMs: 10000,
    pageCommandMaxAgeMs: 30000
  },
  debug: {
    verbose: CURRENT_ENVIRONMENT === Environment.DEVELOPMENT,
    bootstrapSummaryDelayMs: 5000
  },
  session: {
    cleanupTtlMs: {
      complete: 86400000,
      error: 3600000,
      cancelled: 3600000,
      stale: 21600000
    }
  },
  logging: {
    verbose: CURRENT_ENVIRONMENT === Environment.DEVELOPMENT
  },
  features: {
    leetcodeCollection: false,
    backendUpload: false,
    retryQueue: false
  }
});
