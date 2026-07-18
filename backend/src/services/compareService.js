const pool = require('../database/pool');
const HttpError = require('../utils/httpError');

const PLATFORMS = ['codeforces', 'codechef', 'leetcode'];
const SKILL_AXES = [
  { label: 'DP', tags: ['dp'] },
  { label: 'Graphs', tags: ['graphs', 'dfs and similar', 'shortest paths'] },
  { label: 'Greedy', tags: ['greedy'] },
  { label: 'Binary Search', tags: ['binary search'] },
  { label: 'Math', tags: ['math', 'number theory', 'combinatorics'] },
  { label: 'Strings', tags: ['strings'] },
  { label: 'Trees', tags: ['trees'] },
  { label: 'Implementation', tags: ['implementation'] }
];
const RATING_BUCKETS = [
  { label: '<1200', min: 0, max: 1199 },
  { label: '1200-1399', min: 1200, max: 1399 },
  { label: '1400-1599', min: 1400, max: 1599 },
  { label: '1600-1799', min: 1600, max: 1799 },
  { label: '1800-1999', min: 1800, max: 1999 },
  { label: '2000-2199', min: 2000, max: 2199 },
  { label: '2200+', min: 2200, max: Infinity }
];

function acceptedVerdict(platform) {
  return platform === 'leetcode' ? 'AC' : 'OK';
}

function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function average(values) {
  const clean = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function standardDeviation(values) {
  const avg = average(values);
  if (avg === null) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
}

function normalizeDayCountMap(dayCounts) {
  if (!dayCounts || typeof dayCounts !== 'object') return {};
  return Object.entries(dayCounts).reduce((map, [day, value]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return map;
    const count = Math.floor(Number(value || 0));
    if (count > 0) map[day] = count;
    return map;
  }, {});
}

function addHeatmap(target, source) {
  Object.entries(source || {}).forEach(([day, count]) => {
    target[day] = (target[day] || 0) + Number(count || 0);
  });
}

function buildActivityHeatmap(user) {
  const heatmap = {};
  for (const submission of user.submissions) {
    heatmap[dayKey(submission.submitted_at)] = (heatmap[dayKey(submission.submitted_at)] || 0) + 1;
  }

  for (const account of user.accounts) {
    if (account.platform === 'leetcode') addHeatmap(heatmap, normalizeDayCountMap(account.metadata?.leetcodeCalendar?.dayCounts));
    if (account.platform === 'codechef') addHeatmap(heatmap, normalizeDayCountMap(account.metadata?.codechefHeatmap));
  }

  return heatmap;
}

function activeDaySet(heatmap) {
  return new Set(Object.entries(heatmap || {}).filter(([, count]) => count > 0).map(([day]) => day));
}

function maxStreak(days) {
  if (!days.size) return 0;
  let best = 0;
  for (const day of days) {
    const start = new Date(`${day}T00:00:00.000Z`);
    const prev = new Date(start);
    prev.setUTCDate(prev.getUTCDate() - 1);
    if (days.has(prev.toISOString().slice(0, 10))) continue;

    let length = 1;
    const cursor = new Date(start);
    while (true) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (!days.has(cursor.toISOString().slice(0, 10))) break;
      length += 1;
    }
    best = Math.max(best, length);
  }
  return best;
}

function mostActiveMonth(heatmap) {
  const months = {};
  Object.entries(heatmap || {}).forEach(([day, count]) => {
    const month = day.slice(0, 7);
    months[month] = (months[month] || 0) + count;
  });
  const winner = Object.entries(months).sort((a, b) => b[1] - a[1])[0];
  return winner ? winner[0] : null;
}

function solvedProblemKey(submission) {
  if (!submission.problem_key) return null;
  if (submission.platform === 'leetcode' && submission.problem_key.startsWith('leetcode-calendar-')) return null;
  return `${submission.platform}:${submission.problem_key}`;
}

function cpInsightScore(metrics) {
  const ratingScore = Math.min(100, Math.round((metrics.combinedMaxRating / 2400) * 100));
  const solveScore = Math.min(100, Math.round((metrics.combinedProblemsSolved / 500) * 100));
  const streakScore = Math.min(100, metrics.longestActiveStreak * 10);
  const contestScore = Math.min(100, metrics.combinedContestCount * 5);
  return Math.round(0.35 * ratingScore + 0.3 * solveScore + 0.2 * streakScore + 0.15 * contestScore);
}

function summarizeUser(user) {
  const accepted = user.submissions.filter((submission) => submission.verdict === acceptedVerdict(submission.platform));
  const solved = new Set(accepted.map(solvedProblemKey).filter(Boolean));
  const heatmap = buildActivityHeatmap(user);
  const days = activeDaySet(heatmap);
  const ratings = user.accounts.map((account) => account.max_rating || account.rating || 0).filter(Boolean);
  const deltas = user.contests.map((contest) => contest.rating_delta).filter((value) => typeof value === 'number');
  const metrics = {
    combinedMaxRating: ratings.length ? Math.max(...ratings) : 0,
    combinedContestCount: user.contests.length,
    combinedProblemsSolved: solved.size,
    longestActiveStreak: maxStreak(days),
    mostActiveDays: days.size,
    averageRatingGain: average(deltas) ?? 0
  };

  return {
    username: user.username,
    displayName: user.display_name || user.username,
    connectedPlatforms: user.accounts.map((account) => account.platform),
    heatmap,
    cpInsightScore: user.combinedCache?.cpInsightScore ?? cpInsightScore(metrics),
    ...metrics
  };
}

function winnerFor(self, other, higherIsBetter = true) {
  if (self === other) return 'tie';
  if (higherIsBetter) return self > other ? 'current' : 'compared';
  return self < other ? 'current' : 'compared';
}

function comparisonRows(current, compared) {
  const specs = [
    ['CP Insight Score', 'cpInsightScore', true],
    ['Combined Max Rating', 'combinedMaxRating', true],
    ['Combined Contest Count', 'combinedContestCount', true],
    ['Combined Problems Solved', 'combinedProblemsSolved', true],
    ['Longest Active Streak', 'longestActiveStreak', true],
    ['Most Active Days', 'mostActiveDays', true],
    ['Average Rating Gain', 'averageRatingGain', true]
  ];

  return specs.map(([metric, key, higherIsBetter]) => ({
    metric,
    key,
    current: current[key],
    compared: compared[key],
    winner: winnerFor(current[key] || 0, compared[key] || 0, higherIsBetter)
  }));
}

function buildRatingCharts(users, commonPlatforms) {
  const platforms = commonPlatforms.length ? commonPlatforms : PLATFORMS;
  return platforms.map((platform) => ({
    platform,
    title: platform === 'leetcode' ? 'LeetCode Contest Rating' : `${platform[0].toUpperCase()}${platform.slice(1)} Rating`,
    current: users.current.contests
      .filter((contest) => contest.platform === platform && typeof contest.rating_after === 'number')
      .map((contest) => ({
        contestName: contest.contest_name,
        rating: contest.rating_after,
        delta: contest.rating_delta,
        rank: contest.rank,
        participatedAt: contest.participated_at
      })),
    compared: users.compared.contests
      .filter((contest) => contest.platform === platform && typeof contest.rating_after === 'number')
      .map((contest) => ({
        contestName: contest.contest_name,
        rating: contest.rating_after,
        delta: contest.rating_delta,
        rank: contest.rank,
        participatedAt: contest.participated_at
      }))
  })).filter((chart) => chart.current.length || chart.compared.length);
}

function buildHeatmap(current, compared) {
  const presentDays = Array.from(new Set([...Object.keys(current.heatmap), ...Object.keys(compared.heatmap)])).sort();
  const end = new Date();
  const start = presentDays.length ? new Date(`${presentDays[0]}T00:00:00.000Z`) : new Date(end);
  const oneYearAgo = new Date(end);
  oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 364);
  const cursor = start < oneYearAgo ? oneYearAgo : start;
  const allDays = [];

  while (cursor <= end) {
    allDays.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const maxDiff = Math.max(1, ...allDays.map((day) => Math.abs((current.heatmap[day] || 0) - (compared.heatmap[day] || 0))));
  const combinedHeatmap = allDays.reduce((map, day) => {
    map[day] = (current.heatmap[day] || 0) + (compared.heatmap[day] || 0);
    return map;
  }, {});

  return {
    maxDiff,
    days: allDays.map((day) => {
      const currentCount = current.heatmap[day] || 0;
      const comparedCount = compared.heatmap[day] || 0;
      return {
        date: day,
        current: currentCount,
        compared: comparedCount,
        difference: currentCount - comparedCount,
        winner: winnerFor(currentCount, comparedCount)
      };
    }),
    stats: {
      currentActiveDays: activeDaySet(current.heatmap).size,
      comparedActiveDays: activeDaySet(compared.heatmap).size,
      longestStreak: Math.max(maxStreak(activeDaySet(current.heatmap)), maxStreak(activeDaySet(compared.heatmap))),
      mostActiveMonth: mostActiveMonth(combinedHeatmap)
    }
  };
}

function buildSkill(user) {
  const cf = user.submissions.filter((submission) => submission.platform === 'codeforces');
  return SKILL_AXES.map((axis) => {
    const attempts = cf.filter((submission) => (submission.tags || []).some((tag) => axis.tags.includes(tag.toLowerCase())));
    const solved = new Set(
      attempts
        .filter((submission) => submission.verdict === 'OK')
        .map((submission) => submission.problem_key)
        .filter(Boolean)
    ).size;
    const successRate = attempts.length ? Math.round((attempts.filter((submission) => submission.verdict === 'OK').length / attempts.length) * 100) : 0;
    return { topic: axis.label, solved, successRate, score: Math.min(100, Math.round(solved * 8 + successRate * 0.35)) };
  });
}

function contestIntelligence(user) {
  const contests = user.contests.filter((contest) => contest.platform === 'codeforces' || contest.platform === 'codechef');
  const ranked = contests.filter((contest) => typeof contest.rank === 'number' && contest.rank > 0);
  const deltas = contests.map((contest) => contest.rating_delta).filter((value) => typeof value === 'number');
  const best = contests.slice().sort((a, b) => (b.rating_delta || 0) - (a.rating_delta || 0))[0] || null;
  const worst = contests.slice().sort((a, b) => (a.rating_delta || 0) - (b.rating_delta || 0))[0] || null;
  const avgRank = average(ranked.map((contest) => contest.rank));
  const upset = ranked
    .map((contest) => ({ contest, score: (avgRank || contest.rank) - contest.rank }))
    .sort((a, b) => b.score - a.score)[0] || null;

  return {
    contestParticipation: contests.length,
    averageRank: avgRank === null ? null : Math.round(avgRank),
    averageRatingGain: average(deltas) === null ? null : Math.round(average(deltas)),
    bestContest: best ? { contestName: best.contest_name, rank: best.rank, ratingGain: best.rating_delta } : null,
    worstContest: worst ? { contestName: worst.contest_name, rank: worst.rank, ratingLoss: worst.rating_delta } : null,
    upsetPerformance: upset ? { contestName: upset.contest.contest_name, rank: upset.contest.rank, score: Math.round(upset.score) } : null,
    ratingVolatility: standardDeviation(deltas) === null ? null : Math.round(standardDeviation(deltas))
  };
}

function buildContestComparison(currentUser, comparedUser) {
  const current = contestIntelligence(currentUser);
  const compared = contestIntelligence(comparedUser);
  const metrics = [
    ['Contest Participation', 'contestParticipation', true],
    ['Average Rank', 'averageRank', false],
    ['Average Rating Gain', 'averageRatingGain', true],
    ['Upset Performance', 'upsetPerformance', true, (v) => v?.score ?? null],
    ['Rating Volatility', 'ratingVolatility', false]
  ];

  return {
    current,
    compared,
    rows: metrics.map(([label, key, higherIsBetter, projector]) => {
      const currentValue = projector ? projector(current[key]) : current[key];
      const comparedValue = projector ? projector(compared[key]) : compared[key];
      return {
        metric: label,
        current: current[key],
        compared: compared[key],
        winner: currentValue == null || comparedValue == null ? 'tie' : winnerFor(currentValue, comparedValue, higherIsBetter),
        label: key === 'ratingVolatility' ? 'More Consistent' : 'Winner'
      };
    })
  };
}

function buildProblemSolving(user) {
  const solved = new Map();
  user.submissions
    .filter((submission) => submission.platform === 'codeforces' && submission.verdict === 'OK' && typeof submission.difficulty === 'number')
    .forEach((submission) => {
      if (!solved.has(submission.problem_key)) solved.set(submission.problem_key, submission.difficulty);
    });
  const ratings = Array.from(solved.values());
  const hardest10 = ratings.slice().sort((a, b) => b - a).slice(0, 10);
  return {
    buckets: RATING_BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: ratings.filter((rating) => rating >= bucket.min && rating <= bucket.max).length
    })),
    highestSolvedRating: ratings.length ? Math.max(...ratings) : null,
    averageSolvedRating: average(ratings) === null ? null : Math.round(average(ratings)),
    medianSolvedRating: median(ratings),
    averageHardest10SolvedRatings: average(hardest10) === null ? null : Math.round(average(hardest10))
  };
}

function platformDistribution(user) {
  const totals = PLATFORMS.map((platform) => ({
    platform,
    count: user.submissions.filter((submission) => submission.platform === platform).length
  }));
  const total = totals.reduce((sum, item) => sum + item.count, 0);
  return totals.map((item) => ({
    ...item,
    percentage: total ? Math.round((item.count / total) * 100) : 0
  }));
}

async function loadUsers(currentUserId, comparedUsername) {
  const users = await pool.query(
    `SELECT u.id, u.username, p.display_name
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1 OR LOWER(u.username) = LOWER($2)`,
    [currentUserId, comparedUsername]
  );

  const current = users.rows.find((row) => row.id === currentUserId);
  const compared = users.rows.find((row) => row.id !== currentUserId && row.username.toLowerCase() === comparedUsername.toLowerCase());
  if (!compared) throw new HttpError(404, 'Compared username not found');

  const ids = [current.id, compared.id];
  const [accounts, contests, submissions, caches] = await Promise.all([
    pool.query('SELECT * FROM platform_accounts WHERE user_id = ANY($1) ORDER BY platform', [ids]),
    pool.query(
      `SELECT ch.*, pa.user_id
       FROM contest_history ch
       JOIN platform_accounts pa ON pa.id = ch.platform_account_id
       WHERE pa.user_id = ANY($1)
       ORDER BY ch.participated_at ASC`,
      [ids]
    ),
    pool.query(
      `SELECT sh.*, pa.user_id
       FROM submission_history sh
       JOIN platform_accounts pa ON pa.id = sh.platform_account_id
       WHERE pa.user_id = ANY($1)
       ORDER BY sh.submitted_at ASC`,
      [ids]
    ),
    pool.query(
      `SELECT user_id, payload
       FROM analytics_cache
       WHERE user_id = ANY($1) AND cache_key = 'analytics:combined' AND window_key = 'all' AND expires_at > NOW()`,
      [ids]
    )
  ]);

  function hydrate(row) {
    return {
      ...row,
      accounts: accounts.rows.filter((item) => item.user_id === row.id),
      contests: contests.rows.filter((item) => item.user_id === row.id),
      submissions: submissions.rows.filter((item) => item.user_id === row.id),
      combinedCache: caches.rows.find((item) => item.user_id === row.id)?.payload || null
    };
  }

  return { current: hydrate(current), compared: hydrate(compared) };
}

async function compareUsers(currentUserId, comparedUsername) {
  const users = await loadUsers(currentUserId, comparedUsername);

  if (users.compared.accounts.length === 0) {
    return {
      users: {
        current: { username: users.current.username, displayName: users.current.display_name || users.current.username },
        compared: { username: users.compared.username, displayName: users.compared.display_name || users.compared.username }
      },
      noComparedPlatformData: true,
      message: 'No platform data available.'
    };
  }

  const current = summarizeUser(users.current);
  const compared = summarizeUser(users.compared);
  const commonPlatforms = PLATFORMS.filter((platform) => current.connectedPlatforms.includes(platform) && compared.connectedPlatforms.includes(platform));
  const rows = comparisonRows(current, compared);
  const totals = rows.reduce((counts, row) => {
    counts[row.winner] = (counts[row.winner] || 0) + 1;
    return counts;
  }, { current: 0, compared: 0, tie: 0 });

  return {
    users: { current, compared },
    commonPlatforms,
    overview: {
      kpis: {
        cpInsightScore: current.cpInsightScore + compared.cpInsightScore,
        combinedMaxRating: current.combinedMaxRating + compared.combinedMaxRating,
        combinedContestCount: current.combinedContestCount + compared.combinedContestCount,
        combinedProblemsSolved: current.combinedProblemsSolved + compared.combinedProblemsSolved
      },
      rows,
      overallWinner: totals
    },
    ratingComparison: buildRatingCharts(users, commonPlatforms),
    heatmapComparison: buildHeatmap(current, compared),
    skillComparison: {
      axes: SKILL_AXES.map((axis) => axis.label),
      current: buildSkill(users.current),
      compared: buildSkill(users.compared)
    },
    contestIntelligence: buildContestComparison(users.current, users.compared),
    problemSolving: {
      buckets: RATING_BUCKETS.map((bucket) => bucket.label),
      current: buildProblemSolving(users.current),
      compared: buildProblemSolving(users.compared)
    },
    platformDistribution: {
      current: platformDistribution(users.current),
      compared: platformDistribution(users.compared)
    }
  };
}

module.exports = { compareUsers };
