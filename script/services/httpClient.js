// HTTP Client with JWT interceptor
class HttpClient {
  constructor() {
    this.baseURL = this.resolveBaseURL();
    this.timeout = 10000;
  }

  resolveBaseURL() {
    const configured = window.CPINSIGHT_API_BASE || localStorage.getItem('cpinsight:apiBaseUrl');
    if (configured) return configured.replace(/\/$/, '');
    const isLiveServer = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      && window.location.port === '5500';
    if (isLiveServer) return 'http://localhost:4000/api';
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      return `${window.location.origin}/api`;
    }
    return 'http://localhost:4000/api';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const { timeoutMs, ...fetchOptions } = options;
    const headers = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers
    };

    const token = localStorage.getItem('accessToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await Promise.race([
        fetch(url, {
          ...fetchOptions,
          headers
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeoutMs || this.timeout)
        )
      ]);

      // Handle 401 - try to refresh token
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry request with new token
          return this.request(endpoint, options);
        } else {
          // Refresh failed, logout user
          localStorage.removeItem('cpinsight:lastCompareHandle');
          window.dispatchEvent(new CustomEvent('auth:logout'));
          return null;
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

     if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`Request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint, data) {
    return this.request(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined
    });
  }
}

const httpClient = new HttpClient();
window.httpClient = httpClient;
