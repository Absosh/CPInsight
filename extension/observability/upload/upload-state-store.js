import { StorageKey } from '../../constants/storage-keys.js';

function createInitialState() {
  return {
    schemaVersion: 1,
    lastSequenceNumber: 0,
    nextBatchSequenceNumber: 1,
    retry: {
      attemptCount: 0,
      nextRetryAt: 0,
      lastError: null,
      updatedAt: null
    },
    lowStorageWarnings: [],
    lastSuccessfulUploadAt: null,
    lastAttemptAt: null
  };
}

export class UploadStateStore {
  constructor({ storage, logger } = {}) {
    this.storage = storage;
    this.logger = logger;
    this.writeLock = Promise.resolve();
  }

  async withWriteLock(operation) {
    const previous = this.writeLock;
    let release;
    this.writeLock = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async getState() {
    const state = await this.storage.get(StorageKey.TELEMETRY_UPLOAD_STATE, createInitialState());
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      await this.storage.set(StorageKey.TELEMETRY_UPLOAD_STATE, createInitialState());
      return createInitialState();
    }
    return {
      ...createInitialState(),
      ...state,
      retry: {
        ...createInitialState().retry,
        ...(state.retry || {})
      }
    };
  }

  async setState(patch) {
    return this.withWriteLock(async () => {
      const current = await this.getState();
      const next = {
        ...current,
        ...patch,
        retry: {
          ...current.retry,
          ...(patch.retry || {})
        }
      };
      await this.storage.set(StorageKey.TELEMETRY_UPLOAD_STATE, next);
      return next;
    });
  }

  async assignMissingSequenceNumbers(queue, { persistQueue = true } = {}) {
    return this.withWriteLock(async () => {
      const state = await this.getState();
      let lastSequenceNumber = Number(state.lastSequenceNumber || 0);
      let changed = false;
      const sequenced = queue.map((entry) => {
        if (Number.isInteger(entry?.uploadSequenceNumber) && entry.uploadSequenceNumber > 0) return entry;
        lastSequenceNumber += 1;
        changed = true;
        return {
          ...entry,
          uploadSequenceNumber: lastSequenceNumber,
          queuedAt: entry.queuedAt || new Date().toISOString()
        };
      });
      if (changed) {
        if (persistQueue) {
          await this.storage.set(StorageKey.OBSERVABILITY_QUEUE, sequenced);
        }
        await this.storage.set(StorageKey.TELEMETRY_UPLOAD_STATE, {
          ...state,
          lastSequenceNumber
        });
      }
      return sequenced;
    });
  }

  async reserveBatchSequenceNumber() {
    return this.withWriteLock(async () => {
      const state = await this.getState();
      const sequenceNumber = Number(state.nextBatchSequenceNumber || 1);
      await this.storage.set(StorageKey.TELEMETRY_UPLOAD_STATE, {
        ...state,
        nextBatchSequenceNumber: sequenceNumber + 1
      });
      return sequenceNumber;
    });
  }

  async recordFailure(error, retryAt) {
    const state = await this.getState();
    return this.setState({
      lastAttemptAt: new Date().toISOString(),
      retry: {
        attemptCount: Number(state.retry?.attemptCount || 0) + 1,
        nextRetryAt: retryAt,
        lastError: error?.message || String(error || 'Unknown upload failure'),
        updatedAt: new Date().toISOString()
      }
    });
  }

  async recordSuccess() {
    return this.setState({
      lastAttemptAt: new Date().toISOString(),
      lastSuccessfulUploadAt: new Date().toISOString(),
      retry: {
        attemptCount: 0,
        nextRetryAt: 0,
        lastError: null,
        updatedAt: new Date().toISOString()
      }
    });
  }
}
