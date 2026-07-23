const pool = require('../database/pool');
const { redis } = require('../redis/client');
const { ContestReviewWorker } = require('../review-worker/contestReviewWorker');

async function main() {
  await pool.query('SELECT 1');
  if (redis.status !== 'ready') {
    redis.connect().catch(() => {});
  }
  const worker = new ContestReviewWorker({ logger: console });
  worker.start();
  console.log('CPInsight contest review worker started');

  async function shutdown(signal) {
    console.log(`Received ${signal}; stopping contest review worker`);
    await worker.stop();
    await Promise.allSettled([pool.end(), redis.quit()]);
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start contest review worker', error);
    process.exit(1);
  });
}

module.exports = { main };
