const pool = require('../database/pool');
const { delByPattern } = require('../redis/client');
const codeforcesClient = require('./platforms/codeforcesClient');
const codechefClient = require('./platforms/codechefClient');
const HttpError = require('../utils/httpError');

const platformClients = {
  codeforces: codeforcesClient,
  codechef: codechefClient
};

function stageError(stage, error) {
  if (!error.syncStage) error.syncStage = stage;
  return error;
}

async function fetchStage(stage, operation) {
  try {
    return await operation();
  } catch (error) {
    throw stageError(stage, error);
  }
}

function syncState({ status, startedAt, completedAt = null, successfulStages = [], failedStage = null, error = null, datasets = {} }) {
  return {
    status,
    startedAt,
    completedAt,
    successfulStages,
    failedStage,
    error: error ? String(error).slice(0, 500) : null,
    datasets
  };
}

async function updateSyncState(db, accountId, status, state) {
  await db.query(
    `UPDATE platform_accounts
        SET sync_status = $2,
            metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [accountId, status, JSON.stringify({ syncState: state })]
  );
}

async function markLeetcodePending(db, accountId, platform, handle) {
  await db.query(
    `UPDATE platform_accounts
        SET sync_status = CASE WHEN last_synced_at IS NULL THEN 'pending_extension_upload' ELSE sync_status END,
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [
      accountId,
      JSON.stringify({
        leetcodeSyncMode: 'authenticated_extension',
        publicSyncDeprecatedAt: new Date().toISOString()
      })
    ]
  );
  return {
    platform,
    handle,
    status: 'pending_extension_upload',
    message: 'LeetCode uses the CPInsight browser extension as the canonical sync source.'
  };
}

async function fetchPlatformSnapshot(platform, handle) {
  const client = platformClients[platform];
  if (!client) throw new Error(`No client for platform: ${platform}`);

  if (platform === 'codeforces') {
    const [submissions, contests, profile] = await Promise.all([
      fetchStage('submissions', () => client.getUserSubmissions(handle)),
      fetchStage('contests', () => client.getUserRating(handle)),
      fetchStage('profile', () => client.getUserInfo(handle))
    ]);
    if (!profile) {
      throw stageError('profile', new HttpError(400, `Codeforces handle not found: ${handle}`, null, 'INVALID_HANDLE'));
    }
    return {
      profile,
      submissions,
      contests,
      metadata: {},
      status: 'synced',
      warnings: [],
      availability: { profile: true, submissions: true, contests: true, activity: true },
      successfulStages: ['profile', 'submissions', 'contests', 'activity']
    };
  }

  const data = await fetchStage('profile', () => client.getPublicProfile(handle));
  if (!data?.profile) {
    throw stageError('profile', new HttpError(400, `CodeChef handle not found: ${handle}`, null, 'INVALID_HANDLE'));
  }
  const submissionsAvailable = !data.partial;
  const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
  const availability = {
    profile: true,
    contests: true,
    submissions: submissionsAvailable,
    activity: Object.keys(data.heatmap || {}).length > 0 || submissionsAvailable
  };
  const successfulStages = ['profile', 'contests'];
  if (submissionsAvailable) successfulStages.push('submissions');
  if (availability.activity) successfulStages.push('activity');

  return {
    profile: data.profile,
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
    contests: Array.isArray(data.contests) ? data.contests : [],
    status: data.partial ? 'partial' : 'synced',
    warnings,
    availability,
    successfulStages,
    failedStage: data.partial ? 'submissions' : null,
    metadata: {
      codechefStats: data.stats || {},
      codechefHeatmap: data.heatmap || {},
      codechefPartialSync: Boolean(data.partial),
      codechefSyncWarnings: warnings,
      codechefProfile: {
        stars: data.profile.stars || null,
        globalRank: data.profile.globalRank || null,
        countryRank: data.profile.countryRank || null,
        institution: data.profile.institution || null,
        country: data.profile.country || null,
        totalProblemsSolved: data.profile.totalProblemsSolved || 0
      }
    }
  };
}

function profileRatings(platform, profile) {
  if (platform === 'codeforces') {
    return { rating: profile.rating ?? null, maxRating: profile.maxRating ?? null };
  }
  if (platform === 'codechef') {
    return { rating: profile.currentRating ?? null, maxRating: profile.maximumRating ?? null };
  }
  return { rating: null, maxRating: null };
}

function submissionTimestamp(submission, platform) {
  const seconds = Number(submission.creationTimeSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw stageError('persist_submissions', new Error(`${platform} submission has an invalid timestamp`));
  }
  return new Date(seconds * 1000);
}

async function writeSubmissions(db, accountId, platform, handle, submissions, replace) {
  if (replace) {
    await db.query('DELETE FROM submission_history WHERE platform_account_id = $1', [accountId]);
  }
  for (const submission of submissions) {
    const externalId = submission.id || `${platform}-${handle}-${submission.creationTimeSeconds}`;
    const problem = submission.problem || {};
    const problemKey = problem.slug
      || [problem.contestId, problem.index].filter(Boolean).join('')
      || problem.name
      || externalId;
    const legacyIds = Array.isArray(submission.legacyIds) ? submission.legacyIds.filter(Boolean) : [];
    if (!replace && legacyIds.length) {
      await db.query(
        `DELETE FROM submission_history
          WHERE platform_account_id = $1
            AND external_submission_id = ANY($2::text[])`,
        [accountId, legacyIds]
      );
    }
    await db.query(
      `INSERT INTO submission_history
       (platform_account_id, platform, external_submission_id, problem_key, problem_name,
        verdict, submitted_at, tags, difficulty, language, contest_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (platform_account_id, external_submission_id)
       DO UPDATE SET
         problem_key = EXCLUDED.problem_key,
         problem_name = EXCLUDED.problem_name,
         verdict = EXCLUDED.verdict,
         submitted_at = EXCLUDED.submitted_at,
         tags = EXCLUDED.tags,
         difficulty = EXCLUDED.difficulty,
         language = EXCLUDED.language,
         contest_key = EXCLUDED.contest_key,
         updated_at = NOW()`,
      [
        accountId,
        platform,
        String(externalId),
        String(problemKey),
        problem.name || 'Unknown Problem',
        submission.verdict || 'UNKNOWN',
        submissionTimestamp(submission, platform),
        Array.isArray(problem.tags) ? problem.tags : [],
        Number.isFinite(Number(problem.rating)) ? Number(problem.rating) : null,
        submission.language || null,
        problem.contestId ? String(problem.contestId) : null
      ]
    );
  }
}

async function replaceSubmissions(db, accountId, platform, handle, submissions) {
  return writeSubmissions(db, accountId, platform, handle, submissions, true);
}

async function replaceContests(db, accountId, platform, handle, contests) {
  await db.query('DELETE FROM contest_history WHERE platform_account_id = $1', [accountId]);
  for (const contest of contests) {
    const seconds = Number(contest.ratingUpdateTimeSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw stageError('persist_contests', new Error(`${platform} contest has an invalid timestamp`));
    }
    const externalId = contest.contestId || `${platform}-${handle}-${seconds}`;
    const oldRating = Number.isFinite(Number(contest.oldRating)) ? Number(contest.oldRating) : null;
    const newRating = Number.isFinite(Number(contest.newRating)) ? Number(contest.newRating) : null;
    const ratingDelta = Number.isFinite(Number(contest.ratingDelta))
      ? Number(contest.ratingDelta)
      : oldRating !== null && newRating !== null
        ? newRating - oldRating
        : null;
    await db.query(
      `INSERT INTO contest_history
       (platform_account_id, platform, external_contest_id, contest_name,
        rating_before, rating_after, rating_delta, participated_at, rank, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        accountId,
        platform,
        String(externalId),
        contest.contestName || 'Unknown Contest',
        oldRating,
        newRating,
        ratingDelta,
        new Date(seconds * 1000),
        Number.isFinite(Number(contest.rank)) ? Number(contest.rank) : null,
        JSON.stringify(contest.metadata || {})
      ]
    );
  }
}

async function persistSnapshot(db, userId, account, snapshot, startedAt) {
  const { id: accountId, platform, handle } = account;
  if (snapshot.availability.submissions) {
    await replaceSubmissions(db, accountId, platform, handle, snapshot.submissions);
  } else if (snapshot.submissions.length) {
    await writeSubmissions(db, accountId, platform, handle, snapshot.submissions, false);
  }
  if (snapshot.availability.contests) {
    await replaceContests(db, accountId, platform, handle, snapshot.contests);
  }

  const { rating, maxRating } = profileRatings(platform, snapshot.profile);
  const completedAt = new Date().toISOString();
  const state = syncState({
    status: snapshot.status,
    startedAt,
    completedAt,
    successfulStages: snapshot.successfulStages,
    failedStage: snapshot.failedStage,
    error: snapshot.warnings[0] || null,
    datasets: snapshot.availability
  });
  await db.query(
    `UPDATE platform_accounts
        SET rating = $1,
            max_rating = $2,
            metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
            last_synced_at = NOW(),
            sync_status = $5,
            updated_at = NOW()
      WHERE id = $3`,
    [
      rating,
      maxRating,
      accountId,
      JSON.stringify({ ...snapshot.metadata, syncState: state }),
      snapshot.status
    ]
  );
  await db.query('DELETE FROM analytics_cache WHERE user_id = $1', [userId]);

  const counts = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM submission_history WHERE platform_account_id = $1) AS submissions,
       (SELECT COUNT(*)::int FROM contest_history WHERE platform_account_id = $1) AS contests`,
    [accountId]
  );
  return {
    platform,
    handle,
    status: snapshot.status,
    submissionsCount: counts.rows[0].submissions,
    contestsCount: counts.rows[0].contests,
    availability: snapshot.availability,
    warnings: snapshot.warnings
  };
}

async function persistAtomically(userId, account, snapshot, startedAt, providedDb) {
  if (providedDb) return persistSnapshot(providedDb, userId, account, snapshot, startedAt);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await persistSnapshot(client, userId, account, snapshot, startedAt);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function syncPlatformAccount(userId, account, options = {}) {
  const { id: accountId, platform, handle } = account;
  const db = options.db || pool;
  const throwOnError = Boolean(options.throwOnError);

  if (platform === 'leetcode') return markLeetcodePending(db, accountId, platform, handle);
  if (!platformClients[platform]) throw new Error(`No client for platform: ${platform}`);

  const startedAt = new Date().toISOString();
  await updateSyncState(db, accountId, 'syncing', syncState({ status: 'syncing', startedAt }));

  try {
    console.log(`Syncing ${platform} account: ${handle}`);
    const snapshot = await fetchPlatformSnapshot(platform, handle);
    const result = await persistAtomically(userId, account, snapshot, startedAt, options.db);
    await delByPattern(`analytics:${userId}:*`).catch(() => {});
    console.log(`Synced ${platform} account: ${handle} with status ${result.status}`);
    return result;
  } catch (error) {
    const failedStage = error.syncStage || 'sync';
    console.error(`Failed ${platform} sync for ${handle} at ${failedStage}: ${error.message}`);
    const failed = syncState({
      status: 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      failedStage,
      error: error.message
    });
    await updateSyncState(db, accountId, 'failed', failed).catch(() => {});
    if (throwOnError) throw error;
    return { platform, handle, status: 'failed', failedStage, error: error.message };
  }
}

async function syncUserPlatforms(userId) {
  const result = await pool.query(
    'SELECT * FROM platform_accounts WHERE user_id = $1 ORDER BY platform',
    [userId]
  );
  if (!result.rows.length) {
    return { success: true, status: 'synced', message: 'No accounts to sync', synced: [] };
  }

  const synced = [];
  for (const account of result.rows) {
    synced.push(await syncPlatformAccount(userId, account));
  }
  const hasFailed = synced.some((item) => item.status === 'failed');
  const hasPartial = synced.some((item) => item.status === 'partial');
  const status = hasFailed ? 'failed' : hasPartial ? 'partial' : 'synced';
  return {
    success: status === 'synced',
    status,
    message: status === 'synced'
      ? `Synced ${synced.length} platform accounts`
      : `Platform synchronization completed with status ${status}`,
    synced
  };
}

module.exports = {
  syncUserPlatforms,
  syncPlatformAccount,
  _private: { fetchPlatformSnapshot, persistSnapshot, replaceSubmissions, replaceContests, writeSubmissions }
};
