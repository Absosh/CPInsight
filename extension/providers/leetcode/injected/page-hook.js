import { MessageSource, MessageType } from '../../../constants/message-types.js';
import { createEnvelope, isEnvelope } from '../../../messaging/envelope.js';
import { LeetCodeGraphQLClient } from '../graphql/client.js';
import { LeetCodeGraphQLOperation } from '../graphql/queries.js';
import { LeetCodeGraphQLParsers } from '../parsers/graphql-parsers.js';
import { UserProgressQuestionCollector } from '../graphql/progress-question-collector.js';
import { LeetCodeDomExtractionService } from '../dom/index.js';
import {
  normalizeActivity,
  normalizeBadges,
  normalizeBookmarks,
  normalizeContestRanking,
  normalizeCurrentUser,
  normalizeLanguageStats,
  normalizeProfile,
  normalizeRecentSubmission,
  normalizeSubmission
} from '../normalizers/leetcode-normalizer.js';
import { createCollectionSnapshot } from '../models/cpinsight-models.js';
import { LeetCodeConfig } from '../config.js';
import { ProviderId } from '../../../constants/provider-ids.js';
import { LeetCodeNetworkObserver } from '../network/observer.js';
import { createLogger } from '../../../utils/logger.js';
import { AppConfig } from '../../../config/defaults.js';

const logger = createLogger('LeetCode');
const collectorLogger = createLogger('Collector');
const bootstrapLogger = createLogger('Bootstrap');
const chainLogger = createLogger('Chain');
const stageLogger = createLogger('StageTrace');
const guardLogger = createLogger('Guard');
const graphqlClient = new LeetCodeGraphQLClient({ logger: collectorLogger });
const progressQuestionCollector = new UserProgressQuestionCollector({ client: graphqlClient, logger: collectorLogger });
const domService = new LeetCodeDomExtractionService({ domReadyTimeoutMs: LeetCodeConfig.domReadyTimeoutMs });
const networkObserver = new LeetCodeNetworkObserver();
const observedNetwork = [];
let collectCommandReceived = false;
const pageCollectionGuard = {
  running: false,
  sessionId: null,
  nonce: null
};

bootstrapLogger.info('Page hook loaded');
bootstrapLogger.info('Collector registered');

function reply(correlationId, payload, auth = {}) {
  window.postMessage(createEnvelope({
    type: MessageType.PAGE_COMMAND_RESULT,
    source: MessageSource.INJECTED,
    target: MessageSource.CONTENT,
    providerId: ProviderId.LEETCODE,
    correlationId,
    payload: {
      ...payload,
      command: auth.command || payload.command || null,
      sessionId: auth.sessionId || payload.sessionId || null,
      nonce: auth.nonce || payload.nonce || null,
      correlationId,
      timestamp: new Date().toISOString()
    }
  }), window.location.origin);
}

function logCollectorError(stageName, error) {
  collectorLogger.error(`Stage name: ${stageName}`);
  collectorLogger.error(`Exception message: ${error?.message || 'Unknown error'}`);
  collectorLogger.error(`Complete stack trace: ${error?.stack || 'No stack trace available'}`);
}

function cancelActiveCollection({ sessionId = null, nonce = null, reason = 'LeetCode collection cancelled' } = {}) {
  guardLogger.info('Incoming event: leetcode:cancel');
  guardLogger.info(`Current state: ${pageCollectionGuard.running ? 'RUNNING' : 'IDLE'}`);
  guardLogger.info(`Current sessionId: ${pageCollectionGuard.sessionId || 'none'}`);
  guardLogger.info(`Incoming sessionId: ${sessionId || 'none'}`);
  if (sessionId && pageCollectionGuard.sessionId && sessionId !== pageCollectionGuard.sessionId) {
    guardLogger.info('Cancel ignored: sessionId mismatch');
    return { cancelled: false, reason: 'sessionId mismatch' };
  }
  if (nonce && pageCollectionGuard.nonce && nonce !== pageCollectionGuard.nonce) {
    guardLogger.info('Cancel ignored: nonce mismatch');
    return { cancelled: false, reason: 'nonce mismatch' };
  }

  graphqlClient.cancelActiveRequests(reason);
  collectorLogger.debug('Active GraphQL requests aborted');
  return {
    cancelled: true,
    sessionId: pageCollectionGuard.sessionId || sessionId,
    nonce: pageCollectionGuard.nonce || nonce,
    reason
  };
}

function isFreshCommandTimestamp(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && Math.abs(Date.now() - parsed) <= AppConfig.messaging.pageCommandMaxAgeMs;
}

function rejectPageCommand(reason, payload = {}) {
  guardLogger.info('Rejected page command');
  guardLogger.info(`Reason: ${reason}`);
  return {
    rejected: true,
    reason,
    command: payload.command || null,
    sessionId: payload.sessionId || null,
    nonce: payload.nonce || null
  };
}

function validatePageCommand(message, event) {
  const payload = message.payload || {};
  if (event.origin !== window.location.origin) return 'origin mismatch';
  if (message.providerId !== ProviderId.LEETCODE || payload.providerId !== ProviderId.LEETCODE) return 'provider mismatch';
  if (message.source !== MessageSource.CONTENT || message.target !== MessageSource.INJECTED) return 'source/target mismatch';
  if (!message.correlationId || message.correlationId !== payload.correlationId) return 'correlationId mismatch';
  if (!isFreshCommandTimestamp(payload.timestamp)) return 'expired timestamp';
  if (!['leetcode:collect', 'leetcode:cancel', 'leetcode:get-current-user', 'leetcode:is-authenticated'].includes(payload.command)) {
    return 'unexpected command';
  }
  if ((payload.command === 'leetcode:collect' || payload.command === 'leetcode:cancel') && (!payload.sessionId || !payload.nonce)) {
    return 'missing session authentication';
  }
  if (payload.command === 'leetcode:collect' && !['profile', 'progress'].includes(payload.stage)) {
    return 'unexpected collection stage';
  }
  if (pageCollectionGuard.sessionId && payload.sessionId && pageCollectionGuard.sessionId !== payload.sessionId) {
    return 'sessionId mismatch';
  }
  if (pageCollectionGuard.nonce && payload.nonce && pageCollectionGuard.nonce !== payload.nonce) {
    return 'nonce mismatch';
  }
  return null;
}

async function runOperation(operationKey, input) {
  const data = await graphqlClient.execute(operationKey, input);
  return LeetCodeGraphQLParsers[operationKey](data);
}

async function getCurrentUser() {
  const userStatus = await runOperation(LeetCodeGraphQLOperation.GLOBAL_DATA);
  const currentUser = normalizeCurrentUser(userStatus);
  logger.debug(`Authentication detected: ${Boolean(currentUser.isSignedIn)}`);
  logger.debug(`Current username: ${currentUser.username || 'unknown'}`);
  return currentUser;
}

async function collectAuthenticatedData() {
  bootstrapLogger.info('Collector invoked');
  try {
    collectorLogger.debug('Collector starting');
    const warnings = [];
    collectorLogger.debug('Checking authenticated session');
    let currentUser;

    try {
      currentUser = await getCurrentUser();
    } catch (error) {
      logCollectorError('Authentication', error);
      throw error;
    }

    if (!currentUser.isSignedIn || !currentUser.username) {
      collectorLogger.debug('Authentication unavailable');
      collectorLogger.debug('Collection aborted');
      const snapshot = createCollectionSnapshot({
        providerId: ProviderId.LEETCODE,
        authenticated: false,
        currentUser,
        observedNetwork: observedNetwork.slice(),
        warnings: ['LeetCode session is not authenticated.']
      });
      logger.debug('Normalization succeeded: true');
      return snapshot;
    }

    collectorLogger.debug('Authenticated session detected');
    const username = currentUser.username;
    const [profileData, recentAccepted, recentSubmissions, contestData, progressQuestionData, favorites, domData] = await Promise.allSettled([
      runOperation(LeetCodeGraphQLOperation.USER_PROFILE, { username }),
      runOperation(LeetCodeGraphQLOperation.RECENT_AC_SUBMISSIONS, { username, limit: 100 }),
      runOperation(LeetCodeGraphQLOperation.RECENT_SUBMISSIONS, { username, limit: 100 }),
      runOperation(LeetCodeGraphQLOperation.USER_CONTESTS, { username }),
      progressQuestionCollector.collect(),
      runOperation(LeetCodeGraphQLOperation.FAVORITES),
      domService.extractAll()
    ]);

    const read = (result, fallback, label) => {
      if (result.status === 'fulfilled') return result.value;
      if (label === 'Question progress') {
        logCollectorError('Question progress collection', result.reason);
      }
      warnings.push(`${label} unavailable: ${result.reason?.message || 'unknown error'}`);
      return fallback;
    };

    const profilePayload = read(profileData, {}, 'Profile');
    const acceptedPayload = read(recentAccepted, [], 'Accepted submissions');
    const recentPayload = read(recentSubmissions, [], 'Recent submissions');
    const contestPayload = read(contestData, { ranking: {}, history: [] }, 'Contest history');
    const questionDataset = read(progressQuestionData, null, 'Question progress');
    const favoritesPayload = read(favorites, [], 'Favorites');
    const domPayload = read(domData, {}, 'DOM extraction');

    const profile = normalizeProfile({
      username,
      matchedUser: profilePayload.matchedUser,
      publicProfile: profilePayload.publicProfile,
      domProfile: domPayload.profile
    });

    const snapshot = createCollectionSnapshot({
      providerId: ProviderId.LEETCODE,
      authenticated: true,
      currentUser,
      profile,
      submissions: [
        ...acceptedPayload.map(normalizeRecentSubmission),
        ...recentPayload.map(normalizeSubmission)
      ],
      recentSubmissions: recentPayload.map(normalizeSubmission),
      problemMetadata: questionDataset?.questions || [],
      contests: normalizeContestRanking(contestPayload.ranking, contestPayload.history),
      languageStats: normalizeLanguageStats(profilePayload.matchedUser?.languageProblemCount),
      activity: normalizeActivity(profilePayload.matchedUser?.submissionCalendar),
      badges: normalizeBadges(profilePayload.matchedUser?.badges),
      bookmarks: normalizeBookmarks(favoritesPayload),
      questionDataset,
      observedNetwork: observedNetwork.slice(),
      warnings
    });

    logger.debug(`Number of GraphQL requests observed: ${observedNetwork.length}`);
    logger.debug(`Number of submissions collected: ${snapshot.submissions.length}`);
    logger.debug(`Number of contests collected: ${snapshot.contests.history.length}`);
    logger.debug(`Number of activity records collected: ${snapshot.activity?.days?.length || 0}`);
    logger.debug(`Number of problems collected: ${snapshot.questionDataset?.questions?.length || 0}`);
    logger.debug('Normalization succeeded: true');

    return snapshot;
  } catch (error) {
    logCollectorError('Authenticated data collection', error);
    throw error;
  }
}

async function collectProfileStage() {
  chainLogger.info('Step 8 Collector starts: reached profile collector');
  bootstrapLogger.info('Profile collector invoked');
  const warnings = [];
  collectorLogger.debug('Checking authenticated session');
  const currentUser = await getCurrentUser();

  if (!currentUser.isSignedIn || !currentUser.username) {
    collectorLogger.debug('Authentication unavailable');
    collectorLogger.debug('Collection aborted');
    return {
      authenticated: false,
      currentUser,
      warnings: ['LeetCode session is not authenticated.']
    };
  }

  const username = currentUser.username;
  const [profileData, recentAccepted, recentSubmissions, contestData, domData] = await Promise.allSettled([
    runOperation(LeetCodeGraphQLOperation.USER_PROFILE, { username }),
    runOperation(LeetCodeGraphQLOperation.RECENT_AC_SUBMISSIONS, { username, limit: 100 }),
    runOperation(LeetCodeGraphQLOperation.RECENT_SUBMISSIONS, { username, limit: 100 }),
    runOperation(LeetCodeGraphQLOperation.USER_CONTESTS, { username }),
    domService.extractAll()
  ]);

  const read = (result, fallback, label) => {
    if (result.status === 'fulfilled') return result.value;
    warnings.push(`${label} unavailable: ${result.reason?.message || 'unknown error'}`);
    return fallback;
  };

  const profilePayload = read(profileData, {}, 'Profile');
  const hasUserProfileCalendar = profileData.status === 'fulfilled' &&
    Boolean(profilePayload.matchedUser) &&
    Object.prototype.hasOwnProperty.call(profilePayload.matchedUser, 'submissionCalendar') &&
    profilePayload.matchedUser.submissionCalendar != null;
  const acceptedPayload = read(recentAccepted, [], 'Accepted submissions');
  const recentPayload = read(recentSubmissions, [], 'Recent submissions');
  const contestPayload = read(contestData, { ranking: {}, history: [] }, 'Contest history');
  const domPayload = read(domData, {}, 'DOM extraction');
  const profile = normalizeProfile({
    username,
    matchedUser: profilePayload.matchedUser,
    publicProfile: profilePayload.publicProfile,
    domProfile: domPayload.profile
  });

  return {
    authenticated: true,
    currentUser,
    username,
    profile,
    submissions: [
      ...acceptedPayload.map(normalizeRecentSubmission),
      ...recentPayload.map(normalizeSubmission)
    ],
    recentSubmissions: recentPayload.map(normalizeSubmission),
    contests: normalizeContestRanking(contestPayload.ranking, contestPayload.history),
    languageStats: normalizeLanguageStats(profilePayload.matchedUser?.languageProblemCount),
    activity: normalizeActivity(profilePayload.matchedUser?.submissionCalendar),
    mandatoryDatasets: {
      userProfileCalendar: hasUserProfileCalendar
    },
    badges: normalizeBadges(profilePayload.matchedUser?.badges),
    observedNetwork: observedNetwork.slice(),
    warnings
  };
}

async function collectProgressStage() {
  chainLogger.info('Step 8 Collector starts: reached progress collector');
  bootstrapLogger.info('Progress collector invoked');
  const warnings = [];
  collectorLogger.debug('Checking authenticated session');
  const currentUser = await getCurrentUser();

  if (!currentUser.isSignedIn || !currentUser.username) {
    collectorLogger.debug('Authentication unavailable');
    collectorLogger.debug('Collection aborted');
    return {
      authenticated: false,
      currentUser,
      warnings: ['LeetCode session is not authenticated.']
    };
  }

  const [progressQuestionData, favorites] = await Promise.allSettled([
    progressQuestionCollector.collect(),
    runOperation(LeetCodeGraphQLOperation.FAVORITES)
  ]);

  const read = (result, fallback, label) => {
    if (result.status === 'fulfilled') return result.value;
    if (label === 'Question progress') {
      logCollectorError('Question progress collection', result.reason);
    }
    warnings.push(`${label} unavailable: ${result.reason?.message || 'unknown error'}`);
    return fallback;
  };

  const questionDataset = read(progressQuestionData, null, 'Question progress');
  const favoritesPayload = read(favorites, [], 'Favorites');

  return {
    authenticated: true,
    currentUser,
    username: currentUser.username,
    problemMetadata: questionDataset?.questions || [],
    questionDataset,
    bookmarks: normalizeBookmarks(favoritesPayload),
    observedNetwork: observedNetwork.slice(),
    warnings
  };
}

async function handleCommand(message) {
  const command = message.payload?.command;
  stageLogger.info('Page hook handleCommand payload', message.payload);
  chainLogger.info(`Step 7 Page hook command handling: reached; command=${command || 'unknown'}, stage=${message.payload?.stage || 'none'}`);
  bootstrapLogger.info(`Page hook message trigger fired: ${command || 'unknown'}`);
  if (command === 'leetcode:get-current-user') return getCurrentUser();
  if (command === 'leetcode:is-authenticated') return { authenticated: Boolean((await getCurrentUser()).isSignedIn) };
  if (command === 'leetcode:cancel') {
    return cancelActiveCollection({
      sessionId: message.payload?.sessionId || null,
      nonce: message.payload?.nonce || null,
      reason: message.payload?.reason || 'LeetCode collection cancelled'
    });
  }
  if (command === 'leetcode:collect') {
    chainLogger.info('Step 7 Page hook received leetcode:collect: reached');
    guardLogger.info(`Current state: ${pageCollectionGuard.running ? 'RUNNING' : 'IDLE'}`);
    guardLogger.info('Incoming event: leetcode:collect');
    guardLogger.info(`Current sessionId: ${pageCollectionGuard.sessionId || 'none'}`);
    guardLogger.info(`Incoming sessionId: ${message.payload?.sessionId || 'none'}`);
    if (pageCollectionGuard.running) {
      guardLogger.info(message.payload?.sessionId !== pageCollectionGuard.sessionId
        ? 'Ignored duplicate session'
        : 'Ignored duplicate leetcode:collect');
      return { ignored: true, reason: 'collection already running' };
    }

    pageCollectionGuard.running = true;
    pageCollectionGuard.sessionId = message.payload?.sessionId || null;
    pageCollectionGuard.nonce = message.payload?.nonce || null;
    collectCommandReceived = true;
    bootstrapLogger.info('Page hook received leetcode:collect');
    collectorLogger.debug('Collector scheduled');
    try {
      if (message.payload?.stage === 'profile') return await collectProfileStage();
      if (message.payload?.stage === 'progress') return await collectProgressStage();
      chainLogger.info(`Step 8 Collector stage selection: skipped specific stage; reason=stage not profile/progress; value=${message.payload?.stage || 'none'}`);
      return await collectAuthenticatedData();
    } finally {
      pageCollectionGuard.running = false;
      pageCollectionGuard.sessionId = null;
      pageCollectionGuard.nonce = null;
    }
  }
  chainLogger.info(`Step 7 Page hook command handling: skipped; conditional=unsupported command; value=${command || 'unknown'}`);
  throw new Error(`Unsupported LeetCode page command: ${command}`);
}

window.addEventListener('message', async (event) => {
  if (event.source !== window || !isEnvelope(event.data)) {
    chainLogger.info(`Step 7 Page hook event listener: skipped; reason=${event.source !== window ? 'event.source !== window' : 'invalid envelope'}`);
    return;
  }
  if (event.data.target !== MessageSource.INJECTED || event.data.type !== MessageType.PAGE_COMMAND) {
    chainLogger.info(`Step 7 Page hook event listener: skipped; conditional=target/type mismatch; target=${event.data.target || 'none'}, type=${event.data.type || 'none'}`);
    return;
  }
  const rejectionReason = validatePageCommand(event.data, event);
  if (rejectionReason) {
    reply(event.data.correlationId, {
      ok: false,
      error: {
        message: rejectionReason,
        name: 'RejectedPageCommand'
      }
    }, event.data.payload);
    return;
  }
  chainLogger.info('Step 7 Page hook event listener: reached');
  stageLogger.info('Page hook event.data payload', event.data.payload);
  bootstrapLogger.info('Page hook event listener trigger fired');

  try {
    reply(event.data.correlationId, {
      ok: true,
      data: await handleCommand(event.data)
    }, event.data.payload);
  } catch (error) {
    reply(event.data.correlationId, {
      ok: false,
      error: {
        message: error?.message || 'LeetCode page command failed',
        name: error?.name || 'Error'
      }
    }, event.data.payload);
  }
});

window.addEventListener('message', (event) => {
  if (event.source !== window || !isEnvelope(event.data)) return;
  if (
    event.origin === window.location.origin &&
    event.data.source === MessageSource.INJECTED &&
    event.data.target === MessageSource.CONTENT &&
    event.data.providerId === ProviderId.LEETCODE &&
    event.data.type === MessageType.NETWORK_EVENT
  ) {
    observedNetwork.push(event.data.payload);
    if (observedNetwork.length > 100) observedNetwork.shift();
    logger.debug(`Observed GraphQL operation name: ${event.data.payload?.operationName || 'unknown'}`);
    logger.debug(`Number of GraphQL requests observed: ${observedNetwork.length}`);
  }
});

networkObserver.start();
bootstrapLogger.info('Page hook event listener registered');
bootstrapLogger.info('Network observer started');

setTimeout(() => {
  if (!collectCommandReceived) {
    bootstrapLogger.info('Collector never invoked.');
  }
  bootstrapLogger.info('=============================');
  bootstrapLogger.info('[CPInsight:Bootstrap Summary]');
  bootstrapLogger.info('Content script loaded: content realm');
  bootstrapLogger.info('Injected bridge loaded: true');
  bootstrapLogger.info('Page hook loaded: true');
  bootstrapLogger.info('Provider imported: background realm');
  bootstrapLogger.info('Provider initialized: background realm');
  bootstrapLogger.info('Collector registered: true');
  bootstrapLogger.info(`Collector invoked: ${collectCommandReceived}`);
  bootstrapLogger.info(`Reason collector did not execute (if applicable): ${collectCommandReceived ? 'collect command received by page hook' : 'no leetcode:collect PAGE_COMMAND received by page hook'}`);
  bootstrapLogger.info('=============================');
}, AppConfig.debug.bootstrapSummaryDelayMs);
