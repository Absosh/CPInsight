const app = require('./app');
const env = require('./config/env');
const pool = require('./database/pool');
const { redis } = require('./redis/client');
const { OutboxRelayWorker } = require('./domain-events/outbox/relayWorker');
const { OutboxRetryPolicy } = require('./domain-events/outbox/retryPolicy');

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
    relay = new OutboxRelayWorker({
      batchSize: env.outboxRelay.batchSize,
      leaseMs: env.outboxRelay.leaseMs,
      pollIntervalMs: env.outboxRelay.pollIntervalMs,
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
