import { AlarmName } from '../../constants/alarm-names.js';
import { AppConfig } from '../../config/defaults.js';
import { BatchBuilder } from './batch-builder.js';
import { RetryPolicy } from './retry-policy.js';

export class TelemetryUploadScheduler {
  constructor({
    store,
    uploadStateStore,
    transport,
    logger,
    config = AppConfig.telemetryUpload,
    retryPolicy = new RetryPolicy({
      initialDelayMs: AppConfig.telemetryUpload.initialRetryDelayMs,
      maxDelayMs: AppConfig.telemetryUpload.maxRetryDelayMs
    }),
    batchBuilder = new BatchBuilder(config)
  } = {}) {
    this.store = store;
    this.uploadStateStore = uploadStateStore;
    this.transport = transport;
    this.logger = logger;
    this.config = config;
    this.retryPolicy = retryPolicy;
    this.batchBuilder = batchBuilder;
    this.running = false;
    this.started = false;
  }

  async start() {
    if (!this.config.enabled) return;
    if (this.started) return;
    this.started = true;
    await chrome.alarms.create(AlarmName.TELEMETRY_UPLOAD, {
      periodInMinutes: this.config.schedulePeriodMinutes
    });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== AlarmName.TELEMETRY_UPLOAD) return;
      this.flush('alarm').catch((error) => this.logger?.warn('Telemetry upload alarm failed', { reason: error?.message || 'unknown' }));
    });
    if (typeof self !== 'undefined') {
      self.addEventListener?.('online', () => {
        this.flush('online').catch(() => {});
      });
    }
    await this.flush('startup');
  }

  async flush(reason = 'manual') {
    if (!this.config.enabled || this.running) return { skipped: true, reason: this.running ? 'already_running' : 'disabled' };
    const state = await this.uploadStateStore.getState();
    if (state.retry?.nextRetryAt && Date.now() < state.retry.nextRetryAt) {
      return { skipped: true, reason: 'retry_backoff', nextRetryAt: state.retry.nextRetryAt };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { skipped: true, reason: 'offline' };
    }

    this.running = true;
    try {
      const queue = await this.compactExpiredEvents(await this.store.getQueue());
      if (queue.length >= this.config.lowStorageWarningThreshold) {
        await this.uploadStateStore.setState({
          lowStorageWarnings: [
            ...(state.lowStorageWarnings || []),
            { queueLength: queue.length, timestamp: new Date().toISOString() }
          ].slice(-20)
        });
      }
      const sequenced = await this.store.updateQueue((latestQueue) =>
        this.uploadStateStore.assignMissingSequenceNumbers(latestQueue, { persistQueue: false })
      );
      if (sequenced.length === 0) return { uploaded: false, reason: 'empty_queue' };
      const batchSequenceNumber = await this.uploadStateStore.reserveBatchSequenceNumber();
      const batch = this.batchBuilder.build(sequenced, batchSequenceNumber);
      if (!batch) return { uploaded: false, reason: 'empty_batch' };
      const acknowledgement = await this.transport.upload(batch);
      const acknowledgedEventIds = acknowledgement?.acknowledgedEventIds || [];
      await this.store.removeAcknowledgedEvents(acknowledgedEventIds);
      await this.uploadStateStore.recordSuccess();
      this.logger?.info('Telemetry upload acknowledged', {
        reason,
        batchId: batch.batchId,
        acknowledged: acknowledgedEventIds.length,
        highestSequenceNumber: acknowledgement?.highestSequenceNumber || null
      });
      return { uploaded: true, batchId: batch.batchId, acknowledgedEventIds };
    } catch (error) {
      if (Array.isArray(error.acknowledgedEventIds) && error.acknowledgedEventIds.length > 0) {
        await this.store.removeAcknowledgedEvents(error.acknowledgedEventIds);
      }
      const current = await this.uploadStateStore.getState();
      const retryAt = this.retryPolicy.nextRetryAt(current.retry?.attemptCount || 0, error.retryAfterMs || null);
      await this.uploadStateStore.recordFailure(error, retryAt);
      this.logger?.warn('Telemetry upload failed', {
        reason,
        error: error?.message || 'unknown',
        status: error.status || null,
        retryAt
      });
      return { uploaded: false, retryAt, error };
    } finally {
      this.running = false;
    }
  }

  async compactExpiredEvents(queue) {
    const ttl = this.config.expiredEventTtlMs;
    if (!Number.isFinite(ttl) || ttl <= 0) return queue;
    const cutoff = Date.now() - ttl;
    const compacted = queue.filter((event) => {
      const timestamp = Date.parse(event.timestamp || event.queuedAt);
      return !Number.isFinite(timestamp) || timestamp >= cutoff;
    });
    if (compacted.length !== queue.length) {
      await this.store.replaceQueue(compacted);
    }
    return compacted;
  }
}
