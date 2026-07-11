const pool = require('../database/pool');

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createUser({ username, email, passwordHash }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, email.toLowerCase(), passwordHash]
    );
    await client.query('INSERT INTO user_profiles (user_id, display_name) VALUES ($1, $2)', [
      userResult.rows[0].id,
      username
    ]);
    await client.query('COMMIT');
    return mapUser(userResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  return mapUser(result.rows[0]);
}

async function findById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return mapUser(result.rows[0]);
}

async function getProfile(userId) {
  const result = await pool.query(
    `SELECT
      u.id, u.username, u.email, u.created_at, u.updated_at,
      p.display_name, p.timezone, p.country, p.avatar_url, p.preferences
     FROM users u
     JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function updateProfile(userId, profile) {
  const result = await pool.query(
    `UPDATE user_profiles
     SET display_name = COALESCE($2, display_name),
         timezone = COALESCE($3, timezone),
         country = COALESCE($4, country),
         avatar_url = COALESCE($5, avatar_url),
         preferences = COALESCE($6, preferences)
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      profile.displayName,
      profile.timezone,
      profile.country,
      profile.avatarUrl,
      profile.preferences ? JSON.stringify(profile.preferences) : null
    ]
  );
  return result.rows[0];
}

module.exports = { createUser, findByEmail, findById, getProfile, updateProfile };
