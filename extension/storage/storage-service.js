import { StorageArea } from '../constants/storage-keys.js';
import { ExtensionError, ErrorKind } from '../utils/errors.js';

export class StorageService {
  constructor(defaultArea = StorageArea.LOCAL) {
    this.defaultArea = defaultArea;
  }

  area(area = this.defaultArea) {
    const storageArea = chrome.storage?.[area];
    if (!storageArea) {
      throw new ExtensionError(`Unsupported storage area: ${area}`, { kind: ErrorKind.STORAGE });
    }
    return storageArea;
  }

  async get(key, fallback = null, area = this.defaultArea) {
    try {
      const result = await this.area(area).get(key);
      return Object.prototype.hasOwnProperty.call(result, key) ? result[key] : fallback;
    } catch (error) {
      throw new ExtensionError(`Failed to read storage key: ${key}`, { kind: ErrorKind.STORAGE, cause: error });
    }
  }

  async set(key, value, area = this.defaultArea) {
    try {
      await this.area(area).set({ [key]: value });
      return value;
    } catch (error) {
      throw new ExtensionError(`Failed to write storage key: ${key}`, { kind: ErrorKind.STORAGE, cause: error });
    }
  }

  async remove(key, area = this.defaultArea) {
    try {
      await this.area(area).remove(key);
    } catch (error) {
      throw new ExtensionError(`Failed to remove storage key: ${key}`, { kind: ErrorKind.STORAGE, cause: error });
    }
  }

  onChanged(listener) {
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
}
