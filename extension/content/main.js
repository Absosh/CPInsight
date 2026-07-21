import { MessageSource, MessageType } from '../constants/message-types.js';
import { AppConfig } from '../config/defaults.js';
import { ProviderId } from '../constants/provider-ids.js';
import { createEnvelope } from '../messaging/envelope.js';
import { PageBridge } from '../messaging/page-bridge.js';
import { detectLeetCodePageState } from '../providers/leetcode/content/page-detector.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('content');
const bootstrapLogger = createLogger('Bootstrap');
const chainLogger = createLogger('Chain');
const stageLogger = createLogger('StageTrace');
const guardLogger = createLogger('Guard');
const providerId = ProviderId.LEETCODE;
const bridge = new PageBridge({ providerId });
const pendingPageCommands = new Map();
const contentCollectionGuard = {
  running: false,
  sessionId: null
};
const bootstrapState = {
  contentScriptLoaded: true,
  injectedBridgeLoaded: false,
  pageHookLoaded: false,
  providerCollectRequestReceived: false,
  pageCollectCommandSent: false,
  collectorResultReceived: false,
  collectorInvoked: false,
  currentUrl: window.location.href,
  matchedRule: window.location.hostname.endsWith('leetcode.com'),
  collectorAllowed: window.location.hostname.endsWith('leetcode.com')
};

bootstrapLogger.info('Content script loaded');
bootstrapLogger.info(`Current URL: ${bootstrapState.currentUrl}`);
bootstrapLogger.info(`Matched rule: ${bootstrapState.matchedRule ? 'https://leetcode.com/*' : 'none'}`);
bootstrapLogger.info(`Collector allowed: ${bootstrapState.collectorAllowed}`);

function injectPageRuntime() {
  bootstrapLogger.info('Injection starting');
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected/page-runtime.js');
  script.type = 'module';
  script.dataset.cpinsight = 'page-runtime';
  (document.documentElement || document.head).appendChild(script);
  script.remove();
  bootstrapLogger.info('Injection completed');
}

function notifyPageState() {
  const payload = {
    ...detectLeetCodePageState(window.location),
    pageHookLoaded: bootstrapState.pageHookLoaded
  };
  const envelope = createEnvelope({
    type: MessageType.PAGE_STATE_CHANGED,
    source: MessageSource.CONTENT,
    target: MessageSource.BACKGROUND,
    providerId,
    payload
  });
  chainLogger.info('Step 1 PAGE_STATE_CHANGED: reached content send');
  chainLogger.info('Step 1 content payload', payload);
  chainLogger.info('Transport sendMessage envelope', envelope);
  bootstrapLogger.info(`Page state trigger fired: ${payload.pathname}`);
  return chrome.runtime.sendMessage(envelope)
    .then((response) => {
      chainLogger.info('Transport sendMessage resolved', response);
      return response;
    })
    .catch((error) => {
      chainLogger.error('Transport sendMessage rejected');
      chainLogger.error(`Exception message: ${error?.message || 'Unknown error'}`);
      chainLogger.error(`Complete stack trace: ${error?.stack || 'No stack trace available'}`);
      throw error;
    });
}

function observeDom() {
  bootstrapLogger.info('MutationObserver registered');
  let timer = null;
  const observer = new MutationObserver(() => {
    bootstrapLogger.info('MutationObserver trigger fired');
    clearTimeout(timer);
    timer = setTimeout(() => notifyPageState(), 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return observer;
}

function requestPageCommand(command, payload = {}) {
  stageLogger.info('Content requestPageCommand input payload', { command, ...payload });
  chainLogger.info(`Step 6 Page command dispatch: reached; command=${command}`);
  if (command !== 'leetcode:collect') {
    chainLogger.info(`Step 6 Page command dispatch: skipped collector command; reason=command is ${command}`);
  }
  bootstrapLogger.info(`Page command requested: ${command}`);
  return new Promise((resolve, reject) => {
    if ((command === 'leetcode:collect' || command === 'leetcode:cancel') && (!payload.sessionId || !payload.nonce)) {
      reject(new Error(`Refusing unauthenticated LeetCode page command: ${command}`));
      return;
    }
    const correlationId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const timeoutMs = payload.timeoutMs ||
      AppConfig.sync.leetcodeStageTimeoutMs?.[payload.stage] ||
      AppConfig.messaging.requestTimeoutMs;
    const timeoutId = setTimeout(() => {
      pendingPageCommands.delete(correlationId);
      reject(new Error(`LeetCode page command timed out: ${command}`));
    }, timeoutMs);

    pendingPageCommands.set(correlationId, {
      resolve,
      reject,
      timeoutId,
      command,
      stage: payload.stage || null,
      sessionId: payload.sessionId || null,
      nonce: payload.nonce || null,
      expiresAt: Date.now() + timeoutMs
    });
    if (command === 'leetcode:collect') {
      bootstrapState.pageCollectCommandSent = true;
      chainLogger.info('Step 6 Page command dispatch: reached leetcode:collect posted to page hook');
      bootstrapLogger.info('Collector invoked');
    }
    stageLogger.info('Content dispatching page payload', { command, ...payload });
    bridge.postToPage(MessageType.PAGE_COMMAND, {
      command,
      ...payload,
      providerId,
      correlationId,
      timestamp
    }, correlationId);
  });
}

bridge.on(MessageType.PAGE_BRIDGE_READY, (message) => {
  bootstrapState.injectedBridgeLoaded = true;
  if (message.payload?.pageHookLoaded) {
    bootstrapState.pageHookLoaded = true;
  }
  bootstrapLogger.info('Injected bridge loaded');
  if (bootstrapState.pageHookLoaded) {
    bootstrapLogger.info('Page hook loaded');
    notifyPageState();
  }
  logger.debug('Injected bridge ready', message.payload);
});

function rejectPageResult(message, reason) {
  chainLogger.info(`Rejected PAGE_COMMAND_RESULT: ${reason}`);
  const pending = pendingPageCommands.get(message?.correlationId);
  if (!pending) return;
  clearTimeout(pending.timeoutId);
  pendingPageCommands.delete(message.correlationId);
  pending.reject(new Error(`Rejected LeetCode page result: ${reason}`));
}

function isFreshMessageTimestamp(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && Math.abs(Date.now() - parsed) <= AppConfig.messaging.pageCommandMaxAgeMs;
}

function validateCollectionResultShape(data, pending) {
  if (pending.command !== 'leetcode:collect') return null;
  if (!data || typeof data !== 'object') return 'missing collection payload';
  if (typeof data.authenticated !== 'boolean') return 'missing authenticated flag';
  if (data.authenticated !== true) return null;
  if (!data.currentUser || typeof data.currentUser !== 'object') return 'missing current user';
  if (!data.currentUser.username && !data.username) return 'missing username';
  if (pending.stage === 'profile' && data.mandatoryDatasets?.userProfileCalendar !== true) {
    return 'missing userProfileCalendar source';
  }
  if (pending.stage === 'profile' && (!data.activity || !Array.isArray(data.activity.days))) {
    return 'missing userProfileCalendar dataset';
  }
  if (pending.stage === 'progress' && (!data.questionDataset || !Array.isArray(data.questionDataset.questions))) {
    return 'missing userProgressQuestionList dataset';
  }
  return null;
}

bridge.on(MessageType.PAGE_COMMAND_RESULT, (message, event) => {
  bootstrapLogger.info('Page command result received');
  const pending = pendingPageCommands.get(message.correlationId);
  if (!pending) {
    chainLogger.info('Rejected PAGE_COMMAND_RESULT: unknown or duplicate correlationId');
    return;
  }
  if (event?.origin !== window.location.origin) return rejectPageResult(message, 'origin mismatch');
  if (message.providerId !== providerId) return rejectPageResult(message, 'provider mismatch');
  if (message.source !== MessageSource.INJECTED || message.target !== MessageSource.CONTENT) {
    return rejectPageResult(message, 'source/target mismatch');
  }
  if (Date.now() > pending.expiresAt) return rejectPageResult(message, 'stale result');
  if (!isFreshMessageTimestamp(message.payload?.timestamp)) return rejectPageResult(message, 'expired timestamp');
  if (pending.sessionId && message.payload?.sessionId !== pending.sessionId) {
    return rejectPageResult(message, 'sessionId mismatch');
  }
  if (pending.nonce && message.payload?.nonce !== pending.nonce) {
    return rejectPageResult(message, 'nonce mismatch');
  }
  if (message.payload?.correlationId !== message.correlationId) {
    return rejectPageResult(message, 'correlationId mismatch');
  }
  if (message.payload?.command !== pending.command) {
    return rejectPageResult(message, 'command mismatch');
  }
  clearTimeout(pending.timeoutId);
  pendingPageCommands.delete(message.correlationId);

  if (message.payload?.ok) {
    const shapeError = validateCollectionResultShape(message.payload.data, pending);
    if (shapeError) {
      pending.reject(new Error(`Rejected LeetCode page result: ${shapeError}`));
      return;
    }
    pending.resolve(message.payload.data);
  } else {
    pending.reject(new Error(message.payload?.error?.message || 'LeetCode page command failed'));
  }
});

bridge.on(MessageType.SPA_NAVIGATION, () => {
  bootstrapLogger.info('SPA navigation trigger fired');
  notifyPageState();
});

bridge.on(MessageType.NETWORK_EVENT, (message) => {
  if (message.source !== MessageSource.INJECTED || message.target !== MessageSource.CONTENT || message.providerId !== providerId) {
    chainLogger.info('Rejected NETWORK_EVENT: source/target/provider mismatch');
    return;
  }
  chrome.runtime.sendMessage(createEnvelope({
    type: MessageType.NETWORK_EVENT,
    source: MessageSource.CONTENT,
    target: MessageSource.BACKGROUND,
    providerId,
    payload: message.payload
  }));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  chainLogger.info(`Step 5 Content runtime message: reached; type=${message?.type || 'unknown'}, providerId=${message?.providerId || 'none'}`);
  bootstrapLogger.info(`Runtime.onMessage trigger fired: ${message?.type || 'unknown'}`);
  if (message.providerId !== providerId) {
    chainLogger.info(`Step 5 Content runtime message: skipped; conditional=message.providerId !== providerId; values message.providerId=${message.providerId || 'none'}, providerId=${providerId}`);
    return false;
  }
  if (message.type === MessageType.PROVIDER_AUTH_CHECK) {
    chainLogger.info('Step 5 Content runtime message: skipped collector dispatch; reason=PROVIDER_AUTH_CHECK');
    requestPageCommand('leetcode:get-current-user')
      .then((result) => sendResponse({
        ok: true,
        data: {
          authenticated: Boolean(result?.isSignedIn),
          currentUser: result
        }
      }))
      .catch((error) => sendResponse({ ok: false, error: { message: error.message } }));
    return true;
  }

  if (message.type === MessageType.PROVIDER_COLLECT_REQUEST) {
    chainLogger.info('Step 5 Content received PROVIDER_COLLECT_REQUEST: reached');
    chainLogger.info('Step 5 payload', message.payload);
    stageLogger.info('Content received provider:collect:request payload', message.payload);
    if (!message.payload?.sessionId || !message.payload?.nonce || !['profile', 'progress'].includes(message.payload?.stage)) {
      chainLogger.info('Step 5 Content received PROVIDER_COLLECT_REQUEST: skipped; reason=missing session authentication or invalid stage');
      sendResponse({ ok: false, error: { message: 'Invalid authenticated collection request' } });
      return true;
    }
    guardLogger.info(`Current state: ${contentCollectionGuard.running ? 'RUNNING' : 'IDLE'}`);
    guardLogger.info('Incoming event: PROVIDER_COLLECT_REQUEST');
    guardLogger.info(`Current sessionId: ${contentCollectionGuard.sessionId || 'none'}`);
    guardLogger.info(`Incoming sessionId: ${message.payload?.sessionId || 'none'}`);
    if (contentCollectionGuard.running) {
      guardLogger.info(message.payload?.sessionId !== contentCollectionGuard.sessionId
        ? 'Ignored duplicate session'
        : 'Ignored duplicate PROVIDER_COLLECT_REQUEST');
      sendResponse({ ok: true, data: { ignored: true, reason: 'collection already running' } });
      return true;
    }

    contentCollectionGuard.running = true;
    contentCollectionGuard.sessionId = message.payload?.sessionId || null;
    bootstrapState.providerCollectRequestReceived = true;
    bootstrapLogger.info('Content received PROVIDER_COLLECT_REQUEST');
    bootstrapLogger.info('Dispatching leetcode:collect');
    requestPageCommand('leetcode:collect', message.payload)
      .then((result) => {
        bootstrapState.collectorResultReceived = true;
        chrome.runtime.sendMessage(createEnvelope({
          type: MessageType.PROVIDER_COLLECT_RESULT,
          source: MessageSource.CONTENT,
          target: MessageSource.BACKGROUND,
          providerId,
          payload: result
        }));
        sendResponse({ ok: true, data: result });
      })
      .catch((error) => sendResponse({ ok: false, error: { message: error.message } }))
      .finally(() => {
        contentCollectionGuard.running = false;
        contentCollectionGuard.sessionId = null;
      });
    return true;
  }

  if (message.type === MessageType.PROVIDER_COLLECT_CANCEL || message.type === MessageType.SYNC_CANCELLED) {
    chainLogger.info('Step 5 Content received collection cancel: reached');
    chainLogger.info('Step 5 cancel payload', message.payload);
    bootstrapLogger.info('Dispatching leetcode:cancel');
    if (!message.payload?.sessionId || !message.payload?.nonce) {
      sendResponse({ ok: false, error: { message: 'Invalid authenticated cancellation request' } });
      return true;
    }
    requestPageCommand('leetcode:cancel', message.payload)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error) => sendResponse({ ok: false, error: { message: error.message } }));
    return true;
  }

  chainLogger.info(`Step 5 Content runtime message: skipped; conditional=unsupported message.type; values type=${message.type}`);
  return false;
});

bridge.start();
bootstrapLogger.info('Page bridge listener registered');
injectPageRuntime();
notifyPageState();
observeDom();

setTimeout(() => {
  if (!bootstrapState.providerCollectRequestReceived) {
    bootstrapLogger.info('Collector never invoked.');
  }
  bootstrapLogger.info('=============================');
  bootstrapLogger.info('[CPInsight:Bootstrap Summary]');
  bootstrapLogger.info(`Content script loaded: ${bootstrapState.contentScriptLoaded}`);
  bootstrapLogger.info(`Injected bridge loaded: ${bootstrapState.injectedBridgeLoaded}`);
  bootstrapLogger.info(`Page hook loaded: ${bootstrapState.pageHookLoaded ? 'true' : 'unknown from content realm'}`);
  bootstrapLogger.info('Provider imported: background realm only');
  bootstrapLogger.info('Provider initialized: background realm only');
  bootstrapLogger.info(`Collector registered: ${bootstrapState.collectorAllowed}`);
  bootstrapLogger.info(`Collector invoked: ${bootstrapState.pageCollectCommandSent}`);
  bootstrapLogger.info(`Reason collector did not execute: ${bootstrapState.pageCollectCommandSent ? 'collector command sent to page hook' : 'no PROVIDER_COLLECT_REQUEST runtime message received by content script'}`);
  bootstrapLogger.info('=============================');
}, AppConfig.debug.bootstrapSummaryDelayMs);
