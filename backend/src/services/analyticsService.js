const analyticsRepository = require('../repositories/analyticsRepository');
const pool = require('../database/pool');
const leetcodeClient = require('./platforms/leetcodeClient');
const { getJson, setJson } = require('../redis/client');
const HttpError = require('../utils/httpError');

const PLATFORM_TTL_MINUTES = 30;
const COMBINED_TTL_MINUTES = 15;
const ANALYTICS_PAYLOAD_VERSION = 5;
const SKIPPABLE_COMBINED_ANALYTICS_CODES = new Set([
  'SYNC_FAILED',
  'PLATFORM_UNAVAILABLE',
  'INVALID_HANDLE'
]);

function acceptedVerdict(platform) {
  if (platform === 'leetcode') return 'AC';
  return 'OK';
}

function isAcceptedSubmission(submission) {
  const verdict = String(submission.verdict || '').toLowerCase();
  return verdict === String(acceptedVerdict(submission.platform)).toLowerCase()
    || verdict === 'accepted'
    || verdict === 'ac';
}

function buildActivityHeatmap(submissions) {
  return submissions.reduce((days, submission) => {
    const date = new Date(submission.submitted_at);
    if (!Number.isFinite(date.getTime())) return days;
    const key = date.toISOString().slice(0, 10);
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
    const accepted = isAcceptedSubmission(submission);
    for (const rawTag of submission.tags || []) {
      const tag = String(rawTag || '').trim().toLowerCase();
      if (!tag) continue;
      if (!topics[tag]) {
        topics[tag] = {
          attempts: 0,
          accepted: 0,
          solvedKeys: new Set(),
          difficultyTotal: 0,
          difficultySamples: 0,
          lastSolved: 0
        };
      }
      const stats = topics[tag];
      stats.attempts += 1;
      if (!accepted) continue;
      stats.accepted += 1;
      const key = solvedProblemKey(submission);
      if (key) stats.solvedKeys.add(key);
      const difficulty = Number(submission.difficulty);
      if (Number.isFinite(difficulty) && difficulty > 0) {
        stats.difficultyTotal += difficulty;
        stats.difficultySamples += 1;
      }
      const timestamp = new Date(submission.submitted_at).getTime();
      if (Number.isFinite(timestamp)) stats.lastSolved = Math.max(stats.lastSolved, Math.floor(timestamp / 1000));
    }
  }

  return Object.entries(topics)
    .map(([topic, stats]) => {
      const solved = stats.solvedKeys.size;
      const successRate = stats.attempts === 0 ? 0 : (stats.accepted / stats.attempts) * 100;
      const averageDifficulty = stats.difficultySamples
        ? stats.difficultyTotal / stats.difficultySamples
        : 0;
      const difficultyScore = Math.min(100, (averageDifficulty / 3500) * 100);
      const volumeScore = Math.min(100, (Math.log(solved + 1) / Math.log(501)) * 100);
      return {
        topic,
        attempts: stats.attempts,
        accepted: stats.accepted,
        solved,
        averageDifficulty: Math.round(averageDifficulty),
        difficultySamples: stats.difficultySamples,
        successRate: Math.round(successRate),
        lastSolved: stats.lastSolved,
        strength: Math.round((0.4 * difficultyScore) + (0.4 * volumeScore) + (0.2 * successRate))
      };
    })
    .sort((a, b) => b.strength - a.strength);
}

function buildActivityIntelligence(activityHeatmap, now = Date.now()) {
  const entries = Object.entries(activityHeatmap || {})
    .filter(([day, count]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number(count) > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) {
    return {
      activeDays: 0,
      activeDaysPercent: 0,
      currentStreak: 0,
      longestStreak: 0,
      mostActiveDay: null,
      mostActiveMonth: null,
      submissionsLast90Days: 0
    };
  }

  const dayTotals = Array(7).fill(0);
  const monthTotals = Array(12).fill(0);
  const daySet = new Set(entries.map(([day]) => day));
  const dayMilliseconds = 24 * 60 * 60 * 1000;
  let submissionsLast90Days = 0;
  for (const [day, count] of entries) {
    const date = new Date(`${day}T00:00:00.000Z`);
    dayTotals[date.getUTCDay()] += Number(count);
    monthTotals[date.getUTCMonth()] += Number(count);
    if (now - date.getTime() <= 90 * dayMilliseconds) submissionsLast90Days += Number(count);
  }

  let longestStreak = 1;
  let runningStreak = 1;
  for (let index = 1; index < entries.length; index += 1) {
    const previous = new Date(`${entries[index - 1][0]}T00:00:00.000Z`).getTime();
    const current = new Date(`${entries[index][0]}T00:00:00.000Z`).getTime();
    runningStreak = Math.round((current - previous) / dayMilliseconds) === 1 ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
  }

  const todayKey = new Date(now).toISOString().slice(0, 10);
  const yesterdayKey = new Date(now - dayMilliseconds).toISOString().slice(0, 10);
  let cursorKey = daySet.has(todayKey) ? todayKey : daySet.has(yesterdayKey) ? yesterdayKey : null;
  let currentStreak = 0;
  while (cursorKey && daySet.has(cursorKey)) {
    currentStreak += 1;
    cursorKey = new Date(new Date(`${cursorKey}T00:00:00.000Z`).getTime() - dayMilliseconds).toISOString().slice(0, 10);
  }

  const firstDay = new Date(`${entries[0][0]}T00:00:00.000Z`).getTime();
  const elapsedDays = Math.max(1, Math.floor((now - firstDay) / dayMilliseconds) + 1);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    activeDays: entries.length,
    activeDaysPercent: Math.min(100, Math.round((entries.length / elapsedDays) * 100)),
    currentStreak,
    longestStreak,
    mostActiveDay: dayNames[dayTotals.indexOf(Math.max(...dayTotals))],
    mostActiveMonth: monthNames[monthTotals.indexOf(Math.max(...monthTotals))],
    submissionsLast90Days
  };
}

function buildDifficultyIntelligence(submissions) {
  const solved = new Map();
  for (const submission of submissions) {
    if (!isAcceptedSubmission(submission)) continue;
    const key = solvedProblemKey(submission);
    const difficulty = Number(submission.difficulty);
    if (!key || !Number.isFinite(difficulty) || difficulty <= 0 || solved.has(key)) continue;
    solved.set(key, difficulty);
  }
  return buildDifficultyIntelligenceFromRatings(Array.from(solved.values()));
}

function buildDifficultyIntelligenceFromRatings(values) {
  const ratings = values
    .map(Number)
    .filter((rating) => Number.isFinite(rating) && rating > 0)
    .sort((a, b) => a - b);
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  for (const rating of ratings) {
    const index = rating <= 900 ? 0
      : rating <= 1100 ? 1
        : rating <= 1300 ? 2
          : rating <= 1500 ? 3
            : rating <= 1700 ? 4
              : rating <= 1900 ? 5 : 6;
    buckets[index] += 1;
  }
  return {
    available: ratings.length > 0,
    sampleSize: ratings.length,
    averageDifficulty: ratings.length ? Math.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length) : null,
    medianDifficulty: ratings.length ? ratings[Math.floor(ratings.length / 2)] : null,
    highestSolved: ratings.length ? ratings[ratings.length - 1] : null,
    histogram: { labels: ['800', '1000', '1200', '1400', '1600', '1800', '2000+'], values: buckets },
    ratings
  };
}

function combineTopicStrength(platformResults) {
  const combined = new Map();
  for (const result of platformResults) {
    for (const topic of result.topicStrength || []) {
      const key = String(topic.topic || '').trim().toLowerCase();
      if (!key) continue;
      const existing = combined.get(key) || {
        topic: key,
        attempts: 0,
        accepted: 0,
        solved: 0,
        difficultyTotal: 0,
        difficultySamples: 0,
        lastSolved: 0
      };
      const samples = Number(topic.difficultySamples || 0);
      existing.attempts += Number(topic.attempts || 0);
      existing.accepted += Number(topic.accepted || 0);
      existing.solved += Number(topic.solved || 0);
      existing.difficultyTotal += Number(topic.averageDifficulty || 0) * samples;
      existing.difficultySamples += samples;
      existing.lastSolved = Math.max(existing.lastSolved, Number(topic.lastSolved || 0));
      combined.set(key, existing);
    }
  }

  return Array.from(combined.values())
    .map((topic) => {
      const averageDifficulty = topic.difficultySamples
        ? topic.difficultyTotal / topic.difficultySamples
        : 0;
      const successRate = topic.attempts ? (topic.accepted / topic.attempts) * 100 : 0;
      const difficultyScore = Math.min(100, (averageDifficulty / 3500) * 100);
      const volumeScore = Math.min(100, (Math.log(topic.solved + 1) / Math.log(501)) * 100);
      return {
        topic: topic.topic,
        attempts: topic.attempts,
        accepted: topic.accepted,
        solved: topic.solved,
        averageDifficulty: Math.round(averageDifficulty),
        difficultySamples: topic.difficultySamples,
        successRate: Math.round(successRate),
        lastSolved: topic.lastSolved,
        strength: Math.round((0.4 * difficultyScore) + (0.4 * volumeScore) + (0.2 * successRate))
      };
    })
    .sort((left, right) => right.strength - left.strength);
}

function combineContestIntelligence(platformResults, ratingProgression) {
  const base = buildContestIntelligence(ratingProgression);
  const byPlatform = Object.fromEntries(platformResults.map((result) => [
    result.platform,
    result.contestIntelligence
  ]));
  const primary = platformResults
    .filter((result) => result.contestIntelligence?.available)
    .sort((left, right) => (right.ratingProgression?.length || 0) - (left.ratingProgression?.length || 0))[0];
  return {
    ...base,
    change30Days: primary?.contestIntelligence?.change30Days ?? null,
    change90Days: primary?.contestIntelligence?.change90Days ?? null,
    growthPlatform: primary?.platform || null,
    byPlatform
  };
}

function buildContestIntelligence(ratingProgression, now = Date.now()) {
  const points = ratingProgression
    .filter((point) => Number.isFinite(Number(point.rating)))
    .slice()
    .sort((left, right) => new Date(left.participatedAt) - new Date(right.participatedAt));
  if (!points.length) {
    return { available: false, bestChange: null, worstChange: null, consistency: null, volatility: null, change30Days: null, change90Days: null };
  }
  const deltas = points.map((point) => Number(point.delta || 0));
  const average = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const volatility = Math.sqrt(deltas.reduce((sum, value) => sum + ((value - average) ** 2), 0) / deltas.length);
  const latestRating = Number(points[points.length - 1].rating);
  const ratingAt = (days) => {
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const before = points.filter((point) => new Date(point.participatedAt).getTime() <= cutoff);
    return Number((before[before.length - 1] || points[0]).rating);
  };
  return {
    available: true,
    bestChange: Math.max(...deltas),
    worstChange: Math.min(...deltas),
    consistency: Math.round((deltas.filter((delta) => delta > 0).length / deltas.length) * 100),
    volatility: Number(volatility.toFixed(1)),
    change30Days: latestRating - ratingAt(30),
    change90Days: latestRating - ratingAt(90)
  };
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
    if (!isAcceptedSubmission(submission)) return false;
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

  const accepted = facts.submissions.filter(isAcceptedSubmission);
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
      tags: Array.isArray(submission.tags) ? submission.tags : [],
      difficulty: submission.difficulty ?? null,
      verdict: submission.verdict,
      submittedAt: submission.submitted_at,
      problem: {
        name: submission.problem_name,
        tags: Array.isArray(submission.tags) ? submission.tags : [],
        rating: submission.difficulty ?? null
      }
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
  const topicStrength = buildTopicStrength(facts.submissions);
  const activityIntelligence = buildActivityIntelligence(activityHeatmap);
  const difficultyIntelligence = buildDifficultyIntelligence(facts.submissions);
  const contestIntelligence = buildContestIntelligence(ratingProgression);
  const syncMetadata = facts.account.metadata?.syncState || {};
  const warnings = platform === 'codechef'
    ? facts.account.metadata?.codechefSyncWarnings || []
    : [];
  return {
    platform,
    handle: facts.account.handle,
    syncStatus: facts.account.sync_status,
    lastSyncedAt: facts.account.last_synced_at,
    dataAvailability: {
      profile: syncMetadata.datasets?.profile !== false,
      rating: facts.account.rating !== null,
      contests: syncMetadata.datasets?.contests !== false,
      submissions: syncMetadata.datasets?.submissions !== false,
      activity: syncMetadata.datasets?.activity !== false,
      topics: topicStrength.length > 0,
      difficulty: difficultyIntelligence.available
    },
    warnings,
    solvedProblems,
    solvedLastYear,
    solvedLastMonth,
    totalSubmissions,
    acceptedSubmissions,
    contestCount: facts.contests.length,
    currentRating: facts.account.rating,
    maxRating: facts.account.max_rating,
    activityHeatmap,
    activityIntelligence,
    topicStrength,
    difficultyIntelligence,
    contestIntelligence,
    ratingProgression,
    ratingChange: ratingProgression.length ? ratingProgression[ratingProgression.length - 1].delta : null,
    streak: activityIntelligence.currentStreak,
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
  if (cached?.analyticsVersion === ANALYTICS_PAYLOAD_VERSION) return cached;

  const cacheKey = `analytics:${platform}`;
  const persisted = canUseComputedCache ? await analyticsRepository.getFreshCache(userId, cacheKey, windowKey) : null;
  if (persisted?.payload?.analyticsVersion === ANALYTICS_PAYLOAD_VERSION) {
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
  const totalSubmissions = results.reduce((sum, item) => sum + item.totalSubmissions, 0);
  const acceptedSubmissions = results.reduce((sum, item) => sum + item.acceptedSubmissions, 0);
  const activityHeatmap = results.reduce((merged, item) => {
    for (const [day, count] of Object.entries(item.activityHeatmap)) {
      merged[day] = (merged[day] || 0) + count;
    }
    return merged;
  }, {});
  const topicStrength = combineTopicStrength(results);
  const ratingProgression = results.flatMap((item) => item.ratingProgression.map((point) => ({
    ...point,
    platform: item.platform
  }))).sort((a, b) => new Date(a.participatedAt) - new Date(b.participatedAt));
  const activityIntelligence = buildActivityIntelligence(activityHeatmap);
  const difficultyIntelligence = buildDifficultyIntelligenceFromRatings(
    results.flatMap((item) => item.difficultyIntelligence?.ratings || [])
  );
  const contestIntelligence = combineContestIntelligence(results, ratingProgression);
  const streak = activityIntelligence.currentStreak;
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
    totalSubmissions,
    acceptedSubmissions,
    submissions: totalSubmissions,
    activityHeatmap,
    activityIntelligence,
    topicStrength,
    difficultyIntelligence,
    contestIntelligence,
    ratingProgression,
    streak,
    recentSubmissions,
    cpInsightScore: cpInsightScore({ solvedProblems, contestCount, streak, topicStrength, ratingProgression }),
    analyticsVersion: ANALYTICS_PAYLOAD_VERSION,
    platforms: results,
    skippedPlatforms,
    syncStatus: results.some((item) => item.syncStatus === 'failed')
      ? 'failed'
      : results.some((item) => item.syncStatus === 'partial') ? 'partial' : 'synced',
    dataAvailability: {
      platforms: results.map((item) => ({
        platform: item.platform,
        syncStatus: item.syncStatus,
        datasets: item.dataAvailability
      })),
      topics: topicStrength.length > 0,
      difficulty: difficultyIntelligence.available,
      contests: ratingProgression.length > 0,
      activity: Object.keys(activityHeatmap).length > 0
    },
    warnings: results.flatMap((item) => (item.warnings || []).map((warning) => ({
      platform: item.platform,
      warning
    })))
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

module.exports = {
  getPlatformAnalytics,
  getCombinedAnalytics,
  _private: {
    buildActivityHeatmap,
    buildActivityIntelligence,
    buildTopicStrength,
    buildDifficultyIntelligence,
    buildContestIntelligence,
    combineTopicStrength
  }
};
