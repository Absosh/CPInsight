const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config();

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  API_BASE_URL: Joi.string().uri().default('http://localhost:4000'),
  FRONTEND_ORIGIN: Joi.string().allow('').default(''),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: Joi.number().integer().min(1).max(365).default(30),
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),
  CODEFORCES_API_BASE: Joi.string().uri().default('https://codeforces.com/api'),
  LEETCODE_GRAPHQL_ENDPOINT: Joi.string().uri().default('https://leetcode.com/graphql'),
  CODECHEF_BASE_URL: Joi.string().uri().default('https://www.codechef.com'),
  OUTBOX_RELAY_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  OUTBOX_RELAY_BATCH_SIZE: Joi.number().integer().min(1).max(1000).default(100),
  OUTBOX_RELAY_LEASE_MS: Joi.number().integer().min(1000).max(300000).default(30000),
  OUTBOX_RELAY_POLL_INTERVAL_MS: Joi.number().integer().min(100).max(60000).default(1000),
  OUTBOX_RELAY_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  REDIS_EVENT_DISTRIBUTION_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  REDIS_EVENT_STREAM_MAX_LENGTH: Joi.number().integer().min(1000).max(10000000).default(1000000),
  REALTIME_GATEWAY_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  REALTIME_GATEWAY_PATH: Joi.string().default('/realtime'),
  REALTIME_GATEWAY_GROUP: Joi.string().default('websocket-gateway'),
  REALTIME_GATEWAY_MAX_QUEUE_SIZE: Joi.number().integer().min(1).max(10000).default(1000),
  REALTIME_GATEWAY_IDLE_TIMEOUT_MS: Joi.number().integer().min(5000).max(300000).default(60000),
  REALTIME_GATEWAY_BATCH_SIZE: Joi.number().integer().min(1).max(1000).default(100)
}).unknown(true);

const { value, error } = schema.validate(process.env, { abortEarly: false });

if (error) {
  throw new Error(`Invalid environment: ${error.details.map((item) => item.message).join(', ')}`);
}

const frontendOrigins = value.FRONTEND_ORIGIN
  ? value.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

module.exports = {
  env: value.NODE_ENV,
  port: value.PORT,
  apiBaseUrl: value.API_BASE_URL,
  frontendOrigins,
  databaseUrl: value.DATABASE_URL,
  redisUrl: value.REDIS_URL,
  jwt: {
    accessSecret: value.JWT_ACCESS_SECRET,
    refreshSecret: value.JWT_REFRESH_SECRET,
    accessTtl: value.JWT_ACCESS_TTL,
    refreshTtlDays: value.JWT_REFRESH_TTL_DAYS
  },
  bcryptRounds: value.BCRYPT_ROUNDS,
  platforms: {
    codeforcesApiBase: value.CODEFORCES_API_BASE,
    leetcodeGraphqlEndpoint: value.LEETCODE_GRAPHQL_ENDPOINT,
    codechefBaseUrl: value.CODECHEF_BASE_URL
  },
  outboxRelay: {
    enabled: value.OUTBOX_RELAY_ENABLED,
    batchSize: value.OUTBOX_RELAY_BATCH_SIZE,
    leaseMs: value.OUTBOX_RELAY_LEASE_MS,
    pollIntervalMs: value.OUTBOX_RELAY_POLL_INTERVAL_MS,
    maxAttempts: value.OUTBOX_RELAY_MAX_ATTEMPTS
  },
  redisEvents: {
    enabled: value.REDIS_EVENT_DISTRIBUTION_ENABLED,
    maxStreamLength: value.REDIS_EVENT_STREAM_MAX_LENGTH
  },
  realtimeGateway: {
    enabled: value.REALTIME_GATEWAY_ENABLED,
    path: value.REALTIME_GATEWAY_PATH,
    group: value.REALTIME_GATEWAY_GROUP,
    maxQueueSize: value.REALTIME_GATEWAY_MAX_QUEUE_SIZE,
    idleTimeoutMs: value.REALTIME_GATEWAY_IDLE_TIMEOUT_MS,
    batchSize: value.REALTIME_GATEWAY_BATCH_SIZE
  }
};
