const axios = require('axios');
const env = require('../../config/env');
const { getJson, setJson } = require('../../redis/client');

const PROFILE_QUERY = `
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile { realName ranking userAvatar }
    submitStatsGlobal {
      acSubmissionNum { difficulty count submissions }
    }
  }
}
`;

const CALENDAR_QUERY = `
query userCalendar($username: String!, $year: Int) {
  matchedUser(username: $username) {
    userCalendar(year: $year) {
      activeYears
      streak
      totalActiveDays
      submissionCalendar
    }
  }
}
`;

const RECENT_AC_SUBMISSIONS_QUERY = `
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id
    title
    titleSlug
    timestamp
  }
}
`;

function normalizeSubmissionCalendar(submissionCalendar) {
  if (!submissionCalendar) return {};

  let raw = submissionCalendar;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (!raw || typeof raw !== 'object') return {};

  const normalized = {};
  for (const [epoch, value] of Object.entries(raw)) {
    const epochMs = Number(epoch) * 1000;
    if (!Number.isFinite(epochMs)) continue;

    const dateKey = new Date(epochMs).toISOString().slice(0, 10);
    const count = Number(value || 0);
    normalized[dateKey] = Number.isFinite(count) ? count : 0;
  }

  return normalized;
}

async function getPublicProfile(username) {
  const cacheKey = `upstream:leetcode:profile:${username.toLowerCase()}`;
  const cached = await getJson(cacheKey).catch(() => null);
  if (cached) return cached;

  const { data } = await axios.post(
    env.platforms.leetcodeGraphqlEndpoint,
    { query: PROFILE_QUERY, variables: { username } },
    { timeout: 10000, headers: { 'content-type': 'application/json' } }
  );

  const profile = data.data && data.data.matchedUser;
  await setJson(cacheKey, profile, 900).catch(() => {});
  return profile;
}

async function getUserCalendar(username, year = null) {
  const yearKey = Number.isInteger(year) ? year : 'all';
  const cacheKey = `upstream:leetcode:calendar:${username.toLowerCase()}:${yearKey}`;
  const cached = await getJson(cacheKey).catch(() => null);
  if (cached) return cached;

  const headers = { 'content-type': 'application/json' };
  const variables = Number.isInteger(year) ? { username, year } : { username, year: null };

  const primary = await axios.post(
    env.platforms.leetcodeGraphqlEndpoint,
    { query: CALENDAR_QUERY, variables },
    { timeout: 10000, headers }
  );

  const calendar = primary.data?.data?.matchedUser?.userCalendar || null;

  const normalized = {
    activeYears: Array.isArray(calendar?.activeYears) ? calendar.activeYears : [],
    streak: Number(calendar?.streak || 0),
    totalActiveDays: Number(calendar?.totalActiveDays || 0),
    dayCounts: normalizeSubmissionCalendar(calendar?.submissionCalendar)
  };

  await setJson(cacheKey, normalized, 900).catch(() => {});
  return normalized;
}

async function getRecentAcSubmissions(username, limit = 50) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 50;
  const cacheKey = `upstream:leetcode:recent-ac:${username.toLowerCase()}:${safeLimit}`;
  const cached = await getJson(cacheKey).catch(() => null);
  if (cached) return cached;

  const { data } = await axios.post(
    env.platforms.leetcodeGraphqlEndpoint,
    {
      query: RECENT_AC_SUBMISSIONS_QUERY,
      variables: { username, limit: safeLimit }
    },
    {
      timeout: 10000,
      headers: { 'content-type': 'application/json' }
    }
  );

  const submissions = Array.isArray(data?.data?.recentAcSubmissionList)
    ? data.data.recentAcSubmissionList
    : [];

  await setJson(cacheKey, submissions, 900).catch(() => {});
  return submissions;
}

module.exports = { getPublicProfile, getUserCalendar, getRecentAcSubmissions };
