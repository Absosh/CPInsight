const app = require('./app');
const env = require('./config/env');
const pool = require('./database/pool');
const { redis } = require('./redis/client');

async function start() {
  await pool.query('SELECT 1');

  // Try to connect to Redis in background (optional)
  if (redis.status !== 'ready') {
    redis.connect().catch(() => {
      // Redis connection failed, app will use in-memory fallback
    });
  }

  app.listen(env.port, () => {
    console.log(`CPInsight API listening on port ${env.port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start CPInsight API', error);
  process.exit(1);
});