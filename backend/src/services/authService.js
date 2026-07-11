const bcrypt = require('bcrypt');
const crypto = require('crypto');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const HttpError = require('../utils/httpError');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshExpiryDate
} = require('../utils/token');

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function issueTokens(user, context, existingFamilyId) {
  const accessToken = signAccessToken(user);
  const { token: refreshToken, familyId } = signRefreshToken(user, existingFamilyId || crypto.randomUUID());
  const row = await refreshTokenRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId,
    userAgent: context.userAgent,
    ipAddress: context.ip,
    expiresAt: refreshExpiryDate()
  });

  return { accessToken, refreshToken, refreshTokenId: row.id };
}

async function register(payload, context) {
  const existing = await userRepository.findByEmail(payload.email);
  if (existing) throw new HttpError(409, 'Email is already registered');

  const passwordHash = await bcrypt.hash(payload.password, env.bcryptRounds);
  const user = await userRepository.createUser({
    username: payload.username,
    email: payload.email,
    passwordHash
  });
  const tokens = await issueTokens(user, context);
  return { user: publicUser(user), ...tokens };
}

async function login(payload, context) {
  const user = await userRepository.findByEmail(payload.email);
  if (!user) throw new HttpError(401, 'Invalid email or password');

  const isValid = await bcrypt.compare(payload.password, user.passwordHash);
  if (!isValid) throw new HttpError(401, 'Invalid email or password');

  const tokens = await issueTokens(user, context);
  return { user: publicUser(user), ...tokens };
}

async function refresh(refreshToken, context) {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (_error) {
    throw new HttpError(401, 'Invalid refresh token');
  }

  const current = await refreshTokenRepository.findActiveByHash(hashToken(refreshToken));
  if (!current) throw new HttpError(401, 'Refresh token is expired or revoked');

  const user = await userRepository.findById(decoded.sub);
  if (!user) throw new HttpError(401, 'User no longer exists');

  const tokens = await issueTokens(user, context, decoded.familyId);
  await refreshTokenRepository.revokeToken(current.id, tokens.refreshTokenId);

  return { user: publicUser(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

async function logout(refreshToken) {
  if (refreshToken) {
    await refreshTokenRepository.revokeByHash(hashToken(refreshToken));
  }
}

module.exports = { register, login, refresh, logout };
