const platformRepository = require('../repositories/platformRepository');
const { delByPattern } = require('../redis/client');
const { normalizeHandle } = require('../utils/normalize');
const HttpError = require('../utils/httpError');

function profileUrl(platform, handle) {
  if (platform === 'codeforces') return `https://codeforces.com/profile/${encodeURIComponent(handle)}`;
  if (platform === 'codechef') return `https://www.codechef.com/users/${encodeURIComponent(handle)}`;
  if (platform === 'leetcode') return `https://leetcode.com/u/${encodeURIComponent(handle)}/`;
  if (platform === 'atcoder') return `https://atcoder.jp/users/${encodeURIComponent(handle)}`;
  return null;
}

async function connect(userId, payload) {
  const handleNormalized = normalizeHandle(payload.handle);
  if (!handleNormalized) throw new HttpError(400, 'Handle is required');

  const account = await platformRepository.upsertAccount({
    userId,
    platform: payload.platform,
    handle: payload.handle.trim(),
    handleNormalized,
    profileUrl: profileUrl(payload.platform, payload.handle.trim()),
    metadata: { source: 'user_connected' }
  });

  await Promise.all([
    delByPattern(`profile:${userId}`),
    delByPattern(`analytics:${userId}:*`)
  ]).catch(() => {});

  return account;
}

async function disconnect(userId, platform) {
  const deleted = await platformRepository.deleteAccount(userId, platform);
  if (!deleted) throw new HttpError(404, 'Platform account not found');
  await Promise.all([
    delByPattern(`profile:${userId}`),
    delByPattern(`analytics:${userId}:*`)
  ]).catch(() => {});
}

async function list(userId) {
  return platformRepository.listAccounts(userId);
}

module.exports = { connect, disconnect, list };
