const DEFAULT_RETRY_POLICY = Object.freeze({
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  jitterRatio: 0.2,
  maxAttempts: 5
});

class OutboxRetryPolicy {
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_RETRY_POLICY,
      ...config
    };
  }

  nextDelayMs(retryCount) {
    const exponential = this.config.initialDelayMs * (2 ** Math.max(0, retryCount));
    const capped = Math.min(this.config.maxDelayMs, exponential);
    const jitter = capped * this.config.jitterRatio * Math.random();
    return Math.floor(capped + jitter);
  }

  shouldDeadLetter(retryCount) {
    return retryCount >= this.config.maxAttempts;
  }
}

module.exports = { OutboxRetryPolicy, DEFAULT_RETRY_POLICY };
