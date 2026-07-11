const pool = require('../database/pool');

async function getFreshCache(userId, cacheKey, windowKey = 'all') {
  const result = await pool.query(
    `SELECT payload, computed_at, expires_at
     FROM analytics_cache
     WHERE user_id = $1 AND cache_key = $2 AND window_key = $3 AND expires_at > NOW()`,
    [userId, cacheKey, windowKey]
  );
  return result.rows[0] || null;
}

async function upsertCache({ userId, platform, cacheKey, windowKey = 'all', payload, ttlMinutes }) {
  const result = await pool.query(
    `INSERT INTO analytics_cache (user_id, platform, cache_key, window_key, payload, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' minutes')::interval)
     ON CONFLICT (user_id, cache_key, window_key)
     DO UPDATE SET payload = EXCLUDED.payload, computed_at = NOW(), expires_at = EXCLUDED.expires_at
     RETURNING payload, computed_at, expires_at`,
    [userId, platform, cacheKey, windowKey, JSON.stringify(payload), ttlMinutes]
  );
  return result.rows[0];
}

async function getPlatformFacts(userId, platform) {
  const accounts = await pool.query(
    'SELECT * FROM platform_accounts WHERE user_id = $1 AND platform = $2',
    [userId, platform]
  );

  if (accounts.rowCount === 0) {
    return { account: null, contests: [], submissions: [] };
  }

  const account = accounts.rows[0];
  const [contests, submissions] = await Promise.all([
    pool.query(
      'SELECT * FROM contest_history WHERE platform_account_id = $1 ORDER BY participated_at ASC',
      [account.id]
    ),
    pool.query(
      'SELECT * FROM submission_history WHERE platform_account_id = $1 ORDER BY submitted_at ASC',
      [account.id]
    )
  ]);

  return { account, contests: contests.rows, submissions: submissions.rows };
}

async function getAllFacts(userId) {
  const result = await pool.query(
    `SELECT pa.platform, pa.handle, ch.rating_after, ch.participated_at,
            sh.problem_key, sh.problem_name, sh.verdict, sh.tags, sh.submitted_at
     FROM platform_accounts pa
     LEFT JOIN contest_history ch ON ch.platform_account_id = pa.id
     LEFT JOIN submission_history sh ON sh.platform_account_id = pa.id
     WHERE pa.user_id = $1`,
    [userId]
  );
  return result.rows;
}

module.exports = { getFreshCache, upsertCache, getPlatformFacts, getAllFacts };
