/**
 * Normalized LeetCode data returned by this provider is shaped for CPInsight sync,
 * without exposing LeetCode's raw GraphQL or DOM structures to the rest of the extension.
 */

export const LeetCodeDatasetKind = Object.freeze({
  PROFILE: 'profile',
  SUBMISSIONS: 'submissions',
  RECENT_SUBMISSIONS: 'recentSubmissions',
  PROBLEM_METADATA: 'problemMetadata',
  CONTESTS: 'contests',
  LANGUAGE_STATS: 'languageStats',
  ACTIVITY: 'activity',
  BADGES: 'badges',
  BOOKMARKS: 'bookmarks'
});

export function createCollectionSnapshot({
  providerId,
  authenticated,
  currentUser = null,
  profile = null,
  submissions = [],
  recentSubmissions = [],
  problemMetadata = [],
  contests = [],
  languageStats = [],
  activity = null,
  badges = [],
  bookmarks = [],
  questionDataset = null,
  observedNetwork = [],
  warnings = [],
  collectedAt = new Date().toISOString()
}) {
  return {
    providerId,
    authenticated,
    currentUser,
    profile,
    submissions,
    recentSubmissions,
    problemMetadata,
    contests,
    languageStats,
    activity,
    badges,
    bookmarks,
    questionDataset,
    observedNetwork,
    warnings,
    collectedAt
  };
}
