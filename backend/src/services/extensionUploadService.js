const pool = require('../database/pool');
const { delByPattern } = require('../redis/client');
const platformRepository = require('../repositories/platformRepository');
const extensionUploadRepository = require('../repositories/extensionUploadRepository');
const analyticsRepository = require('../repositories/analyticsRepository');
const analyticsService = require('./analyticsService');
const HttpError = require('../utils/httpError');
const { normalizeHandle } = require('../utils/normalize');

const EXPECTED_COLLECTOR_VERSION = 'mv3-leetcode-two-stage-v1';

function difficultyRank(difficulty) {
  const normalized = String(difficulty || '').toLowerCase();
  if (normalized === 'easy') return 1;
  if (normalized === 'medium') return 2;
  if (normalized === 'hard') return 3;
  return null;
}

function normalizeDayKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const ms = numeric > 100000000000 ? numeric : numeric * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

function dayCountsFromActivity(activity) {
  const days = activity?.days;
  const counts = {};
  if (Array.isArray(days)) {
    for (const entry of days) {
      const day = normalizeDayKey(entry.date || entry.day || entry.timestamp);
      const count = Number(entry.count || entry.submissions || entry.value || 0);
      if (day && Number.isFinite(count) && count > 0) counts[day] = Math.floor(count);
    }
  } else if (days && typeof days === 'object') {
    for (const [key, value] of Object.entries(days)) {
      const day = normalizeDayKey(key);
      const count = Number(value || 0);
      if (day && Number.isFinite(count) && count > 0) counts[day] = Math.floor(count);
    }
  }
  return counts;
}

function statsByDifficulty(profileData, solvedAnalytics) {
  const stats = {};
  const solvedByDifficulty = profileData?.profile?.solvedByDifficulty || profileData?.profile?.submitStats;
  for (const stat of solvedByDifficulty || []) {
    const key = String(stat.difficulty || '').toLowerCase();
    if (!key) continue;
    stats[key] = {
      count: Number(stat.count || 0),
      submissions: Number(stat.count || 0)
    };
  }
  if (!stats.all && solvedAnalytics?.totalSolved != null) {
    stats.all = { count: Number(solvedAnalytics.totalSolved || 0), submissions: Number(solvedAnalytics.totalSolved || 0) };
  }
  return stats;
}

function questionTimestamp(question, fallback) {
  const raw = question.lastSolvedAt || question.lastSubmittedAt;
  const parsed = raw ? new Date(raw) : null;
  if (parsed && Number.isFinite(parsed.getTime())) return parsed;
  return new Date(fallback);
}

function validatePayload(payload) {
  if (payload.provider !== 'leetcode') throw new HttpError(400, 'Invalid provider', null, 'INVALID_PAYLOAD');
  if (payload.upload?.sessionId !== payload.sessionId) {
    throw new HttpError(400, 'Upload session id mismatch', null, 'INVALID_PAYLOAD');
  }
  if (payload.upload?.collectorVersion !== payload.metadata?.collectorVersion) {
    throw new HttpError(400, 'Collector version mismatch', null, 'INVALID_PAYLOAD');
  }
  if (payload.metadata.collectorVersion !== EXPECTED_COLLECTOR_VERSION) {
    throw new HttpError(409, 'Unsupported LeetCode collector version', {
      expected: EXPECTED_COLLECTOR_VERSION,
      actual: payload.metadata.collectorVersion
    }, 'UNSUPPORTED_COLLECTOR_VERSION');
  }
  const questionDataset = payload.progress?.questionDataset;
  if (!Array.isArray(questionDataset?.questions)) {
    throw new HttpError(400, 'Missing userProgressQuestionList dataset', null, 'INVALID_PAYLOAD');
  }
  if (questionDataset.questions.length !== Number(questionDataset.totalNum || 0)) {
    throw new HttpError(400, 'Incomplete userProgressQuestionList dataset', {
      expected: questionDataset.totalNum,
      received: questionDataset.questions.length
    }, 'INVALID_PAYLOAD');
  }
  const activity = payload.profile?.activity;
  const calendarDays = dayCountsFromActivity(activity);
  const hasCalendarSource = Boolean(activity) &&
    (Object.keys(calendarDays).length > 0 ||
      Number.isFinite(Number(activity.totalActiveDays)) ||
      Number.isFinite(Number(activity.totalSubmissions)));
  if (!hasCalendarSource) {
    throw new HttpError(400, 'Missing mandatory userProfileCalendar dataset', null, 'INVALID_PAYLOAD');
  }
}

async function persistQuestions(db, accountId, questions, fallbackTimestamp) {
  await db.query('DELETE FROM submission_history WHERE platform_account_id = $1', [accountId]);

  for (const question of questions) {
    const slug = question.slug || question.titleSlug || question.frontendId || question.questionId;
    if (!slug) continue;
    const externalId = `leetcode-question-${question.questionId || question.frontendId || slug}`;
    const topics = (question.topics || question.topicTags || [])
      .map((topic) => topic.name || topic.slug || topic)
      .filter(Boolean);

    await db.query(
      `INSERT INTO submission_history
         (platform_account_id, platform, external_submission_id, problem_key, problem_name,
          verdict, submitted_at, tags, difficulty, metadata)
       VALUES ($1, 'leetcode', $2, $3, $4, 'AC', $5, $6, $7, $8)
       ON CONFLICT (platform_account_id, external_submission_id)
       DO UPDATE SET
         problem_key = EXCLUDED.problem_key,
         problem_name = EXCLUDED.problem_name,
         verdict = EXCLUDED.verdict,
         submitted_at = EXCLUDED.submitted_at,
         tags = EXCLUDED.tags,
         difficulty = EXCLUDED.difficulty,
         metadata = EXCLUDED.metadata`,
      [
        accountId,
        externalId,
        slug,
        question.title || question.translatedTitle || slug,
        questionTimestamp(question, fallbackTimestamp),
        topics,
        difficultyRank(question.difficulty),
        JSON.stringify({
          frontendId: question.frontendId || null,
          questionId: question.questionId || null,
          difficulty: question.difficulty || null,
          latestResult: question.latestResult || question.lastResult || null,
          submissionCount: Number(question.submissionCount || question.numSubmitted || 1),
          solvedStatus: question.solvedStatus || question.questionStatus || null,
          source: 'leetcode_extension'
        })
      ]
    );
  }
}

async function persistLeetCodeCollection(userId, payload, headers = {}) {
  validatePayload(payload);

  const uploadedHandle = payload.profile?.profile?.username ||
    payload.profile?.currentUser?.username ||
    payload.username;
  const normalizedUploadHandle = normalizeHandle(uploadedHandle);
  const account = await platformRepository.findAccount(userId, 'leetcode');
  if (!account) throw new HttpError(409, 'LeetCode account is not connected', null, 'PLATFORM_NOT_CONNECTED');
  if (normalizeHandle(account.handle) !== normalizedUploadHandle) {
    throw new HttpError(409, 'Uploaded LeetCode dataset does not match connected account', {
      connectedHandle: account.handle,
      uploadedHandle
    }, 'ACCOUNT_MISMATCH');
  }

  const existing = await extensionUploadRepository.findLeetCodeUploadBySessionId(payload.sessionId);
  if (existing) {
    if (
      existing.user_id !== userId ||
      existing.platform_account_id !== account.id ||
      existing.payload_hash !== payload.metadata.payloadHash ||
      existing.collector_version !== payload.metadata.collectorVersion
    ) {
      throw new HttpError(409, 'Idempotency key conflicts with a different upload', null, 'IDEMPOTENCY_CONFLICT');
    }
    return { status: 'duplicate', uploaded: false, sessionId: payload.sessionId };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const profile = payload.profile?.profile || {};
    const solvedAnalytics = payload.progress?.questionDataset?.analytics || payload.analytics?.solved || {};
    const dayCounts = dayCountsFromActivity(payload.profile?.activity);
    const metadataPatch = {
      leetcodeExtension: {
        sessionId: payload.sessionId,
        collectorVersion: payload.metadata.collectorVersion,
        providerVersion: payload.upload?.providerVersion || null,
        payloadHash: payload.metadata.payloadHash,
        source: 'authenticated_extension',
        collectedAt: payload.collectionTimestamps.mergedAt,
        verified: true
      },
      leetcodeStats: statsByDifficulty(payload.profile, solvedAnalytics),
      leetcodeCalendar: {
        activeYears: payload.profile?.activity?.activeYears || [],
        streak: Number(payload.profile?.activity?.streak || solvedAnalytics.streak || 0),
        totalActiveDays: Number(payload.profile?.activity?.totalActiveDays || 0),
        dayCounts
      },
      leetcodeBookmarks: payload.progress?.bookmarks || [],
      leetcodeProblemMetadata: payload.progress?.problemMetadata || [],
      leetcodeExtensionAnalytics: payload.analytics || {}
    };

    await client.query(
      `UPDATE platform_accounts
       SET handle = $1,
           handle_normalized = $2,
           profile_url = $3,
           rating = $4,
           max_rating = NULL,
           metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
           last_synced_at = NOW(),
           sync_status = 'synced'
       WHERE id = $6 AND user_id = $7`,
      [
        uploadedHandle,
        normalizedUploadHandle,
        `https://leetcode.com/u/${encodeURIComponent(uploadedHandle)}/`,
        profile.ranking || null,
        JSON.stringify(metadataPatch),
        account.id,
        userId
      ]
    );

    await persistQuestions(
      client,
      account.id,
      payload.progress.questionDataset.questions,
      payload.collectionTimestamps.progressCollectedAt || payload.collectionTimestamps.mergedAt
    );

    await client.query('DELETE FROM contest_history WHERE platform_account_id = $1', [account.id]);

    await extensionUploadRepository.insertLeetCodeUpload({
      userId,
      platformAccountId: account.id,
      sessionId: payload.sessionId,
      payloadHash: payload.metadata.payloadHash,
      collectorVersion: payload.metadata.collectorVersion,
      providerVersion: payload.upload?.providerVersion || null,
      requestMetadata: {
        idempotencyKey: headers['idempotency-key'] || null,
        extensionSessionId: headers['x-cpinsight-session-id'] || null,
        collectionDurationMs: payload.upload?.collectionDurationMs || null
      }
    }, client);

    await client.query('DELETE FROM analytics_cache WHERE user_id = $1', [userId]);
    await client.query('COMMIT');

    await Promise.all([
      delByPattern(`profile:${userId}`),
      delByPattern(`analytics:${userId}:*`)
    ]).catch(() => {});

    const analytics = await analyticsService.getPlatformAnalytics(userId, 'leetcode').catch(() => null);
    if (analytics) {
      await analyticsRepository.upsertCache({
        userId,
        platform: 'leetcode',
        cacheKey: 'analytics:leetcode',
        windowKey: 'all',
        payload: analytics,
        ttlMinutes: 30
      }).catch(() => {});
    }

    return {
      status: 'accepted',
      uploaded: true,
      sessionId: payload.sessionId,
      handle: uploadedHandle,
      questionsStored: payload.progress.questionDataset.questions.length
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { persistLeetCodeCollection };
