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
      p.display_name, p.timezone, p.country, p.college_id,
      p.avatar_url, p.avatar_thumbnail, p.avatar_updated_at, p.preferences
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
     SET display_name = CASE WHEN $2 THEN $3 ELSE display_name END,
         timezone = CASE WHEN $4 THEN $5 ELSE timezone END,
         country = CASE WHEN $6 THEN $7 ELSE country END,
         college_id = CASE WHEN $8 THEN $9 ELSE college_id END,
         preferences = CASE WHEN $10 THEN $11 ELSE preferences END
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      Object.prototype.hasOwnProperty.call(profile, 'displayName'),
      profile.displayName,
      Object.prototype.hasOwnProperty.call(profile, 'timezone'),
      profile.timezone,
      Object.prototype.hasOwnProperty.call(profile, 'country'),
      profile.country,
      Object.prototype.hasOwnProperty.call(profile, 'collegeId'),
      profile.collegeId,
      Object.prototype.hasOwnProperty.call(profile, 'preferences'),
      profile.preferences ? JSON.stringify(profile.preferences) : null
    ]
  );
  return result.rows[0];
}

async function updateAvatar(userId, avatar) {
  const result = await pool.query(
    `UPDATE user_profiles
     SET avatar_url = $2,
         avatar_thumbnail = $3,
         avatar_updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId, avatar.avatarUrl, avatar.avatarThumbnail]
  );
  return result.rows[0];
}

async function deleteAvatar(userId) {
  const result = await pool.query(
    `UPDATE user_profiles
     SET avatar_url = NULL,
         avatar_thumbnail = NULL,
         avatar_updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  getProfile,
  updateProfile,
  updateAvatar,
  deleteAvatar
};
