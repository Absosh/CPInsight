const DEFAULT_REVIEW_RETRY_POLICY = Object.freeze({
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterRatio: 0.2
});

class ReviewRetryPolicy {
  constructor({
    baseDelayMs = DEFAULT_REVIEW_RETRY_POLICY.baseDelayMs,
    maxDelayMs = DEFAULT_REVIEW_RETRY_POLICY.maxDelayMs,
    jitterRatio = DEFAULT_REVIEW_RETRY_POLICY.jitterRatio,
    random = Math.random
  } = {}) {
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.jitterRatio = jitterRatio;
    this.random = random;
  }

  delayMs(attempt) {
    const exponent = Math.max(0, attempt - 1);
    const base = Math.min(this.maxDelayMs, this.baseDelayMs * (2 ** exponent));
    const jitter = base * this.jitterRatio * this.random();
    return Math.round(Math.min(this.maxDelayMs, base + jitter));
  }

  nextAttemptAt(attempt, now = Date.now()) {
    return new Date(now + this.delayMs(attempt)).toISOString();
  }
}

module.exports = { ReviewRetryPolicy, DEFAULT_REVIEW_RETRY_POLICY };
