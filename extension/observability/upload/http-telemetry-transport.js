import { AppConfig } from '../../config/defaults.js';

export class TelemetryUploadError extends Error {
  constructor(message, { status = null, retryAfterMs = null, retryable = true, acknowledgedEventIds = [] } = {}) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.retryable = retryable;
    this.acknowledgedEventIds = acknowledgedEventIds;
  }
}

function retryAfterMs(header) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

export class HttpTelemetryTransport {
  constructor({
    tokenProvider,
    path = AppConfig.telemetryUpload.path,
    timeoutMs = AppConfig.telemetryUpload.requestTimeoutMs,
    logger
  } = {}) {
    this.tokenProvider = tokenProvider;
    this.path = path;
    this.timeoutMs = timeoutMs;
    this.logger = logger;
  }

  async upload(batch) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new TelemetryUploadError('Browser is offline', { retryable: true });
    }
    return this.uploadWithToken(batch, await this.tokenProvider.getAccessToken(), true);
  }

  async uploadWithToken(batch, accessToken, allowRefresh) {
    if (!accessToken) {
      const refreshed = allowRefresh ? await this.tokenProvider.refreshAccessToken() : null;
      if (refreshed) return this.uploadWithToken(batch, refreshed, false);
      throw new TelemetryUploadError('Telemetry upload requires authentication', { status: 401, retryable: true });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await fetch(`${AppConfig.api.baseUrl}${this.path}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
          'idempotency-key': batch.batchId
        },
        body: JSON.stringify(batch)
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new TelemetryUploadError('Telemetry upload timed out', { retryable: true });
      }
      throw new TelemetryUploadError('Telemetry upload network failure', { retryable: true });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401 && allowRefresh) {
      const refreshed = await this.tokenProvider.refreshAccessToken();
      if (refreshed) return this.uploadWithToken(batch, refreshed, false);
    }

    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      throw new TelemetryUploadError(payload?.error?.message || `Telemetry upload failed with HTTP ${response.status}`, {
        status: response.status,
        retryAfterMs: retryAfterMs(response.headers.get('retry-after')),
        retryable: response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500,
        acknowledgedEventIds: payload?.acknowledgedEventIds || []
      });
    }

    return payload;
  }
}
