const Redis = require('ioredis');
const env = require('../config/env');

// In-memory fallback cache for when Redis is unavailable
const memoryCache = new Map();

let redisAvailable = false;

const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 0,
  enableOfflineQueue: false,
  retryStrategy: () => null,
  socket: {
    reconnectStrategy: () => null
  }
});

redis.connect().catch((err) => {
  redisAvailable = false;

  console.warn(
    '⚠ Redis unavailable, falling back to in-memory cache:',
    err.message
  );
});

let hasLoggedError = false;

redis.on('error', (err) => {
  if (!hasLoggedError && env.env !== 'test') {
    console.error(
      'Redis connection failed:',
      err.message
    );
    hasLoggedError = true;
  }

  redisAvailable = false;
});

redis.on('connect', () => {
  redisAvailable = true;
  console.log('✓ Redis connected successfully');
});

redis.on('ready', async () => {
  redisAvailable = true;

  try {
    const pong = await redis.ping();
    console.log(`✓ Redis ready (${pong})`);
  } catch {
    redisAvailable = false;
  }
});

async function getJson(key) {
  if (redisAvailable) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch {
      // Fall through to memory cache
    }
  }
  return memoryCache.get(key) || null;
}

async function setJson(key, value, ttlSeconds) {
  if (redisAvailable) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch {
      // Fall through to memory cache
    }
  }
  // Store in memory cache with TTL
  memoryCache.set(key, value);
  if (ttlSeconds && ttlSeconds > 0) {
    setTimeout(() => memoryCache.delete(key), ttlSeconds * 1000);
  }
}

async function delByPattern(pattern) {
  if (redisAvailable) {
    try {
      const stream = redis.scanStream({ match: pattern, count: 100 });
      const keys = [];
      for await (const chunk of stream) {
        keys.push(...chunk);
        if (keys.length >= 500) {
          await redis.del(...keys.splice(0, keys.length));
        }
      }
      if (keys.length > 0) await redis.del(...keys);
      return;
    } catch {
      // Fall through to memory cache
    }
  }
  // Clear matching keys from memory cache
  const patternRegex = new RegExp(pattern.replace(/\*/g, '.*'));
  for (const [key] of memoryCache) {
    if (patternRegex.test(key)) {
      memoryCache.delete(key);
    }
  }
}

async function redisHealth() {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

module.exports = { redis, getJson, setJson, delByPattern, redisHealth };
