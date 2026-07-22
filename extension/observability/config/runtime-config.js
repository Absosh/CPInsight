export const ObservabilityRuntimeConfig = Object.freeze({
  maxStoredEvents: 2000,
  maxQueuedEvents: 2000,
  staleSessionTtlMs: 12 * 60 * 60 * 1000,
  extensionRuntimeId: 'cpinsight-observability-sdk',
  schemaVersion: 1
});
