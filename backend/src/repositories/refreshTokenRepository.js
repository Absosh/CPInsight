const pool = require('../database/pool');

async function createRefreshToken({ userId, tokenHash, familyId, userAgent, ipAddress, expiresAt }) {
  const result = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, tokenHash, familyId, userAgent, ipAddress, expiresAt]
  );
  return result.rows[0];
}

async function findActiveByHash(tokenHash) {
  const result = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function revokeToken(id, replacedByTokenId = null) {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(), replaced_by_token_id = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [id, replacedByTokenId]
  );
}

async function revokeByHash(tokenHash) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
    [tokenHash]
  );
}

module.exports = { createRefreshToken, findActiveByHash, revokeToken, revokeByHash };
