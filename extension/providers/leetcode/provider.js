import { ProviderId } from '../../constants/provider-ids.js';
import { MessageSource, MessageType } from '../../constants/message-types.js';
import { createProviderContract } from '../provider-contract.js';
import { ExtensionError, ErrorKind } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

let runtimeContext = null;
let lastSnapshot = null;
let lastObservedNetwork = [];
const logger = createLogger('LeetCode');
const collectorLogger = createLogger('Collector');
const bootstrapLogger = createLogger('Bootstrap');

bootstrapLogger.info('Provider module imported');

function mergeObservedNetwork(...groups) {
  const seen = new Set();
  return groups.flat().filter((event) => {
    const key = [
      event?.transport,
      event?.operationName,
      event?.status,
      event?.observedAt
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function sendTabCommand(tabId, type) {
  if (!runtimeContext?.messageBus || !tabId) {
    throw new ExtensionError('A LeetCode tab id is required for authenticated page collection', {
      kind: ErrorKind.PROVIDER
    });
  }

  const response = await runtimeContext.messageBus.sendTab(tabId, {
    type,
    target: MessageSource.CONTENT,
    providerId: ProviderId.LEETCODE,
    payload: {}
  });

  if (!response?.ok) {
    throw new ExtensionError(response?.error?.message || 'LeetCode content command failed', {
      kind: ErrorKind.PROVIDER
    });
  }

  return response.data;
}

export const leetcodeProvider = createProviderContract({
  id: ProviderId.LEETCODE,
  displayName: 'LeetCode',

  async initialize(context) {
    runtimeContext = context;
    logger.debug('Provider initialization complete');
    collectorLogger.debug('Provider initialized');
    bootstrapLogger.info('Provider initialized');
    bootstrapLogger.info(`Collector registered: ${typeof this.collectQuestionDataset === 'function' || typeof this.collectAll === 'function'}`);
  },

  async isAuthenticated(options = {}) {
    if (options.tabId) {
      const result = await sendTabCommand(options.tabId, MessageType.PROVIDER_AUTH_CHECK);
      logger.debug(`Authentication detected: ${Boolean(result?.authenticated)}`);
      logger.debug(`Current username: ${result?.currentUser?.username || 'unknown'}`);
      return Boolean(result?.authenticated);
    }
    logger.debug(`Authentication detected: ${Boolean(lastSnapshot?.authenticated)}`);
    logger.debug(`Current username: ${lastSnapshot?.currentUser?.username || 'unknown'}`);
    return Boolean(lastSnapshot?.authenticated);
  },

  async getCurrentUser(options = {}) {
    if (options.tabId) {
      const result = await sendTabCommand(options.tabId, MessageType.PROVIDER_AUTH_CHECK);
      logger.debug(`Current username: ${result?.currentUser?.username || 'unknown'}`);
      return result?.currentUser || null;
    }
    logger.debug(`Current username: ${lastSnapshot?.currentUser?.username || 'unknown'}`);
    return lastSnapshot?.currentUser || null;
  },

  async collectProfile(options = {}) {
    if (options.tabId) await this.collectAll(options);
    return lastSnapshot?.profile || null;
  },

  async collectSubmissionHistory(options = {}) {
    if (options.tabId) await this.collectAll(options);
    return lastSnapshot?.submissions || [];
  },

  async collectRecentSubmissions(options = {}) {
    if (options.tabId) await this.collectAll(options);
    return lastSnapshot?.recentSubmissions || [];
  },

  async collectSubmissions(options = {}) {
    return this.collectSubmissionHistory(options);
  },

  async collectProblemMetadata(options = {}) {
    if (options.tabId) await this.collectAll(options);
    return lastSnapshot?.problemMetadata || [];
  },

  async collectQuestionDataset(options = {}) {
    if (options.tabId) await this.collectAll(options);
    return lastSnapshot?.questionDataset || null;
  },

  async collectContestHistory(options = {}) {
    if (options.tabId) await this.collectAll(options);
    return lastSnapshot?.contests || [];
  },

  async collectContests(options = {}) {
    return this.collectContestHistory(options);
  },

  async collectLanguageStatistics(options = {}) {
    if (options.tabId) await this.collectAll(options);
    return lastSnapshot?.languageStats || [];
  },

  async collectActivity(options = {}) {
    if (options.tabId) await this.collectAll(options);
    return lastSnapshot?.activity || null;
  },

  async collectAll(options = {}) {
    bootstrapLogger.info('Collector invoked');
    collectorLogger.debug('Collector scheduled');
    const snapshot = await sendTabCommand(options.tabId, MessageType.PROVIDER_COLLECT_REQUEST);
    lastSnapshot = {
      ...snapshot,
      observedNetwork: mergeObservedNetwork(snapshot?.observedNetwork || [], lastObservedNetwork)
    };
    logger.debug(`Number of GraphQL requests observed: ${lastSnapshot.observedNetwork.length}`);
    return lastSnapshot;
  },

  ingestCollectionResult(snapshot) {
    lastSnapshot = snapshot;
    logger.debug(`Number of submissions collected: ${lastSnapshot?.submissions?.length || 0}`);
    logger.debug(`Number of contests collected: ${lastSnapshot?.contests?.history?.length || 0}`);
    logger.debug(`Number of activity records collected: ${lastSnapshot?.activity?.days?.length || 0}`);
    logger.debug(`Number of problems collected: ${lastSnapshot?.questionDataset?.questions?.length || lastSnapshot?.problemMetadata?.length || 0}`);
    return lastSnapshot;
  },

  ingestNetworkEvent(event) {
    lastObservedNetwork.push(event);
    if (lastObservedNetwork.length > 100) lastObservedNetwork.shift();
    logger.debug(`Observed GraphQL operation name: ${event?.operationName || 'unknown'}`);
    logger.debug(`Number of GraphQL requests observed: ${lastObservedNetwork.length}`);
    return event;
  },

  async sync() {
    throw new ExtensionError('Backend synchronization is intentionally not implemented in Prompt 2', {
      kind: ErrorKind.PROVIDER
    });
  },

  async cleanup() {
    runtimeContext = null;
    lastSnapshot = null;
    lastObservedNetwork = [];
  }
});
