class RetrievalCache {
  constructor({ ttlMs = 300000, maxEntries = 1000 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  key({ userId, source, version = 1 }) {
    return `${userId}:${source.name}:${source.limit || 0}:${source.requiredConfidence || 0}:${version}`;
  }

  get(input) {
    const key = this.key(input);
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return entry.value;
  }

  set(input, value) {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      this.entries.delete(oldest);
    }
    this.entries.set(this.key(input), {
      value,
      expiresAt: Date.now() + this.ttlMs,
      createdAt: new Date().toISOString()
    });
  }

  invalidate(predicate = null) {
    if (!predicate) {
      this.entries.clear();
      return;
    }
    for (const [key, entry] of this.entries.entries()) {
      if (predicate(key, entry)) this.entries.delete(key);
    }
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      entries: this.entries.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? Number((this.hits / total).toFixed(4)) : 0,
      ttlMs: this.ttlMs
    };
  }
}

module.exports = { RetrievalCache };

