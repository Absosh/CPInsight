// Authentication Manager
const AUTH_API = 'http://localhost:4000/api/auth';

class AuthManager {
  static getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  static getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  static isLoggedIn() {
    return !!this.getAccessToken();
  }

  static setTokens(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  static logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userProfile');
    window.location.href = 'auth.html';
  }

  static async getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getAccessToken()}`
    };
  }

  static async fetchWithAuth(url, options = {}) {
    const headers = await this.getHeaders();
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        this.logout();
        return null;
      }
      // Retry with new token
      const newHeaders = await this.getHeaders();
      return fetch(url, {
        ...options,
        headers: { ...newHeaders, ...options.headers }
      });
    }

    return response;
  }

  static async refreshAccessToken() {
    try {
      const response = await fetch(`${AUTH_API}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.getRefreshToken() })
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch (err) {
      return false;
    }
  }

  static async getUserProfile() {
    const cached = localStorage.getItem('userProfile');
    if (cached) return JSON.parse(cached);

    try {
      const response = await this.fetchWithAuth('http://localhost:4000/api/user/profile');
      if (!response || !response.ok) return null;

      const data = await response.json();
      localStorage.setItem('userProfile', JSON.stringify(data));
      return data;
    } catch (err) {
      return null;
    }
  }

  static async connectPlatform(platform, handle) {
    try {
      const response = await this.fetchWithAuth('http://localhost:4000/api/platforms/connect', {
        method: 'POST',
        body: JSON.stringify({ platform, handle })
      });

      if (!response || !response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to connect platform');
      }

      return await response.json();
    } catch (err) {
      throw err;
    }
  }

  static async getAnalytics(platform) {
    try {
      const response = await this.fetchWithAuth(`http://localhost:4000/api/analytics/${platform}`);
      if (!response || !response.ok) return null;
      return await response.json();
    } catch (err) {
      return null;
    }
  }

  static async getCombinedAnalytics() {
    try {
      const response = await this.fetchWithAuth('http://localhost:4000/api/analytics/combined');
      if (!response || !response.ok) return null;
      return await response.json();
    } catch (err) {
      return null;
    }
  }

  static async getPlatformAccounts() {
    try {
      const response = await this.fetchWithAuth('http://localhost:4000/api/platforms/accounts');
      if (!response || !response.ok) return [];
      return await response.json();
    } catch (err) {
      return [];
    }
  }
}

// Check if logged in on page load
if (!location.pathname.includes('auth.html') && !location.pathname.includes('landing') && !AuthManager.isLoggedIn()) {
  window.location.href = 'auth.html';
}
