export class RetryPolicy {
  constructor({
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    jitterRatio = 0.2,
    random = Math.random
  } = {}) {
    this.initialDelayMs = initialDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.jitterRatio = jitterRatio;
    this.random = random;
  }

  nextDelayMs(attemptCount, retryAfterMs = null) {
    if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
      return Math.min(retryAfterMs, this.maxDelayMs);
    }
    const exponent = Math.max(0, Number(attemptCount || 0));
    const base = Math.min(this.initialDelayMs * (2 ** exponent), this.maxDelayMs);
    const jitterWindow = base * this.jitterRatio;
    const jitter = Math.round((this.random() * 2 - 1) * jitterWindow);
    return Math.max(this.initialDelayMs, Math.min(base + jitter, this.maxDelayMs));
  }

  nextRetryAt(attemptCount, retryAfterMs = null, now = Date.now()) {
    return now + this.nextDelayMs(attemptCount, retryAfterMs);
  }
}
