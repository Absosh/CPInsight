const pool = require('../database/pool');

async function upsertAccount({ userId, platform, handle, handleNormalized, profileUrl, metadata }) {
  const result = await pool.query(
    `INSERT INTO platform_accounts
      (user_id, platform, handle, handle_normalized, profile_url, metadata, sync_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (user_id, platform)
     DO UPDATE SET
       handle = EXCLUDED.handle,
       handle_normalized = EXCLUDED.handle_normalized,
       profile_url = EXCLUDED.profile_url,
       metadata = EXCLUDED.metadata,
       sync_status = 'pending'
     RETURNING *`,
    [userId, platform, handle, handleNormalized, profileUrl, JSON.stringify(metadata || {})]
  );
  return result.rows[0];
}

async function listAccounts(userId) {
  const result = await pool.query(
    `SELECT id, platform, handle, profile_url, rating, max_rating, rank_label,
            metadata, last_synced_at, sync_status, created_at, updated_at
     FROM platform_accounts
     WHERE user_id = $1
     ORDER BY platform`,
    [userId]
  );
  return result.rows;
}

async function findAccount(userId, platform) {
  const result = await pool.query(
    'SELECT * FROM platform_accounts WHERE user_id = $1 AND platform = $2',
    [userId, platform]
  );
  return result.rows[0] || null;
}

async function deleteAccount(userId, platform) {
  const result = await pool.query(
    'DELETE FROM platform_accounts WHERE user_id = $1 AND platform = $2 RETURNING id',
    [userId, platform]
  );
  return result.rowCount > 0;
}

module.exports = { upsertAccount, listAccounts, findAccount, deleteAccount };
