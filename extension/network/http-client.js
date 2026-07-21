import { AppConfig } from '../config/defaults.js';
import { ExtensionError, ErrorKind } from '../utils/errors.js';

export class HttpClient {
  constructor({ baseUrl = AppConfig.api.baseUrl, timeoutMs = AppConfig.api.timeoutMs } = {}) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async request(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || this.timeoutMs);

    try {
      const response = await fetch(this.resolveUrl(path), {
        ...options,
        signal: options.signal || controller.signal,
        headers: {
          'content-type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new ExtensionError(`Request failed with HTTP ${response.status}`, {
          kind: response.status === 401 ? ErrorKind.AUTHENTICATION : ErrorKind.NETWORK,
          metadata: { status: response.status, path }
        });
      }

      if (response.status === 204) return null;
      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ExtensionError('Request timed out', { kind: ErrorKind.NETWORK, cause: error, metadata: { path } });
      }
      if (error instanceof ExtensionError) throw error;
      throw new ExtensionError('Network request failed', { kind: ErrorKind.NETWORK, cause: error, metadata: { path } });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  resolveUrl(path) {
    if (/^https?:\/\//.test(path)) return path;
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
