import { StorageKey } from '../constants/storage-keys.js';

export class ExtensionStateRepository {
  constructor(storage) {
    this.storage = storage;
  }

  get() {
    return this.storage.get(StorageKey.EXTENSION_STATE, null);
  }

  set(state) {
    return this.storage.set(StorageKey.EXTENSION_STATE, state);
  }
}

export class ProviderMetadataRepository {
  constructor(storage) {
    this.storage = storage;
  }

  getAll() {
    return this.storage.get(StorageKey.PROVIDER_METADATA, {});
  }

  setAll(metadata) {
    return this.storage.set(StorageKey.PROVIDER_METADATA, metadata);
  }
}
