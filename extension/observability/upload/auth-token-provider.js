import { AppConfig } from '../../config/defaults.js';
import { StorageArea, StorageKey } from '../../constants/storage-keys.js';

export class AuthTokenProvider {
  constructor({ storage, logger, refreshPath = '/auth/refresh' } = {}) {
    this.storage = storage;
    this.logger = logger;
    this.refreshPath = refreshPath;
  }

  async getAccessToken() {
    return this.storage.get(StorageKey.CPINSIGHT_ACCESS_TOKEN, null, StorageArea.LOCAL);
  }

  async getRefreshToken() {
    return this.storage.get(StorageKey.CPINSIGHT_REFRESH_TOKEN, null, StorageArea.LOCAL);
  }

  async refreshAccessToken() {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return null;
    const response = await fetch(`${AppConfig.api.baseUrl}${this.refreshPath}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!response.ok) {
      this.logger?.warn('Telemetry token refresh failed', { status: response.status });
      return null;
    }
    const payload = await response.json();
    if (payload.accessToken) {
      await this.storage.set(StorageKey.CPINSIGHT_ACCESS_TOKEN, payload.accessToken, StorageArea.LOCAL);
    }
    if (payload.refreshToken) {
      await this.storage.set(StorageKey.CPINSIGHT_REFRESH_TOKEN, payload.refreshToken, StorageArea.LOCAL);
    }
    return payload.accessToken || null;
  }
}
