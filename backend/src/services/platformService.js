const platformRepository = require('../repositories/platformRepository');
const pool = require('../database/pool');
const { delByPattern } = require('../redis/client');
const { normalizeHandle } = require('../utils/normalize');
const HttpError = require('../utils/httpError');
const syncService = require('./syncService');

function profileUrl(platform, handle) {
  if (platform === 'codeforces') return `https://codeforces.com/profile/${encodeURIComponent(handle)}`;
  if (platform === 'codechef') return `https://www.codechef.com/users/${encodeURIComponent(handle)}`;
  if (platform === 'leetcode') return `https://leetcode.com/u/${encodeURIComponent(handle)}/`;
  if (platform === 'atcoder') return `https://atcoder.jp/users/${encodeURIComponent(handle)}`;
  return null;
}

async function connect(userId, payload) {
  const handleNormalized = normalizeHandle(payload.handle);
  if (!handleNormalized) throw new HttpError(400, 'Handle is required', null, 'INVALID_HANDLE');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const account = await platformRepository.upsertAccount({
      userId,
      platform: payload.platform,
      handle: payload.handle.trim(),
      handleNormalized,
      profileUrl: profileUrl(payload.platform, payload.handle.trim()),
      metadata: payload.platform === 'leetcode'
        ? { source: 'user_connected', leetcodeSyncMode: 'authenticated_extension' }
        : { source: 'user_connected' }
    }, client);

    if (payload.platform === 'leetcode') {
      const pending = await client.query(
        `UPDATE platform_accounts
         SET sync_status = 'pending_extension_upload'
         WHERE id = $1
         RETURNING *`,
        [account.id]
      );
      Object.assign(account, pending.rows[0]);
    }

    const syncResult = payload.platform === 'leetcode'
      ? {
        platform: 'leetcode',
        handle: account.handle,
        status: 'pending_extension_upload',
        message: 'LeetCode connected. Run the CPInsight browser extension to sync authenticated data.'
      }
      : await syncService.syncPlatformAccount(userId, account, {
        db: client,
        throwOnError: true
      });

    await client.query('COMMIT');

    await Promise.all([
      delByPattern(`profile:${userId}`),
      delByPattern(`analytics:${userId}:*`)
    ]).catch(() => {});

    return {
      ...account,
      sync: syncResult
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw normalizeConnectError(error, payload.platform);
  } finally {
    client.release();
  }
}

function normalizeConnectError(error, platform) {
  if (error instanceof HttpError) return error;

  const message = error.message || 'Platform connection failed';
  if (/not found|invalid|handle/i.test(message)) {
    return new HttpError(400, message, { platform }, 'INVALID_HANDLE');
  }

  if (/unavailable|rejected|timeout|network|ENOTFOUND|ECONN|429|rate/i.test(message)) {
    return new HttpError(503, message, { platform }, 'PLATFORM_UNAVAILABLE');
  }

  if (error.code && /^23/.test(error.code)) {
    return new HttpError(500, message, { platform, databaseCode: error.code }, 'DATABASE_ERROR');
  }

  return new HttpError(502, message, { platform }, 'SYNC_FAILED');
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
