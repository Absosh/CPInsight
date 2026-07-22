const Redis = require('ioredis');
const env = require('../../config/env');

class RedisEventConnectionManager {
  constructor({ redisUrl = env.redisUrl, logger = null, redis = null } = {}) {
    this.redisUrl = redisUrl;
    this.logger = logger;
    this.redis = redis;
    this.owned = !redis;
    this.health = {
      connected: false,
      reconnects: 0,
      lastHeartbeatAt: null,
      lastError: null
    };
  }

  client() {
    if (!this.redis) {
      this.redis = new Redis(this.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        retryStrategy: (attempt) => Math.min(30000, 1000 * attempt)
      });
      this.redis.on('ready', () => {
        this.health.connected = true;
      });
      this.redis.on('close', () => {
        this.health.connected = false;
        this.health.reconnects += 1;
      });
      this.redis.on('error', (error) => {
        this.health.lastError = error.message;
        this.logger?.warn?.('Redis event transport error', { message: error.message });
      });
    }
    return this.redis;
  }

  async connect() {
    const client = this.client();
    if (client.status === 'ready') return client;
    if (client.status !== 'connecting' && client.status !== 'connect') {
      await client.connect();
    }
    this.health.connected = true;
    return client;
  }

  async heartbeat() {
    const client = await this.connect();
    await client.ping();
    this.health.lastHeartbeatAt = new Date().toISOString();
    return this.snapshotHealth();
  }

  async shutdown() {
    if (this.redis && this.owned) {
      await this.redis.quit();
    }
    this.health.connected = false;
  }

  snapshotHealth() {
    return Object.freeze({ ...this.health });
  }
}

module.exports = { RedisEventConnectionManager };
