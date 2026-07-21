// Platform Service
class PlatformService {
  normalizeAccounts(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.accounts)) {
      return data.accounts;
    }

    return [];
  }

  getCachedAccounts() {
    const cached = localStorage.getItem('platformAccounts');
    if (!cached) {
      return [];
    }

    try {
      return this.normalizeAccounts(JSON.parse(cached));
    } catch {
      localStorage.removeItem('platformAccounts');
      return [];
    }
  }

  async getAccounts() {
    try {
      const data = await httpClient.get('/platforms/accounts');
      const accounts = this.normalizeAccounts(data);
      localStorage.setItem('platformAccounts', JSON.stringify(accounts));
      return accounts;
    } catch (err) {
      console.error('Failed to fetch platform accounts:', err);
      return this.getCachedAccounts();
    }
  }

  async connectPlatform(platform, handle) {
    try {
      const data = await httpClient.post('/platforms/connect', {
        platform,
        handle
      });
      this.clearCache();
      return data;
    } catch (err) {
      throw err;
    }
  }

  async disconnectPlatform(platform) {
    try {
      await httpClient.delete('/platforms/disconnect', {
        platform
      });
      this.clearCache();
    } catch (err) {
      throw err;
    }
  }

  async syncPlatform(platform) {
    const data = await httpClient.post(`/platforms/sync/${encodeURIComponent(platform)}`, {});
    this.clearCache();
    return data;
  }

  async getConnectedPlatforms() {
    const accounts = await this.getAccounts();
    return accounts.map(acc => acc.platform);
  }

  isConnected(platform) {
    const accounts = JSON.parse(localStorage.getItem('platformAccounts') || '[]');
    return accounts.some(acc => acc.platform === platform);
  }

  getHandle(platform) {
    const accounts = JSON.parse(localStorage.getItem('platformAccounts') || '[]');
    const account = accounts.find(acc => acc.platform === platform);
    return account?.handle || null;
  }

  clearCache() {
    localStorage.removeItem('platformAccounts');
  }
}

const platformService = new PlatformService();
window.platformService = platformService;
