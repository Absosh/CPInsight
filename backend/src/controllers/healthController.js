const pool = require('../database/pool');
const { redis } = require('../redis/client');

async function health(_req, res) {
  res.json({ status: 'ok', service: 'cpinsight-backend' });
}

async function readiness(_req, res) {
  await pool.query('SELECT 1');
  if (redis.status !== 'ready') await redis.connect();
  await redis.ping();
  res.json({ status: 'ready' });
}

module.exports = { health, readiness };
