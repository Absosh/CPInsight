const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl, issuer: 'cpinsight-api' }
  );
}

function signRefreshToken(user, familyId = crypto.randomUUID()) {
  return {
    familyId,
    token: jwt.sign(
      { sub: user.id, familyId, jti: crypto.randomUUID() },
      env.jwt.refreshSecret,
      { expiresIn: `${env.jwt.refreshTtlDays}d`, issuer: 'cpinsight-api' }
    )
  };
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret, { issuer: 'cpinsight-api' });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret, { issuer: 'cpinsight-api' });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.jwt.refreshTtlDays);
  return expiresAt;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  refreshExpiryDate
};
