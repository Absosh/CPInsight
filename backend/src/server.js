const app = require('./app');
const env = require('./config/env');
const pool = require('./database/pool');
const { redis } = require('./redis/client');
const { OutboxRelayWorker } = require('./domain-events/outbox/relayWorker');
const { OutboxRetryPolicy } = require('./domain-events/outbox/retryPolicy');
const { createDomainEventBus } = require('./domain-events/factory');
const { RedisEventConnectionManager } = require('./redis/events/connectionManager');
const { RedisEventPublisher } = require('./redis/events/publisher');

async function start() {
  await pool.query('SELECT 1');
  let relay = null;

  // Try to connect to Redis in background (optional)
  if (redis.status !== 'ready') {
    redis.connect().catch(() => {
      // Redis connection failed, app will use in-memory fallback
    });
  }

  if (env.outboxRelay.enabled) {
    let eventBus = undefined;
    if (env.redisEvents.enabled) {
      const redisEventConnection = new RedisEventConnectionManager({ redis, logger: console });
      const redisPublisher = new RedisEventPublisher({
        connectionManager: redisEventConnection,
        maxStreamLength: env.redisEvents.maxStreamLength,
        logger: console
      });
      eventBus = createDomainEventBus({ redisPublisher, logger: console });
    }
    relay = new OutboxRelayWorker({
      eventBus,
      batchSize: env.outboxRelay.batchSize,
      leaseMs: env.outboxRelay.leaseMs,
      pollIntervalMs: env.outboxRelay.pollIntervalMs,
      requiredSubscriberIds: env.redisEvents.enabled ? ['redis-event-publisher'] : [],
      retryPolicy: new OutboxRetryPolicy({ maxAttempts: env.outboxRelay.maxAttempts }),
      logger: console
    });
    relay.start();
  }

  const server = app.listen(env.port, () => {
    console.log(`CPInsight API listening on port ${env.port}`);
  });

  async function shutdown(signal) {
    console.log(`Received ${signal}; shutting down CPInsight API`);
    relay?.stop();
    server.close(async () => {
      await Promise.allSettled([
        pool.end(),
        redis.quit()
      ]);
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('Failed to start CPInsight API', error);
  process.exit(1);
});
