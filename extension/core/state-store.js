import { StorageKey } from '../constants/storage-keys.js';

export function createInitialState(version = '0.1.0') {
  return {
    authStatus: 'unknown',
    providerStatus: {},
    currentUsername: null,
    lastSyncTime: {},
    syncProgress: null,
    extensionVersion: version,
    providerHealth: {},
    pendingUploadCount: 0,
    storageMetadata: {
      schemaVersion: 1,
      initializedAt: Date.now()
    }
  };
}

export class StateStore {
  constructor(storage, initialState = createInitialState()) {
    this.storage = storage;
    this.state = initialState;
    this.listeners = new Set();
  }

  async initialize() {
    this.state = await this.storage.get(StorageKey.EXTENSION_STATE, this.state);
    return this.state;
  }

  getState() {
    return structuredClone(this.state);
  }

  async setState(patch) {
    this.state = {
      ...this.state,
      ...patch
    };
    await this.storage.set(StorageKey.EXTENSION_STATE, this.state);
    this.notify();
    return this.getState();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
