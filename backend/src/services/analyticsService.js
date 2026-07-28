const analyticsRepository = require('../repositories/analyticsRepository');
const pool = require('../database/pool');
const leetcodeClient = require('./platforms/leetcodeClient');
const { getJson, setJson } = require('../redis/client');
const HttpError = require('../utils/httpError');

const PLATFORM_TTL_MINUTES = 30;
const COMBINED_TTL_MINUTES = 15;
const ANALYTICS_PAYLOAD_VERSION = 3;
const SKIPPABLE_COMBINED_ANALYTICS_CODES = new Set([
  'SYNC_FAILED',
  'PLATFORM_UNAVAILABLE',
  'INVALID_HANDLE'
]);

function acceptedVerdict(platform) {
  if (platform === 'leetcode') return 'AC';
  return 'OK';
}

function buildActivityHeatmap(submissions) {
  return submissions.reduce((days, submission) => {
    const key = new Date(submission.submitted_at).toISOString().slice(0, 10);
    days[key] = (days[key] || 0) + 1;
    return days;
  }, {});
}

function normalizeDayCountMap(dayCounts) {
  if (!dayCounts || typeof dayCounts !== 'object') return {};

  const normalized = {};
  for (const [day, rawCount] of Object.entries(dayCounts)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const count = Number(rawCount || 0);
    if (!Number.isFinite(count) || count <= 0) continue;
    normalized[day] = Math.floor(count);
  }

  return normalized;
}

function buildTopicStrength(submissions) {
  const topics = {};
  for (const submission of submissions) {
    for (const tag of submission.tags || []) {
      if (!topics[tag]) topics[tag] = { attempts: 0, accepted: 0 };
      topics[tag].attempts += 1;
      if (submission.verdict === acceptedVerdict(submission.platform)) topics[tag].accepted += 1;
    }
  }

  return Object.entries(topics)
    .map(([topic, stats]) => ({
      topic,
      attempts: stats.attempts,
      accepted: stats.accepted,
      strength: stats.attempts === 0 ? 0 : Math.round((stats.accepted / stats.attempts) * 100)
    }))
    .sort((a, b) => b.strength - a.strength);
}

function currentStreak(submissions) {
  const acceptedDays = new Set(
    submissions
      .filter((submission) => submission.verdict === acceptedVerdict(submission.platform))
      .map((submission) => new Date(submission.submitted_at).toISOString().slice(0, 10))
  );
  let streak = 0;
  const cursor = new Date();
  while (acceptedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function solvedProblemKey(submission) {
  const key = submission.problem_key;
  if (!key) return null;
  if (submission.platform === 'leetcode' && key.startsWith('leetcode-calendar-')) return null;
  return key;
}

function computeLeetcodeSolvedMetrics(facts, now = Date.now()) {
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const accepted = facts.submissions.filter((submission) => {
    if (submission.platform !== 'leetcode') return false;
    if (submission.verdict !== 'AC') return false;
    if (typeof submission.problem_key !== 'string') return false;
    if (submission.problem_key.length === 0) return false;
    if (submission.problem_key.startsWith('leetcode-calendar-')) return false;
    return true;
  });
  const extensionVerified = facts.account.metadata?.leetcodeExtension?.verified === true;
  if (extensionVerified) {
    const countDistinct = (items) => new Set(items.map((submission) => submission.problem_key)).size;
    const solvedProblems = countDistinct(accepted);
    return {
      solvedProblems,
      solvedLastYear: countDistinct(
        accepted.filter((submission) => new Date(submission.submitted_at).getTime() >= oneYearAgo)
      ),
      solvedLastMonth: countDistinct(
        accepted.filter((submission) => new Date(submission.submitted_at).getTime() >= oneMonthAgo)
      )
    };
  }

  let expectedAcceptedSubmissions = null;
  const stats = facts.account.metadata && facts.account.metadata.leetcodeStats;
  if (stats && stats.all) {
    const parsed = Number(stats.all.submissions);
    if (Number.isInteger(parsed) && parsed > 0) {
      expectedAcceptedSubmissions = parsed;
    }
  }

  if (!Number.isInteger(expectedAcceptedSubmissions)) {
    throw new HttpError(
      409,
      'LeetCode accepted submission history is not verified. Run LeetCode sync before viewing solved metrics.',
      null,
      'SYNC_FAILED'
    );
  }

  if (accepted.length < expectedAcceptedSubmissions) {
    throw new HttpError(
      409,
      'LeetCode accepted submission history is incomplete. Run LeetCode sync before viewing solved metrics.',
      {
        expectedAcceptedSubmissions,
        storedAcceptedSubmissions: accepted.length
      },
      'SYNC_FAILED'
    );
  }

  const countDistinct = (items) => new Set(items.map((submission) => submission.problem_key)).size;

  return {
    solvedProblems: countDistinct(accepted),
    solvedLastYear: countDistinct(
      accepted.filter((submission) => new Date(submission.submitted_at).getTime() >= oneYearAgo)
    ),
    solvedLastMonth: countDistinct(
      accepted.filter((submission) => new Date(submission.submitted_at).getTime() >= oneMonthAgo)
    )
  };
}

function platformAnalytics(platform, facts) {
  if (!facts.account) throw new HttpError(404, `No ${platform} account connected`);

  const accepted = facts.submissions.filter((submission) => submission.verdict === acceptedVerdict(platform));
  let solvedProblems;
  let solvedLastYear;
  let solvedLastMonth;

  if (platform === 'leetcode') {
    const metrics = computeLeetcodeSolvedMetrics(facts);
    solvedProblems = metrics.solvedProblems;
    solvedLastYear = metrics.solvedLastYear;
    solvedLastMonth = metrics.solvedLastMonth;
  } else {
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const solved = new Set(accepted.map(solvedProblemKey).filter(Boolean));

    solvedProblems = solved.size;
    solvedLastYear = new Set(
        accepted
            .filter(
                submission =>
                    new Date(submission.submitted_at).getTime() >= oneYearAgo
            )
            .map(solvedProblemKey)
            .filter(Boolean)
    ).size;
    solvedLastMonth = new Set(
        accepted
            .filter(
                submission =>
                    new Date(submission.submitted_at).getTime() >= oneMonthAgo
            )
            .map(solvedProblemKey)
            .filter(Boolean)
    ).size;
  }

  const ratingProgression = facts.contests.map((contest) => ({
    contestId: contest.external_contest_id,
    contestName: contest.contest_name,
    rating: contest.rating_after,
    delta: contest.rating_delta,
    rank: contest.rank,
    participatedAt: contest.participated_at,
    solved: contest.metadata?.solved ?? contest.metadata?.solvedCount ?? null,
    durationSeconds: contest.metadata?.durationSeconds ?? null
  }));

  let acceptedSubmissions = accepted.length;
  let totalSubmissions = facts.submissions.length;
  let activityHeatmap = buildActivityHeatmap(accepted);
  const recentSubmissions = accepted
    .slice()
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    .slice(0, 20)
    .map((submission) => ({
      id: submission.external_submission_id,
      problemKey: submission.problem_key,
      problemName: submission.problem_name,
      verdict: submission.verdict,
      submittedAt: submission.submitted_at
    }));

  if (platform === 'leetcode' && facts.account?.metadata?.leetcodeCalendar?.dayCounts) {
    const calendarHeatmap = normalizeDayCountMap(facts.account.metadata.leetcodeCalendar.dayCounts);
    if (Object.keys(calendarHeatmap).length > 0) {
      activityHeatmap = calendarHeatmap;
    }
  }
  if (platform === 'codechef' && facts.account?.metadata?.codechefHeatmap) {
    const codechefHeatmap = normalizeDayCountMap(facts.account.metadata.codechefHeatmap);
    if (Object.keys(codechefHeatmap).length > 0) {
      activityHeatmap = codechefHeatmap;
    }
  }
  return {
    platform,
    handle: facts.account.handle,
    solvedProblems,
    solvedLastYear,
    solvedLastMonth,
    totalSubmissions,
    acceptedSubmissions,
    contestCount: facts.contests.length,
    currentRating: facts.account.rating,
    maxRating: facts.account.max_rating,
    activityHeatmap,
    topicStrength: buildTopicStrength(facts.submissions),
    ratingProgression,
    streak: currentStreak(facts.submissions),
    recentSubmissions,
    analyticsVersion: ANALYTICS_PAYLOAD_VERSION,
  };
}

function isSkippableCombinedAnalyticsError(error) {
  return error.status === 404
    || error.status === 409
    || SKIPPABLE_COMBINED_ANALYTICS_CODES.has(error.code);
}

function cpInsightScore({ solvedProblems, contestCount, streak, topicStrength, ratingProgression }) {
  const latestRating = ratingProgression.length ? ratingProgression[ratingProgression.length - 1].rating || 0 : 0;
  const ratingPercentileScore = Math.min(100, Math.round((latestRating / 2400) * 100));
  const problemSolvingScore = Math.min(100, Math.round((solvedProblems / 500) * 100));
  const consistencyScore = Math.min(100, streak * 10);
  const contestParticipationScore = Math.min(100, contestCount * 5);
  const topicBreadthScore = Math.min(100, topicStrength.filter((topic) => topic.accepted > 0).length * 8);

  return Math.round(
    0.3 * ratingPercentileScore +
    0.25 * problemSolvingScore +
    0.2 * consistencyScore +
    0.15 * contestParticipationScore +
    0.1 * topicBreadthScore
  );
}

async function getPlatformAnalytics(userId, platform, windowKey = 'all') {
  const redisKey = `analytics:${userId}:${platform}:${windowKey}`;
  const canUseComputedCache = platform !== 'leetcode';
  const cached = canUseComputedCache ? await getJson(redisKey).catch(() => null) : null;
  if (cached) return cached;

  const cacheKey = `analytics:${platform}`;
  const persisted = canUseComputedCache ? await analyticsRepository.getFreshCache(userId, cacheKey, windowKey) : null;
  if (persisted) {
    await setJson(redisKey, persisted.payload, PLATFORM_TTL_MINUTES * 60).catch(() => {});
    return persisted.payload;
  }

  const facts = await analyticsRepository.getPlatformFacts(userId, platform);

  // If LeetCode calendar is missing, fetch live calendar so heatmap does not stay empty until a manual sync.
  if (
    platform === 'leetcode' &&
    facts.account &&
    (!facts.account.metadata?.leetcodeCalendar?.dayCounts ||
      Object.keys(facts.account.metadata.leetcodeCalendar.dayCounts).length === 0)
  ) {
    const liveCalendar = await leetcodeClient.getUserCalendar(facts.account.handle).catch(() => null);
    if (liveCalendar?.dayCounts && Object.keys(liveCalendar.dayCounts).length > 0) {
      const calendarPatch = {
        leetcodeCalendar: {
          activeYears: liveCalendar.activeYears || [],
          streak: Number(liveCalendar.streak || 0),
          totalActiveDays: Number(liveCalendar.totalActiveDays || 0),
          dayCounts: liveCalendar.dayCounts
        }
      };

      facts.account.metadata = {
        ...(facts.account.metadata || {}),
        ...calendarPatch
      };

      await pool.query(
        `UPDATE platform_accounts
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [facts.account.id, JSON.stringify(calendarPatch)]
      ).catch(() => {});
    }
  }

  const payload = platformAnalytics(platform, facts);
  if (canUseComputedCache) {
    await analyticsRepository.upsertCache({
      userId,
      platform,
      cacheKey,
      windowKey,
      payload,
      ttlMinutes: PLATFORM_TTL_MINUTES
    });
    await setJson(redisKey, payload, PLATFORM_TTL_MINUTES * 60).catch(() => {});
  }
  return payload;
}

async function getCombinedAnalytics(userId, windowKey = 'all') {
  const redisKey = `analytics:${userId}:combined:${windowKey}`;
  const leetcodeAccount = await pool.query(
    `SELECT 1
     FROM platform_accounts
     WHERE user_id = $1 AND platform = 'leetcode'
     LIMIT 1`,
    [userId]
  );
  const canUseCombinedCache = leetcodeAccount.rowCount === 0;
  const cached = canUseCombinedCache ? await getJson(redisKey).catch(() => null) : null;
  if (cached && cached.analyticsVersion === ANALYTICS_PAYLOAD_VERSION) return cached;

  const persisted = canUseCombinedCache ? await analyticsRepository.getFreshCache(userId, 'analytics:combined', windowKey) : null;
  if (persisted && persisted.payload?.analyticsVersion === ANALYTICS_PAYLOAD_VERSION) {
    await setJson(redisKey, persisted.payload, COMBINED_TTL_MINUTES * 60).catch(() => {});
    return persisted.payload;
  }

  const platforms = ['codeforces', 'codechef', 'leetcode'];
  const results = [];
  const skippedPlatforms = [];
  for (const platform of platforms) {
    try {
      results.push(await getPlatformAnalytics(userId, platform, windowKey));
    } catch (error) {
      if (!isSkippableCombinedAnalyticsError(error)) throw error;
      skippedPlatforms.push({
        platform,
        status: error.status || 500,
        code: error.code || 'ANALYTICS_UNAVAILABLE',
        message: error.message
      });
    }
  }

  const solvedProblems = results.reduce((sum, item) => sum + item.solvedProblems, 0);
  const solvedLastYear = results.reduce((sum, item) => sum + (item.solvedLastYear || 0), 0);
  const solvedLastMonth = results.reduce((sum, item) => sum + (item.solvedLastMonth || 0), 0);
  const contestCount = results.reduce((sum, item) => sum + item.contestCount, 0);
  const submissions = results.reduce((sum, item) => sum + item.totalSubmissions, 0);
  const activityHeatmap = results.reduce((merged, item) => {
    for (const [day, count] of Object.entries(item.activityHeatmap)) {
      merged[day] = (merged[day] || 0) + count;
    }
    return merged;
  }, {});
  const topicStrength = buildTopicStrength(
    results.flatMap((item) => item.topicStrength.map((topic) => ({
      platform: item.platform,
      verdict: 'OK',
      tags: [topic.topic],
      submitted_at: new Date()
    })))
  );
  const ratingProgression = results.flatMap((item) => item.ratingProgression.map((point) => ({
    ...point,
    platform: item.platform
  }))).sort((a, b) => new Date(a.participatedAt) - new Date(b.participatedAt));
  const streak = Math.max(0, ...results.map((item) => item.streak));
  const recentSubmissions = results
    .flatMap((item) => (item.recentSubmissions || []).map((submission) => ({
      ...submission,
      platform: item.platform
    })))
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 30);

  const payload = {
    solvedProblems,
    solvedLastYear,   // Added
    solvedLastMonth,  // Added
    contestCount,
    submissions,
    activityHeatmap,
    topicStrength,
    ratingProgression,
    streak,
    recentSubmissions,
    cpInsightScore: cpInsightScore({ solvedProblems, contestCount, streak, topicStrength, ratingProgression }),
    analyticsVersion: ANALYTICS_PAYLOAD_VERSION,
    platforms: results,
    skippedPlatforms
  };

  if (canUseCombinedCache) {
    await analyticsRepository.upsertCache({
      userId,
      platform: null,
      cacheKey: 'analytics:combined',
      windowKey,
      payload,
      ttlMinutes: COMBINED_TTL_MINUTES
    });
    await setJson(redisKey, payload, COMBINED_TTL_MINUTES * 60).catch(() => {});
  }
  return payload;
}

module.exports = { getPlatformAnalytics, getCombinedAnalytics };
