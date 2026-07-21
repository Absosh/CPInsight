import {
  optionalArray,
  optionalNumber,
  optionalObject,
  optionalString,
  parseJsonObject
} from '../validators/schema.js';

function secondsToIso(seconds) {
  const value = optionalNumber(seconds);
  return value ? new Date(value * 1000).toISOString() : null;
}

function normalizeTimestamp(value) {
  if (typeof value === 'number') {
    return new Date(value < 1000000000000 ? value * 1000 : value).toISOString();
  }
  const text = optionalString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

function normalizeDifficulty(value) {
  const difficulty = optionalString(value);
  return difficulty ? difficulty.toLowerCase() : null;
}

function normalizeStatus(value) {
  const status = optionalString(value);
  return status ? status.toLowerCase() : 'unknown';
}

export function normalizeCurrentUser(userStatus = {}) {
  return {
    username: optionalString(userStatus.username),
    realName: optionalString(userStatus.realName),
    avatarUrl: optionalString(userStatus.avatar),
    slug: optionalString(userStatus.userSlug),
    isSignedIn: Boolean(userStatus.isSignedIn)
  };
}

export function normalizeProfile({ username, matchedUser = null, publicProfile = null, domProfile = null } = {}) {
  const profile = optionalObject(matchedUser?.profile) || optionalObject(publicProfile?.profile) || {};
  const submitStats = optionalObject(matchedUser?.submitStats);
  const acStats = optionalArray(submitStats?.acSubmissionNum);

  return {
    platform: 'leetcode',
    username: optionalString(matchedUser?.username) || optionalString(publicProfile?.username) || optionalString(username),
    realName: optionalString(profile.realName) || optionalString(publicProfile?.realName) || optionalString(domProfile?.realName),
    avatarUrl: optionalString(profile.userAvatar) || optionalString(publicProfile?.avatarUrl) || optionalString(domProfile?.avatarUrl),
    ranking: optionalNumber(profile.ranking) || optionalNumber(domProfile?.ranking),
    reputation: optionalNumber(profile.reputation),
    countryName: optionalString(profile.countryName),
    company: optionalString(profile.company),
    school: optionalString(profile.school),
    about: optionalString(profile.aboutMe),
    websites: optionalArray(profile.websites).filter(Boolean),
    skillTags: optionalArray(profile.skillTags).filter(Boolean),
    solvedByDifficulty: acStats.map((item) => ({
      difficulty: normalizeDifficulty(item.difficulty),
      count: optionalNumber(item.count) || 0,
      submissions: optionalNumber(item.submissions) || 0
    }))
  };
}

export function normalizeRecentSubmission(item = {}) {
  return {
    providerSubmissionId: optionalString(item.id),
    title: optionalString(item.title),
    problemSlug: optionalString(item.titleSlug),
    submittedAt: secondsToIso(item.timestamp),
    status: 'accepted',
    language: optionalString(item.lang),
    runtime: optionalString(item.runtime),
    memory: optionalString(item.memory),
    source: 'leetcode'
  };
}

export function normalizeSubmission(item = {}) {
  return {
    providerSubmissionId: optionalString(item.id) || optionalString(item.submissionId),
    title: optionalString(item.title),
    problemSlug: optionalString(item.titleSlug),
    submittedAt: secondsToIso(item.timestamp) || optionalString(item.submittedAt),
    status: optionalString(item.statusDisplay) || optionalString(item.status) || 'unknown',
    language: optionalString(item.lang) || optionalString(item.language),
    runtime: optionalString(item.runtime),
    memory: optionalString(item.memory),
    difficulty: normalizeDifficulty(item.difficulty),
    source: 'leetcode'
  };
}

export function normalizeProblem(item = {}) {
  return {
    title: optionalString(item.title),
    slug: optionalString(item.titleSlug),
    difficulty: normalizeDifficulty(item.difficulty),
    acceptanceRate: optionalNumber(item.acRate),
    paidOnly: Boolean(item.isPaidOnly),
    topics: optionalArray(item.topicTags).map((tag) => ({
      name: optionalString(tag?.name),
      slug: optionalString(tag?.slug)
    })).filter((tag) => tag.name || tag.slug)
  };
}

export function normalizeProgressQuestion(item = {}) {
  return Object.freeze({
    provider: 'leetcode',
    questionId: optionalString(item.questionId) || optionalString(item.frontendId),
    frontendId: optionalString(item.frontendId),
    slug: optionalString(item.titleSlug),
    title: optionalString(item.title),
    translatedTitle: optionalString(item.translatedTitle),
    difficulty: normalizeDifficulty(item.difficulty),
    solvedStatus: normalizeStatus(item.questionStatus),
    lastSolvedAt: normalizeTimestamp(item.lastSubmittedAt),
    submissionCount: optionalNumber(item.numSubmitted) || 0,
    latestResult: optionalString(item.lastResult),
    topics: optionalArray(item.topicTags).map((tag) => Object.freeze({
      name: optionalString(tag?.name),
      slug: optionalString(tag?.slug),
      translatedName: optionalString(tag?.translatedName)
    })).filter((tag) => tag.name || tag.slug || tag.translatedName),
    rawAdditionalFields: Object.freeze(Object.fromEntries(
      Object.entries(item).filter(([key]) => ![
        'frontendId',
        'questionId',
        'title',
        'translatedTitle',
        'titleSlug',
        'difficulty',
        'lastSubmittedAt',
        'numSubmitted',
        'questionStatus',
        'lastResult',
        'topicTags'
      ].includes(key))
    ))
  });
}

export function normalizeContestRanking(ranking = {}, history = []) {
  return {
    attendedContestsCount: optionalNumber(ranking.attendedContestsCount) || 0,
    rating: optionalNumber(ranking.rating),
    globalRanking: optionalNumber(ranking.globalRanking),
    totalParticipants: optionalNumber(ranking.totalParticipants),
    topPercentage: optionalNumber(ranking.topPercentage),
    badge: optionalString(ranking.badge?.name),
    history: optionalArray(history).filter((item) => item && item.attended !== false).map((item) => ({
      contestTitle: optionalString(item.contest?.title),
      contestStartTime: secondsToIso(item.contest?.startTime),
      finishTime: secondsToIso(item.finishTimeInSeconds),
      rating: optionalNumber(item.rating),
      ranking: optionalNumber(item.ranking),
      problemsSolved: optionalNumber(item.problemsSolved),
      totalProblems: optionalNumber(item.totalProblems),
      trendDirection: optionalString(item.trendDirection)
    }))
  };
}

export function normalizeLanguageStats(items = []) {
  return optionalArray(items).map((item) => ({
    language: optionalString(item.languageName),
    problemsSolved: optionalNumber(item.problemsSolved) || 0
  })).filter((item) => item.language);
}

export function normalizeActivity(calendarJson) {
  const calendar = parseJsonObject(calendarJson, {});
  const days = Object.entries(calendar).map(([timestamp, count]) => ({
    date: secondsToIso(timestamp)?.slice(0, 10) || null,
    timestamp: optionalNumber(timestamp),
    count: optionalNumber(count) || 0
  })).filter((day) => day.date);

  return {
    totalActiveDays: days.filter((day) => day.count > 0).length,
    totalSubmissions: days.reduce((sum, day) => sum + day.count, 0),
    days
  };
}

export function normalizeBadges(items = []) {
  return optionalArray(items).map((item) => ({
    id: optionalString(item.id),
    name: optionalString(item.displayName) || optionalString(item.name),
    iconUrl: optionalString(item.icon)
  })).filter((item) => item.id || item.name);
}

export function normalizeBookmarks(items = []) {
  return optionalArray(items).map((item) => ({
    id: optionalString(item.id),
    name: optionalString(item.name),
    slug: optionalString(item.slug)
  })).filter((item) => item.id || item.slug || item.name);
}
