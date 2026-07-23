class RuntimeRateLimiter {
  constructor({ perUser = 60, perProvider = 120, perModel = 120, windowMs = 60000 } = {}) {
    this.perUser = perUser;
    this.perProvider = perProvider;
    this.perModel = perModel;
    this.windowMs = windowMs;
    this.buckets = new Map();
  }

  consume(key, limit) {
    const now = Date.now();
    const bucket = this.buckets.get(key) || { count: 0, resetAt: now + this.windowMs };
    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + this.windowMs;
    }
    if (bucket.count >= limit) return { allowed: false, resetAt: bucket.resetAt, queue: true };
    bucket.count += 1;
    this.buckets.set(key, bucket);
    return { allowed: true, resetAt: bucket.resetAt, remaining: limit - bucket.count };
  }

  check({ userId, provider, model }) {
    const checks = [
      this.consume(`user:${userId}`, this.perUser),
      this.consume(`provider:${provider}`, this.perProvider),
      this.consume(`model:${provider}:${model}`, this.perModel)
    ];
    const denied = checks.find((item) => !item.allowed);
    return denied || { allowed: true };
  }
}

module.exports = { RuntimeRateLimiter };

