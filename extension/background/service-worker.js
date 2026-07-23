import { AppConfig } from '../config/defaults.js';
import { MessageSource, MessageType } from '../constants/message-types.js';
import { StorageArea, StorageKey } from '../constants/storage-keys.js';
import { providers } from '../providers/index.js';
import { StorageService } from '../storage/storage-service.js';
import { HttpClient } from '../network/http-client.js';
import { MessageBus } from '../messaging/message-bus.js';
import { StateStore } from '../core/state-store.js';
import { ProviderRegistry } from '../core/provider-registry.js';
import { LifecycleManager } from '../core/lifecycle-manager.js';
import { SyncOrchestrator } from '../core/sync-orchestrator.js';
import { ErrorReporter } from '../utils/errors.js';
import { createId } from '../utils/id.js';
import { createLogger } from '../utils/logger.js';
import { ObservabilitySDK } from '../observability/core/observability-sdk.js';
import { ObservabilityRuntimeConfig } from '../observability/config/runtime-config.js';
import { observabilityCollectors } from '../observability/platforms/index.js';
import { UploadStateStore } from '../observability/upload/upload-state-store.js';
import { AuthTokenProvider } from '../observability/upload/auth-token-provider.js';
import { HttpTelemetryTransport } from '../observability/upload/http-telemetry-transport.js';
import { TelemetryUploadScheduler } from '../observability/upload/upload-scheduler.js';
import { LiveTelemetrySDK } from '../live-monitoring/live-telemetry-sdk.js';

const logger = createLogger('background');
const bootstrapLogger = createLogger('Bootstrap');
const chainLogger = createLogger('Chain');
const stageLogger = createLogger('StageTrace');
const guardLogger = createLogger('Guard');
const telemetryLogger = createLogger('Telemetry');
const observabilityLogger = createLogger('Observability');
const errorReporter = new ErrorReporter(logger);
const storage = new StorageService();
const httpClient = new HttpClient();
const stateStore = new StateStore(storage);
const providerRegistry = new ProviderRegistry();
const messageBus = new MessageBus({ source: MessageSource.BACKGROUND, logger, errorReporter });
const syncOrchestrator = new SyncOrchestrator({ providerRegistry, stateStore, logger });
const lifecycleManager = new LifecycleManager({ logger, providerRegistry, stateStore });
const observabilitySdk = new ObservabilitySDK({
  storage,
  logger: observabilityLogger,
  config: ObservabilityRuntimeConfig
});
const telemetryUploadStateStore = new UploadStateStore({ storage, logger: observabilityLogger });
const telemetryTokenProvider = new AuthTokenProvider({ storage, logger: observabilityLogger });
const telemetryUploadTransport = new HttpTelemetryTransport({
  tokenProvider: telemetryTokenProvider,
  logger: observabilityLogger
});
const telemetryUploadScheduler = new TelemetryUploadScheduler({
  store: observabilitySdk.store,
  uploadStateStore: telemetryUploadStateStore,
  transport: telemetryUploadTransport,
  logger: observabilityLogger
});
const liveTelemetrySdk = new LiveTelemetrySDK({
  storage,
  httpClient,
  tokenProvider: telemetryTokenProvider,
  logger: createLogger('LiveMonitoring')
});

let providersInitialized = false;
const collectionRunsByTab = new Map();
const uploadedSessionIds = new Set();
const navigationIssuedSessionIds = new Set();
const cancelledSessionIds = new Set();
const activeUploadControllers = new Map();
const activeStageTimeouts = new Map();
const activeStageTelemetry = new Map();
const STAGE_TIMEOUT_ALARM_PREFIX = 'leetcode.stage.timeout:';
const LeetCodeCollectionState = Object.freeze({
  IDLE: 'IDLE',
  PROFILE_COLLECTION: 'PROFILE_COLLECTION',
  PROFILE_COMPLETE: 'PROFILE_COMPLETE',
  NAVIGATING: 'NAVIGATING',
  PROGRESS_COLLECTION: 'PROGRESS_COLLECTION',
  MERGING: 'MERGING',
  UPLOADING: 'UPLOADING',
  CANCELLED: 'CANCELLED',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR'
});
const allowedCollectionTransitions = Object.freeze({
  [LeetCodeCollectionState.IDLE]: new Set([LeetCodeCollectionState.PROFILE_COLLECTION]),
  [LeetCodeCollectionState.PROFILE_COLLECTION]: new Set([LeetCodeCollectionState.NAVIGATING, LeetCodeCollectionState.ERROR, LeetCodeCollectionState.CANCELLED]),
  [LeetCodeCollectionState.NAVIGATING]: new Set([LeetCodeCollectionState.PROGRESS_COLLECTION, LeetCodeCollectionState.ERROR, LeetCodeCollectionState.CANCELLED]),
  [LeetCodeCollectionState.PROGRESS_COLLECTION]: new Set([LeetCodeCollectionState.MERGING, LeetCodeCollectionState.ERROR, LeetCodeCollectionState.CANCELLED]),
  [LeetCodeCollectionState.MERGING]: new Set([LeetCodeCollectionState.UPLOADING, LeetCodeCollectionState.ERROR, LeetCodeCollectionState.CANCELLED]),
  [LeetCodeCollectionState.UPLOADING]: new Set([LeetCodeCollectionState.COMPLETE, LeetCodeCollectionState.ERROR, LeetCodeCollectionState.CANCELLED]),
  [LeetCodeCollectionState.CANCELLED]: new Set([LeetCodeCollectionState.IDLE]),
  [LeetCodeCollectionState.COMPLETE]: new Set([LeetCodeCollectionState.IDLE]),
  [LeetCodeCollectionState.ERROR]: new Set([LeetCodeCollectionState.IDLE])
});
const collectionGuard = {
  state: LeetCodeCollectionState.IDLE,
  sessionId: null
};
const LeetCodeCollectorVersion = 'mv3-leetcode-two-stage-v1';
const bootstrapState = {
  backgroundLoaded: true,
  providerImported: providers.length > 0,
  providerInitialized: false,
  collectorRegistered: false,
  collectorInvoked: false,
  collectResultReceived: false,
  pageStateReceived: false,
  collectorSkipReason: null
};

bootstrapLogger.info('Bootstrap loaded');
bootstrapLogger.info('Provider module imported');
bootstrapLogger.info(`Provider instantiated: ${providers.length > 0}`);

async function initializeObservability() {
  observabilityCollectors.forEach((collector) => {
    if (!observabilitySdk.registry.collectors.has(collector.id)) {
      observabilitySdk.registerCollector(collector);
    }
  });
  await observabilitySdk.initialize({ runtime: 'background' });
  await telemetryUploadScheduler.start();
}

async function initializeProviders() {
  bootstrapLogger.info('initializeProviders trigger fired');
  if (providersInitialized) {
    bootstrapLogger.info('Provider initialization skipped: already initialized');
    return;
  }

  providersInitialized = true;
  providers.forEach((provider) => providerRegistry.register(provider));
  bootstrapLogger.info(`Collector registered: ${providers.some((provider) => typeof provider.collectQuestionDataset === 'function' || typeof provider.collectAll === 'function')}`);
  await Promise.all(providerRegistry.list().map((provider) => provider.initialize({
    storage,
    messageBus,
    httpClient,
    stateStore,
    config: AppConfig
  })));
  bootstrapState.providerInitialized = true;
  bootstrapState.collectorRegistered = providers.some((provider) => typeof provider.collectQuestionDataset === 'function' || typeof provider.collectAll === 'function');
  bootstrapLogger.info('Provider initialized');
}

function getCollectionRun(tabId) {
  if (!collectionRunsByTab.has(tabId)) {
    collectionRunsByTab.set(tabId, {
      url: null,
      status: 'idle',
      sessionId: null
    });
  }

  return collectionRunsByTab.get(tabId);
}

function logGuard(event, incomingSessionId = null) {
  guardLogger.info(`Current state: ${collectionGuard.state}`);
  guardLogger.info(`Incoming event: ${event}`);
  guardLogger.info(`Current sessionId: ${collectionGuard.sessionId || 'none'}`);
  guardLogger.info(`Incoming sessionId: ${incomingSessionId || 'none'}`);
}

function transitionCollectionState(nextState, { event, sessionId = collectionGuard.sessionId, reason = '' } = {}) {
  logGuard(event || `transition:${nextState}`, sessionId);
  const previousState = collectionGuard.state;
  if (!allowedCollectionTransitions[previousState]?.has(nextState)) {
    guardLogger.info('Transition rejected', {
      currentState: previousState,
      requestedTransition: `${previousState} -> ${nextState}`,
      reasonRejected: `invalid transition${reason ? `; ${reason}` : ''}`,
      sessionId: sessionId || 'none',
      timestamp: new Date().toISOString()
    });
    return false;
  }

  collectionGuard.state = nextState;
  collectionGuard.sessionId = nextState === LeetCodeCollectionState.IDLE ? null : sessionId;
  guardLogger.info('Transition accepted', {
    previousState,
    incomingEvent: event || `transition:${nextState}`,
    nextState,
    sessionId: sessionId || 'none',
    timestamp: new Date().toISOString(),
    reason: reason || `${previousState} -> ${nextState}`
  });
  return true;
}

function resetCollectionGuardFromError(reason) {
  if (collectionGuard.state !== LeetCodeCollectionState.ERROR) {
    transitionCollectionState(LeetCodeCollectionState.ERROR, { event: 'failure', reason });
  }
  transitionCollectionState(LeetCodeCollectionState.IDLE, { event: 'failure cleanup', reason: 'runtime guard released' });
}

function resetCollectionGuardFromCancellation(sessionId, reason) {
  if (collectionGuard.state === LeetCodeCollectionState.ERROR) {
    transitionCollectionState(LeetCodeCollectionState.IDLE, {
      event: 'cancellation cleanup',
      sessionId,
      reason: 'runtime guard released after error'
    });
    return;
  }
  if (collectionGuard.state !== LeetCodeCollectionState.IDLE && collectionGuard.state !== LeetCodeCollectionState.CANCELLED) {
    transitionCollectionState(LeetCodeCollectionState.CANCELLED, {
      event: 'collection cancellation',
      sessionId,
      reason
    });
  }
  if (collectionGuard.state === LeetCodeCollectionState.CANCELLED) {
    transitionCollectionState(LeetCodeCollectionState.IDLE, {
      event: 'cancellation cleanup',
      sessionId,
      reason: 'runtime guard released'
    });
  }
}

function shouldIgnoreDuplicate(event, incomingSessionId = null) {
  logGuard(event, incomingSessionId);
  if (collectionGuard.state === LeetCodeCollectionState.IDLE) return false;
  if (incomingSessionId && incomingSessionId === collectionGuard.sessionId) return false;
  guardLogger.info('Ignored duplicate session');
  guardLogger.info(`Reason: active state ${collectionGuard.state} blocks ${event}`);
  return true;
}

function progressUrl() {
  return 'https://leetcode.com/progress/';
}

function createSessionNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isExpiredTimestamp(value, maxAgeMs) {
  const timestamp = Date.parse(value);
  return !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > maxAgeMs;
}

function getStageTimeoutMs(stage) {
  return AppConfig.sync.leetcodeStageTimeoutMs?.[stage] || AppConfig.messaging.requestTimeoutMs;
}

function stageTimeoutKey(sessionId, stage) {
  return `${sessionId}:${stage}`;
}

function stageTimeoutAlarmName(sessionId, stage) {
  return `${STAGE_TIMEOUT_ALARM_PREFIX}${sessionId}:${stage}`;
}

function parseStageTimeoutAlarmName(name) {
  if (!name?.startsWith(STAGE_TIMEOUT_ALARM_PREFIX)) return null;
  const value = name.slice(STAGE_TIMEOUT_ALARM_PREFIX.length);
  const separatorIndex = value.lastIndexOf(':');
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return null;
  return {
    sessionId: value.slice(0, separatorIndex),
    stage: value.slice(separatorIndex + 1)
  };
}

function stageToSessionState(stage) {
  const map = {
    profile: LeetCodeCollectionState.PROFILE_COLLECTION,
    navigating: LeetCodeCollectionState.NAVIGATING,
    progress: LeetCodeCollectionState.PROGRESS_COLLECTION,
    merging: LeetCodeCollectionState.MERGING,
    uploading: LeetCodeCollectionState.UPLOADING
  };
  return map[stage] || null;
}

function getStageTelemetryKey(sessionId, stage) {
  return `${sessionId}:${stage}`;
}

function stateToTelemetryStage(state) {
  const map = {
    [LeetCodeCollectionState.PROFILE_COLLECTION]: 'profile',
    [LeetCodeCollectionState.NAVIGATING]: 'navigating',
    [LeetCodeCollectionState.PROGRESS_COLLECTION]: 'progress',
    [LeetCodeCollectionState.MERGING]: 'merging',
    [LeetCodeCollectionState.UPLOADING]: 'uploading'
  };
  return map[state] || 'workflow';
}

function countProfileCollection(profileData) {
  if (!profileData) return 0;
  return (profileData.submissions?.length || 0) +
    (profileData.recentSubmissions?.length || 0) +
    (profileData.contests?.history?.length || 0) +
    (profileData.activity?.days?.length || 0) +
    (profileData.languageStats?.length || 0) +
    (profileData.badges?.length || 0);
}

function countProgressCollection(progressData) {
  if (!progressData) return 0;
  return (progressData.questionDataset?.questions?.length || 0) +
    (progressData.problemMetadata?.length || 0) +
    (progressData.bookmarks?.length || 0);
}

function getGraphQLCount(...payloads) {
  return payloads.reduce((count, payload) => count + (payload?.observedNetwork?.length || 0), 0);
}

function startStageTelemetry(stage, { sessionId, state, previousState, nextState, pageUrl, username } = {}) {
  if (!sessionId) return;
  activeStageTelemetry.set(getStageTelemetryKey(sessionId, stage), {
    startedAt: Date.now(),
    state,
    previousState,
    nextState,
    pageUrl,
    username
  });
}

function emitStageTelemetry(stage, {
  sessionId,
  state,
  previousState,
  nextState,
  pageUrl,
  username,
  graphqlCount = 0,
  collectionCount = 0,
  uploadDuration = null,
  mergeDuration = null,
  navigationDuration = null,
  failure = null
} = {}) {
  if (!sessionId) return;
  const key = getStageTelemetryKey(sessionId, stage);
  const started = activeStageTelemetry.get(key);
  const duration = started ? Date.now() - started.startedAt : null;
  activeStageTelemetry.delete(key);
  const event = {
    sessionId,
    stage,
    state: state || started?.state || collectionGuard.state,
    previousState: previousState || started?.previousState || null,
    nextState: nextState || started?.nextState || null,
    duration,
    pageUrl: pageUrl || started?.pageUrl || null,
    username: username || started?.username || null,
    graphqlCount,
    collectionCount,
    uploadDuration: uploadDuration ?? (stage === 'uploading' ? duration : null),
    mergeDuration: mergeDuration ?? (stage === 'merging' ? duration : null),
    navigationDuration: navigationDuration ?? (stage === 'navigating' ? duration : null)
  };
  if (failure) {
    event.failure = {
      stage,
      reason: failure.reason || 'Unknown failure',
      stack: failure.stack || null
    };
    telemetryLogger.error('Collection lifecycle event', event);
    return;
  }
  telemetryLogger.info('Collection lifecycle event', event);
}

function clearStageTelemetry(sessionId, stage = null) {
  for (const key of activeStageTelemetry.keys()) {
    if (!key.startsWith(`${sessionId}:`)) continue;
    if (stage && key !== getStageTelemetryKey(sessionId, stage)) continue;
    activeStageTelemetry.delete(key);
  }
}

async function persistStageDeadline(sessionId, stage, deadline) {
  const session = await getCollectionSession();
  if (session?.sessionId !== sessionId) return;
  await setCollectionSession({
    ...session,
    stageDeadlines: {
      ...(session.stageDeadlines || {}),
      [stage]: deadline
    }
  });
}

async function clearPersistedStageDeadline(sessionId, stage = null) {
  const session = await getCollectionSession();
  if (session?.sessionId === sessionId && session.stageDeadlines) {
    const stageDeadlines = { ...session.stageDeadlines };
    if (stage) {
      delete stageDeadlines[stage];
    } else {
      Object.keys(stageDeadlines).forEach((deadlineStage) => delete stageDeadlines[deadlineStage]);
    }
    await setCollectionSession({
      ...session,
      stageDeadlines
    });
  }

  const stages = stage ? [stage] : ['profile', 'navigating', 'progress', 'merging', 'uploading'];
  await Promise.all(stages.map((deadlineStage) =>
    chrome.alarms.clear(stageTimeoutAlarmName(sessionId, deadlineStage)).catch(() => false)
  ));
}

function clearStageTimeout(sessionId, stage = null, { persist = true } = {}) {
  for (const [key, timeoutId] of activeStageTimeouts.entries()) {
    if (!key.startsWith(`${sessionId}:`)) continue;
    if (stage && key !== stageTimeoutKey(sessionId, stage)) continue;
    clearTimeout(timeoutId);
    activeStageTimeouts.delete(key);
  }
  if (persist) {
    clearPersistedStageDeadline(sessionId, stage).catch((error) => {
      bootstrapLogger.error(`Persisted stage timeout cleanup failed: ${error?.message || 'Unknown error'}`);
    });
  }
}

function clearAllStageTimeouts(sessionId) {
  clearStageTimeout(sessionId);
}

async function startStageTimeout(stage, { sessionId, tabId = null, providerId = 'leetcode', state = null, previousState = null, nextState = null, pageUrl = null, username = null } = {}) {
  if (!sessionId) return;
  clearStageTimeout(sessionId, stage, { persist: false });
  await chrome.alarms.clear(stageTimeoutAlarmName(sessionId, stage)).catch(() => false);
  startStageTelemetry(stage, {
    sessionId,
    state,
    previousState,
    nextState,
    pageUrl,
    username
  });
  const timeoutMs = getStageTimeoutMs(stage);
  const key = stageTimeoutKey(sessionId, stage);
  const deadlineAt = Date.now() + timeoutMs;
  const deadline = {
    stage,
    sessionId,
    tabId,
    providerId,
    deadlineAt,
    timeoutMs,
    state,
    previousState,
    nextState,
    pageUrl,
    username,
    armedAt: new Date().toISOString()
  };
  await persistStageDeadline(sessionId, stage, deadline);
  await chrome.alarms.create(stageTimeoutAlarmName(sessionId, stage), { when: deadlineAt });
  guardLogger.info('Stage timeout armed', {
    stage,
    sessionId,
    timeoutMs,
    timestamp: new Date().toISOString()
  });
  const timeoutId = setTimeout(() => {
    activeStageTimeouts.delete(key);
    timeoutCollectionWorkflow({
      tabId,
      providerId,
      sessionId,
      stage,
      reason: `${stage} stage timed out after ${timeoutMs}ms`
    }).catch((error) => {
      bootstrapLogger.error(`Stage timeout cleanup failed: ${error?.message || 'Unknown error'}`);
    });
  }, timeoutMs);
  activeStageTimeouts.set(key, timeoutId);
}

async function handleDurableStageTimeout(sessionId, stage) {
  const session = await getCollectionSession();
  const deadline = session?.stageDeadlines?.[stage];
  if (!session?.sessionId || session.sessionId !== sessionId || !deadline) return false;

  const expectedState = stageToSessionState(stage);
  if (session.stage !== expectedState) {
    await clearPersistedStageDeadline(sessionId, stage);
    return false;
  }

  if (Date.now() < deadline.deadlineAt) {
    await chrome.alarms.create(stageTimeoutAlarmName(sessionId, stage), { when: deadline.deadlineAt });
    return false;
  }

  restoreGuardFromSession(session, { restoreActiveStage: true });
  await timeoutCollectionWorkflow({
    tabId: deadline.tabId || null,
    providerId: deadline.providerId || 'leetcode',
    sessionId,
    stage,
    reason: `${stage} stage timed out after ${deadline.timeoutMs}ms`
  });
  return true;
}

async function recoverDurableStageTimeout(session) {
  if (!session?.sessionId || !session.stageDeadlines) return false;
  const activeStage = Object.keys(session.stageDeadlines).find((stage) => session.stage === stageToSessionState(stage));
  if (!activeStage) return false;
  const deadline = session.stageDeadlines[activeStage];
  if (Date.now() >= deadline.deadlineAt) {
    return handleDurableStageTimeout(session.sessionId, activeStage);
  }
  await chrome.alarms.create(stageTimeoutAlarmName(session.sessionId, activeStage), { when: deadline.deadlineAt });
  return false;
}

function restoreGuardFromSession(session, { restoreActiveStage = false } = {}) {
  if (collectionGuard.state !== LeetCodeCollectionState.IDLE || !session?.sessionId) {
    return;
  }

  const recoveryPaths = {
    [LeetCodeCollectionState.PROFILE_COLLECTION]: restoreActiveStage
      ? [LeetCodeCollectionState.PROFILE_COLLECTION]
      : null,
    [LeetCodeCollectionState.PROFILE_COMPLETE]: [LeetCodeCollectionState.PROFILE_COLLECTION, LeetCodeCollectionState.NAVIGATING],
    [LeetCodeCollectionState.NAVIGATING]: [LeetCodeCollectionState.PROFILE_COLLECTION, LeetCodeCollectionState.NAVIGATING],
    [LeetCodeCollectionState.PROGRESS_COLLECTION]: restoreActiveStage
      ? [LeetCodeCollectionState.PROFILE_COLLECTION, LeetCodeCollectionState.NAVIGATING, LeetCodeCollectionState.PROGRESS_COLLECTION]
      : [LeetCodeCollectionState.PROFILE_COLLECTION, LeetCodeCollectionState.NAVIGATING],
    [LeetCodeCollectionState.MERGING]: [
      LeetCodeCollectionState.PROFILE_COLLECTION,
      LeetCodeCollectionState.NAVIGATING,
      LeetCodeCollectionState.PROGRESS_COLLECTION,
      LeetCodeCollectionState.MERGING
    ],
    [LeetCodeCollectionState.UPLOADING]: [
      LeetCodeCollectionState.PROFILE_COLLECTION,
      LeetCodeCollectionState.NAVIGATING,
      LeetCodeCollectionState.PROGRESS_COLLECTION,
      LeetCodeCollectionState.MERGING,
      LeetCodeCollectionState.UPLOADING
    ],
    [LeetCodeCollectionState.COMPLETE]: [
      LeetCodeCollectionState.PROFILE_COLLECTION,
      LeetCodeCollectionState.NAVIGATING,
      LeetCodeCollectionState.PROGRESS_COLLECTION,
      LeetCodeCollectionState.MERGING,
      LeetCodeCollectionState.UPLOADING,
      LeetCodeCollectionState.COMPLETE
    ]
  };
  const recoveryPath = recoveryPaths[session.stage];
  if (!recoveryPath) return;

  for (const nextState of recoveryPath) {
    if (!transitionCollectionState(nextState, {
      event: 'resume stored session',
      sessionId: session.sessionId,
      reason: `recover stored session stage ${session.stage}`
    })) {
      resetCollectionGuardFromError(`Invalid recovery transition for stored session stage ${session.stage}`);
      return;
    }
  }

  guardLogger.info('Runtime guard restored from session', {
    previousState: LeetCodeCollectionState.IDLE,
    incomingEvent: 'resume stored session',
    nextState: collectionGuard.state,
    sessionId: session.sessionId,
    timestamp: new Date().toISOString(),
    reason: `stored session stage ${session.stage}`
  });
}

function rewindRestoredProgressSession(session) {
  if (
    session?.stage === LeetCodeCollectionState.PROGRESS_COLLECTION &&
    collectionGuard.state === LeetCodeCollectionState.NAVIGATING &&
    collectionGuard.sessionId === session.sessionId
  ) {
    return;
  }

  if (
    session?.stage === LeetCodeCollectionState.PROGRESS_COLLECTION &&
    collectionGuard.state === LeetCodeCollectionState.MERGING &&
    collectionGuard.sessionId === session.sessionId
  ) {
    resetCollectionGuardFromError('Invalid progress recovery state');
  }
}

function validateStoredUploadState(session, mergedPayload) {
  return Boolean(
    session?.sessionId &&
    mergedPayload?.sessionId === session.sessionId &&
    session.uploadAttempt?.sessionId === session.sessionId &&
    session.uploadAttempt?.mergedPayloadHash === mergedPayload?.metadata?.payloadHash &&
    session.uploadAttempt?.collectorVersion === mergedPayload?.metadata?.collectorVersion
  );
}

async function getUploadState() {
  return storage.get(StorageKey.LEETCODE_UPLOAD_STATE, {}, StorageArea.LOCAL);
}

async function setUploadState(state) {
  return storage.set(StorageKey.LEETCODE_UPLOAD_STATE, state, StorageArea.LOCAL);
}

async function cleanupUploadLedger(reason = 'scheduled upload ledger cleanup') {
  const state = await getUploadState();
  const activeSession = await getCollectionSession();
  const nextState = {};
  let changed = false;
  const completedTtlMs = getSessionTtlMs(LeetCodeCollectionState.COMPLETE);

  for (const [sessionId, record] of Object.entries(state || {})) {
    if (activeSession?.sessionId === sessionId) {
      nextState[sessionId] = record;
      continue;
    }
    const completedAt = record?.completedAt ? Date.parse(record.completedAt) : null;
    if (record?.completed && Number.isFinite(completedAt) && Date.now() - completedAt > completedTtlMs) {
      changed = true;
      continue;
    }
    nextState[sessionId] = record;
  }

  if (changed) {
    await setUploadState(nextState);
    bootstrapLogger.info(`Expired LeetCode upload ledger entries cleaned: ${reason}`);
  }
}

function validateDurableUploadRecord(record, session, mergedPayload) {
  return Boolean(
    record &&
    session?.sessionId &&
    mergedPayload?.sessionId === session.sessionId &&
    record.sessionId === session.sessionId &&
    record.mergedPayloadHash === mergedPayload?.metadata?.payloadHash &&
    record.collectorVersion === mergedPayload?.metadata?.collectorVersion
  );
}

async function getDurableUploadRecord(sessionId) {
  const state = await getUploadState();
  return state?.[sessionId] || null;
}

async function markDurableUploadAttempt(session, mergedPayload) {
  const state = await getUploadState();
  const existing = state[session.sessionId];
  if (existing?.completed) return existing;
  const record = {
    sessionId: session.sessionId,
    collectorVersion: mergedPayload.metadata.collectorVersion,
    mergedPayloadHash: mergedPayload.metadata.payloadHash,
    attemptedAt: new Date().toISOString(),
    completed: false
  };
  await setUploadState({
    ...state,
    [session.sessionId]: record
  });
  return record;
}

async function markDurableUploadComplete(session, mergedPayload, uploadStatus) {
  const state = await getUploadState();
  const record = {
    ...(state[session.sessionId] || {}),
    sessionId: session.sessionId,
    collectorVersion: mergedPayload.metadata.collectorVersion,
    mergedPayloadHash: mergedPayload.metadata.payloadHash,
    completed: true,
    completedAt: uploadStatus.uploadedAt,
    response: uploadStatus.response || null
  };
  await setUploadState({
    ...state,
    [session.sessionId]: record
  });
  return record;
}

async function markUploadAttempt(session, mergedPayload) {
  const uploadAttempt = {
    sessionId: session.sessionId,
    collectorVersion: mergedPayload.metadata.collectorVersion,
    mergedPayloadHash: mergedPayload.metadata.payloadHash,
    startedAt: new Date().toISOString(),
    completed: false
  };
  return setCollectionSession({
    ...session,
    uploadAttempt
  });
}

async function markUploadComplete(session, uploadPayload, uploadStatus) {
  return setCollectionSession({
    ...session,
    stage: LeetCodeCollectionState.COMPLETE,
    mergedPayload: uploadPayload,
    uploadStatus,
    uploadAttempt: {
      ...(session.uploadAttempt || {}),
      sessionId: session.sessionId,
      collectorVersion: uploadPayload.metadata.collectorVersion,
      mergedPayloadHash: uploadPayload.metadata.payloadHash,
      completed: true,
      completedAt: uploadStatus.uploadedAt
    }
  });
}

async function restoreUploadCompletion(session) {
  if (session?.uploadAttempt?.completed || session?.uploadStatus?.ok) {
    await cleanupCompletedSession(session, 'stored upload already complete');
    return true;
  }
  return false;
}

async function ensureSessionNonce(session) {
  if (!session?.sessionId || session.nonce) return session;
  return setCollectionSession({
    ...session,
    nonce: createSessionNonce()
  });
}

async function setSessionError(session, stage, error) {
  return setCollectionSession({
    ...session,
    stage,
    lastError: error?.message || String(error || 'Unknown error')
  });
}

function hashPayload(value) {
  const json = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < json.length; index += 1) {
    hash = ((hash << 5) - hash + json.charCodeAt(index)) | 0;
  }
  return `${json.length}:${hash >>> 0}`;
}

function attachPayloadHash(payload) {
  return {
    ...payload,
    metadata: {
      ...payload.metadata,
      payloadHash: hashPayload(payload)
    }
  };
}

function assertMandatoryProgressData(session, progressData) {
  const hasProgressQuestions = Array.isArray(progressData?.questionDataset?.questions) &&
    Number.isFinite(progressData.questionDataset.totalNum);
  const hasProfileCalendar = session?.profileData?.mandatoryDatasets?.userProfileCalendar === true;
  if (!hasProgressQuestions) {
    throw new Error('Mandatory progress dataset missing: userProgressQuestionList');
  }
  if (!hasProfileCalendar) {
    throw new Error('Mandatory progress dataset missing: userProfileCalendar');
  }
}

function assertMandatoryProfileData(profileData) {
  const profileFailed = profileData?.warnings?.some((warning) => String(warning).startsWith('Profile unavailable'));
  if (profileFailed || profileData?.mandatoryDatasets?.userProfileCalendar !== true) {
    throw new Error('Mandatory profile dataset missing: userProfileCalendar');
  }
}

async function cleanupCompletedSession(session, reason = 'stored session complete') {
  if (!session?.sessionId) return;
  const previousState = collectionGuard.state;
  await clearCollectionSession();
  uploadedSessionIds.delete(session.sessionId);
  navigationIssuedSessionIds.delete(session.sessionId);
  cancelledSessionIds.delete(session.sessionId);
  activeUploadControllers.delete(session.sessionId);
  clearAllStageTimeouts(session.sessionId);
  clearStageTelemetry(session.sessionId);
  if (collectionGuard.state === LeetCodeCollectionState.COMPLETE) {
    transitionCollectionState(LeetCodeCollectionState.IDLE, {
      event: 'completed session cleanup',
      sessionId: session.sessionId,
      reason
    });
  } else if (collectionGuard.sessionId === session.sessionId && collectionGuard.state !== LeetCodeCollectionState.IDLE) {
    guardLogger.info('Completed session cleanup skipped active non-complete guard', {
      previousState,
      sessionId: session.sessionId,
      reason
    });
  }
  bootstrapLogger.info('Completed LeetCode collection session cleaned');
}

async function markInterruptedUpload(session) {
  await setCollectionSession({
    ...session,
    stage: LeetCodeCollectionState.ERROR,
    lastError: 'Upload was interrupted before completion'
  });
  resetCollectionGuardFromError('Upload was interrupted before completion');
  bootstrapLogger.info('Interrupted upload session marked ERROR');
}

async function navigateToProgressOnce(tabId, session, reason) {
  if (!session?.sessionId) return false;
  if (cancelledSessionIds.has(session.sessionId)) {
    bootstrapLogger.info('Progress navigation skipped: collection session cancelled');
    return false;
  }
  if (navigationIssuedSessionIds.has(session.sessionId)) {
    bootstrapLogger.info('Progress navigation skipped: navigation already issued for active session');
    return true;
  }

  navigationIssuedSessionIds.add(session.sessionId);
  await startStageTimeout('navigating', {
    sessionId: session.sessionId,
    tabId,
    state: LeetCodeCollectionState.NAVIGATING,
    previousState: LeetCodeCollectionState.PROFILE_COLLECTION,
    nextState: LeetCodeCollectionState.PROGRESS_COLLECTION,
    pageUrl: progressUrl(),
    username: session.username
  });
  await setCollectionSession({
    ...session,
    stage: LeetCodeCollectionState.NAVIGATING
  });
  bootstrapLogger.info(`Navigating to progress page: ${reason}`);
  try {
    await chrome.tabs.update(tabId, { url: progressUrl() });
  } catch (error) {
    clearStageTimeout(session.sessionId, 'navigating');
    throw error;
  }
  return true;
}

function normalizeUsername(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function parseTimestamp(value, label) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ${label} timestamp`);
  }
  return timestamp;
}

function extractProfileUsername(profileData) {
  return profileData?.username ||
    profileData?.currentUser?.username ||
    profileData?.profile?.username ||
    null;
}

function extractProgressUsername(progressData) {
  return progressData?.username ||
    progressData?.currentUser?.username ||
    null;
}

function validateMergeInputs(session, progressData, mergedAt) {
  if (!session?.sessionId) throw new Error('Cannot merge LeetCode collection without sessionId');
  if (!session?.profileData) throw new Error('Cannot merge LeetCode collection without profileData');
  if (!progressData) throw new Error('Cannot merge LeetCode collection without progressData');
  if (session.profileData.authenticated !== true) throw new Error('Cannot merge unauthenticated profileData');
  if (progressData.authenticated !== true) throw new Error('Cannot merge unauthenticated progressData');

  const sessionUsername = normalizeUsername(session.username);
  const profileUsername = normalizeUsername(extractProfileUsername(session.profileData));
  const progressUsername = normalizeUsername(extractProgressUsername(progressData));
  const canonicalUsername = sessionUsername || profileUsername || progressUsername;

  if (!canonicalUsername) throw new Error('Cannot merge LeetCode collection without username');
  if (sessionUsername && sessionUsername !== canonicalUsername) throw new Error('Session username mismatch');
  if (profileUsername && profileUsername !== canonicalUsername) throw new Error('Profile username mismatch');
  if (progressUsername && progressUsername !== canonicalUsername) throw new Error('Progress username mismatch');

  const profileSessionId = session.profileData.sessionId || session.sessionId;
  const progressSessionId = progressData.sessionId || session.sessionId;
  if (profileSessionId !== session.sessionId) throw new Error('Profile sessionId mismatch');
  if (progressSessionId !== session.sessionId) throw new Error('Progress sessionId mismatch');

  const startedAt = parseTimestamp(session.startedAt, 'session startedAt');
  const completedAt = parseTimestamp(mergedAt, 'merge completedAt');
  if (completedAt < startedAt) throw new Error('Merge timestamp predates session start');
  [session.profileData.collectedAt, progressData.collectedAt, progressData.questionDataset?.collectedAt]
    .filter(Boolean)
    .forEach((value) => {
      const stageTimestamp = parseTimestamp(value, 'stage collectedAt');
      if (stageTimestamp < startedAt || stageTimestamp > completedAt) {
        throw new Error('Stage timestamp falls outside session window');
      }
    });

  return {
    username: canonicalUsername,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString()
  };
}

function mergeCollectionPayload(session, progressData) {
  const completedAt = new Date().toISOString();
  const validated = validateMergeInputs(session, progressData, completedAt);
  const profileData = session.profileData;
  const questionDataset = progressData.questionDataset || null;
  const analytics = {
    profile: {
      submissionsCollected: profileData.submissions?.length || 0,
      recentSubmissionsCollected: profileData.recentSubmissions?.length || 0,
      contestsCollected: profileData.contests?.history?.length || 0,
      activityRecordsCollected: profileData.activity?.days?.length || 0,
      languagesCollected: profileData.languageStats?.length || 0,
      badgesCollected: profileData.badges?.length || 0
    },
    progress: {
      questionsCollected: questionDataset?.questions?.length || 0,
      bookmarksCollected: progressData.bookmarks?.length || 0,
      totalNum: questionDataset?.totalNum || 0
    },
    solved: questionDataset?.analytics || null
  };

  return attachPayloadHash({
    sessionId: session.sessionId,
    provider: 'leetcode',
    username: validated.username,
    profile: {
      profile: profileData.profile || null,
      submissions: profileData.submissions || [],
      recentSubmissions: profileData.recentSubmissions || [],
      contests: profileData.contests || null,
      languageStats: profileData.languageStats || [],
      activity: profileData.activity || null,
      badges: profileData.badges || []
    },
    progress: {
      questionDataset,
      problemMetadata: progressData.problemMetadata || [],
      bookmarks: progressData.bookmarks || []
    },
    analytics,
    metadata: {
      collectorVersion: LeetCodeCollectorVersion,
      sessionStage: LeetCodeCollectionState.MERGING,
      warnings: [
        ...(profileData.warnings || []),
        ...(progressData.warnings || [])
      ]
    },
    source: {
      provider: 'leetcode',
      profilePage: `https://leetcode.com/u/${encodeURIComponent(validated.username)}/`,
      progressPage: progressUrl(),
      profileOperations: ['getUserProfile', 'recentAcSubmissions', 'recentSubmissions', 'userContests'],
      progressOperations: ['userProgressQuestionList', 'myFavoriteList']
    },
    collectionTimestamps: {
      startedAt: validated.startedAt,
      profileCollectedAt: profileData.collectedAt || null,
      progressCollectedAt: progressData.collectedAt || questionDataset?.collectedAt || null,
      mergedAt: validated.completedAt
    }
  });
}

function createUploadPayload(mergedPayload) {
  const startedAt = Date.parse(mergedPayload.collectionTimestamps.startedAt);
  const mergedAt = Date.parse(mergedPayload.collectionTimestamps.mergedAt);
  return {
    ...mergedPayload,
    upload: {
      sessionId: mergedPayload.sessionId,
      collectionDurationMs: Number.isFinite(startedAt) && Number.isFinite(mergedAt) ? Math.max(0, mergedAt - startedAt) : null,
      providerVersion: chrome.runtime.getManifest().version,
      collectorVersion: mergedPayload.metadata.collectorVersion
    }
  };
}

async function getCollectionSession() {
  return storage.get(StorageKey.LEETCODE_COLLECTION_SESSION, null, StorageArea.SESSION);
}

async function setCollectionSession(session) {
  return storage.set(StorageKey.LEETCODE_COLLECTION_SESSION, session, StorageArea.SESSION);
}

async function clearCollectionSession() {
  return storage.remove(StorageKey.LEETCODE_COLLECTION_SESSION, StorageArea.SESSION);
}

function getSessionTtlMs(stage) {
  const ttl = AppConfig.session?.cleanupTtlMs || {};
  if (stage === LeetCodeCollectionState.COMPLETE) return ttl.complete || 86400000;
  if (stage === LeetCodeCollectionState.ERROR) return ttl.error || 3600000;
  if (stage === LeetCodeCollectionState.CANCELLED) return ttl.cancelled || 3600000;
  return ttl.stale || 21600000;
}

function isSessionExpired(session) {
  if (!session?.sessionId) return false;
  const reference = session.completedAt || session.cancelledAt || session.timedOutAt || session.uploadStatus?.uploadedAt || session.startedAt;
  return isExpiredTimestamp(reference, getSessionTtlMs(session.stage));
}

async function cleanupExpiredSession(session, reason = 'stored session expired') {
  if (!isSessionExpired(session)) return false;
  if (collectionGuard.sessionId === session.sessionId && collectionGuard.state !== LeetCodeCollectionState.IDLE) {
    bootstrapLogger.info('Expired session cleanup skipped: session is active');
    return false;
  }
  await clearCollectionSession();
  uploadedSessionIds.delete(session.sessionId);
  navigationIssuedSessionIds.delete(session.sessionId);
  cancelledSessionIds.delete(session.sessionId);
  activeUploadControllers.delete(session.sessionId);
  clearAllStageTimeouts(session.sessionId);
  clearStageTelemetry(session.sessionId);
  bootstrapLogger.info(`Expired LeetCode collection session cleaned: ${reason}`);
  return true;
}

async function getActiveCollectionSession() {
  const session = await getCollectionSession();
  if (await cleanupExpiredSession(session)) return null;
  return session;
}

async function uploadMergedCollection(payload, signal = null) {
  const accessToken = await storage.get(StorageKey.CPINSIGHT_ACCESS_TOKEN, null, StorageArea.LOCAL);
  const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  return httpClient.request(AppConfig.sync.leetcodeCollectionPath, {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    headers: {
      ...authHeaders,
      'Idempotency-Key': payload.sessionId,
      'X-CPInsight-Session-Id': payload.sessionId
    }
  });
}

async function uploadMergedDataset(session, mergedPayload) {
  if (!mergedPayload?.sessionId || mergedPayload.sessionId !== session.sessionId) {
    throw new Error('Cannot upload merged dataset with mismatched sessionId');
  }

  if (cancelledSessionIds.has(session.sessionId)) {
    guardLogger.info('Upload skipped: collection session cancelled');
    return { ignored: true, reason: 'collection cancelled', sessionId: session.sessionId };
  }

  if (await restoreUploadCompletion(session)) {
    return { ignored: true, reason: 'upload already completed', sessionId: session.sessionId };
  }

  const durableUploadRecord = await getDurableUploadRecord(session.sessionId);
  if (durableUploadRecord?.completed) {
    if (!validateDurableUploadRecord(durableUploadRecord, session, mergedPayload)) {
      throw new Error('Completed upload record does not match merged payload');
    }
    await cleanupCompletedSession({
      ...session,
      stage: LeetCodeCollectionState.COMPLETE,
      uploadStatus: {
        ok: true,
        sessionId: session.sessionId,
        uploadedAt: durableUploadRecord.completedAt,
        response: durableUploadRecord.response || null
      }
    }, 'durable upload record already complete');
    return { ignored: true, reason: 'upload already completed', sessionId: session.sessionId };
  }

  if (durableUploadRecord && !durableUploadRecord.completed) {
    if (validateDurableUploadRecord(durableUploadRecord, session, mergedPayload)) {
      await setSessionError(session, LeetCodeCollectionState.ERROR, new Error('Upload already attempted for session'));
      resetCollectionGuardFromError('Upload already attempted for session');
      return { ignored: true, reason: 'upload already attempted for session', sessionId: session.sessionId };
    }
    throw new Error('Durable upload attempt does not match merged payload');
  }

  if (session.uploadAttempt && !session.uploadAttempt.completed) {
    if (validateStoredUploadState(session, mergedPayload)) {
      await setSessionError(session, LeetCodeCollectionState.ERROR, new Error('Upload already attempted for session'));
      resetCollectionGuardFromError('Upload already attempted for session');
      return { ignored: true, reason: 'upload already attempted for session', sessionId: session.sessionId };
    }
    throw new Error('Stored upload attempt does not match merged payload');
  }

  if (uploadedSessionIds.has(session.sessionId)) {
    guardLogger.info('Ignored duplicate upload');
    return { ignored: true, reason: 'upload already attempted for session', sessionId: session.sessionId };
  }

  if (!transitionCollectionState(LeetCodeCollectionState.UPLOADING, {
    event: 'merge complete',
    sessionId: session.sessionId
  })) {
    return { ignored: true, reason: 'upload transition rejected', sessionId: session.sessionId };
  }

  uploadedSessionIds.add(session.sessionId);
  const uploadPayload = createUploadPayload(mergedPayload);
  await markDurableUploadAttempt(session, uploadPayload);
  const uploadSession = await markUploadAttempt(session, uploadPayload);
  const uploadStartedAt = new Date().toISOString();
  const uploadController = new AbortController();
  activeUploadControllers.set(uploadSession.sessionId, uploadController);
  await startStageTimeout('uploading', {
    sessionId: uploadSession.sessionId,
    state: LeetCodeCollectionState.UPLOADING,
    previousState: LeetCodeCollectionState.MERGING,
    nextState: LeetCodeCollectionState.COMPLETE,
    pageUrl: mergedPayload.source?.progressPage || null,
    username: mergedPayload.username
  });

  try {
    const response = await uploadMergedCollection(uploadPayload, uploadController.signal);
    const uploadStatus = {
      ok: true,
      sessionId: uploadSession.sessionId,
      uploadedAt: new Date().toISOString(),
      uploadStartedAt,
      response: response || null
    };
    emitStageTelemetry('uploading', {
      sessionId: uploadSession.sessionId,
      state: LeetCodeCollectionState.UPLOADING,
      previousState: LeetCodeCollectionState.MERGING,
      nextState: LeetCodeCollectionState.COMPLETE,
      pageUrl: mergedPayload.source?.progressPage || null,
      username: mergedPayload.username,
      graphqlCount: getGraphQLCount(uploadSession.profileData, uploadSession.progressData),
      collectionCount: countProfileCollection(uploadSession.profileData) + countProgressCollection(uploadSession.progressData),
      uploadDuration: Date.parse(uploadStatus.uploadedAt) - Date.parse(uploadStartedAt)
    });

    await markDurableUploadComplete(uploadSession, uploadPayload, uploadStatus);
    await markUploadComplete(uploadSession, uploadPayload, uploadStatus);
    transitionCollectionState(LeetCodeCollectionState.COMPLETE, {
      event: 'upload complete',
      sessionId: uploadSession.sessionId
    });
    await clearCollectionSession();
    uploadedSessionIds.delete(uploadSession.sessionId);
    navigationIssuedSessionIds.delete(uploadSession.sessionId);
    cancelledSessionIds.delete(uploadSession.sessionId);
    clearAllStageTimeouts(uploadSession.sessionId);
    clearStageTelemetry(uploadSession.sessionId);
    transitionCollectionState(LeetCodeCollectionState.IDLE, {
      event: 'complete cleanup',
      sessionId: uploadSession.sessionId
    });
    bootstrapLogger.info('Merged dataset uploaded successfully');
    return uploadStatus;
  } catch (error) {
    uploadedSessionIds.delete(uploadSession.sessionId);
    if (cancelledSessionIds.has(uploadSession.sessionId)) {
      bootstrapLogger.info('Merged dataset upload aborted by cancellation');
      cancelledSessionIds.delete(uploadSession.sessionId);
      return { ignored: true, reason: 'collection cancelled', sessionId: uploadSession.sessionId };
    }
    const uploadStatus = {
      ok: false,
      sessionId: uploadSession.sessionId,
      uploadStartedAt,
      failedAt: new Date().toISOString(),
      error: error?.message || 'Upload failed'
    };
    emitStageTelemetry('uploading', {
      sessionId: uploadSession.sessionId,
      state: LeetCodeCollectionState.ERROR,
      previousState: LeetCodeCollectionState.UPLOADING,
      nextState: LeetCodeCollectionState.IDLE,
      pageUrl: mergedPayload.source?.progressPage || null,
      username: mergedPayload.username,
      graphqlCount: getGraphQLCount(uploadSession.profileData, uploadSession.progressData),
      collectionCount: countProfileCollection(uploadSession.profileData) + countProgressCollection(uploadSession.progressData),
      uploadDuration: Date.parse(uploadStatus.failedAt) - Date.parse(uploadStartedAt),
      failure: {
        reason: uploadStatus.error,
        stack: error?.stack || null
      }
    });

    await setCollectionSession({
      ...uploadSession,
      stage: LeetCodeCollectionState.ERROR,
      mergedPayload: uploadPayload,
      uploadStatus,
      lastError: uploadStatus.error
    });
    resetCollectionGuardFromError(uploadStatus.error);
    bootstrapLogger.info('Merged dataset upload failed; session marked ERROR');
    return uploadStatus;
  } finally {
    clearStageTimeout(uploadSession.sessionId, 'uploading');
    activeUploadControllers.delete(uploadSession.sessionId);
  }
}

async function sendCollectionRequest(tabId, providerId, { stage, url, sessionId, nonce }) {
  stageLogger.info('Background provider:collect:request payload', { stage, url, sessionId });
  chainLogger.info('Step 4 PROVIDER_COLLECT_REQUEST: reached');
  chainLogger.info(`Step 4 values: tabId=${tabId}, providerId=${providerId}, stage=${stage}, url=${url}, sessionId=${sessionId}`);
  bootstrapLogger.info(`Sending PROVIDER_COLLECT_REQUEST: ${stage}`);
  const response = await messageBus.sendTab(tabId, {
    type: MessageType.PROVIDER_COLLECT_REQUEST,
    target: MessageSource.CONTENT,
    providerId,
    payload: {
      stage,
      url,
      sessionId,
      nonce,
      timeoutMs: getStageTimeoutMs(stage),
      timestamp: new Date().toISOString()
    }
  });

  if (!response?.ok) {
    chainLogger.info(`Step 4 PROVIDER_COLLECT_REQUEST: skipped after send; reason=${response?.error?.message || `${stage} collection request failed`}`);
    throw new Error(response?.error?.message || `${stage} collection request failed`);
  }

  chainLogger.info('Step 4 PROVIDER_COLLECT_REQUEST: reached send completed');
  return response.data;
}

async function sendCollectionCancel(tabId, providerId, { sessionId, nonce, reason }) {
  if (!tabId) return null;
  try {
    return await messageBus.sendTab(tabId, {
      type: MessageType.PROVIDER_COLLECT_CANCEL,
      target: MessageSource.CONTENT,
      providerId,
      payload: {
        sessionId,
        nonce,
        reason,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    bootstrapLogger.info(`Collection cancel could not reach content script: ${error?.message || 'unknown error'}`);
    return null;
  }
}

function findCollectionTab(sessionId) {
  for (const [tabId, run] of collectionRunsByTab.entries()) {
    if (!sessionId || run.sessionId === sessionId || run.status === 'running') return tabId;
  }
  return null;
}

async function cancelCollectionWorkflow({ tabId = null, providerId = 'leetcode', sessionId = null, reason = 'Collection cancelled' } = {}) {
  const session = await getActiveCollectionSession();
  const activeSessionId = sessionId || session?.sessionId || collectionGuard.sessionId;
  const activeTabId = tabId || findCollectionTab(activeSessionId);

  if (!activeSessionId && collectionGuard.state === LeetCodeCollectionState.IDLE) {
    bootstrapLogger.info(`Collection cancellation skipped: ${reason}; no active session`);
    return { cancelled: false, reason: 'no active session' };
  }

  if (session?.stage === LeetCodeCollectionState.COMPLETE || collectionGuard.state === LeetCodeCollectionState.COMPLETE) {
    bootstrapLogger.info('Collection cancellation skipped: session already complete');
    return { cancelled: false, reason: 'session already complete', sessionId: activeSessionId };
  }

  cancelledSessionIds.add(activeSessionId);
  clearAllStageTimeouts(activeSessionId);
  navigationIssuedSessionIds.delete(activeSessionId);
  activeUploadControllers.get(activeSessionId)?.abort();
  activeUploadControllers.delete(activeSessionId);
  bootstrapLogger.info(`Collection cancellation requested: ${reason}`);
  const cancelError = new Error(reason);
  emitStageTelemetry(stateToTelemetryStage(session?.stage || collectionGuard.state), {
    sessionId: activeSessionId,
    state: LeetCodeCollectionState.CANCELLED,
    previousState: session?.stage || collectionGuard.state,
    nextState: LeetCodeCollectionState.IDLE,
    pageUrl: collectionRunsByTab.get(activeTabId)?.url || null,
    username: session?.username || null,
    graphqlCount: getGraphQLCount(session?.profileData, session?.progressData),
    collectionCount: countProfileCollection(session?.profileData) + countProgressCollection(session?.progressData),
    failure: {
      reason,
      stack: cancelError.stack
    }
  });
  clearStageTelemetry(activeSessionId);

  await sendCollectionCancel(activeTabId, providerId, {
    sessionId: activeSessionId,
    nonce: session?.nonce || null,
    reason
  });

  if (session?.sessionId === activeSessionId) {
    await setCollectionSession({
      ...session,
      stage: LeetCodeCollectionState.CANCELLED,
      cancelledAt: new Date().toISOString(),
      lastError: reason
    });
    await clearCollectionSession();
  }

  for (const [runTabId, run] of collectionRunsByTab.entries()) {
    if (!activeSessionId || run.sessionId === activeSessionId || runTabId === activeTabId) {
      run.status = 'idle';
      run.sessionId = null;
    }
  }

  resetCollectionGuardFromCancellation(activeSessionId, reason);
  return { cancelled: true, sessionId: activeSessionId, reason };
}

async function timeoutCollectionWorkflow({ tabId = null, providerId = 'leetcode', sessionId = null, stage = 'unknown', reason = 'Collection stage timed out' } = {}) {
  const session = await getActiveCollectionSession();
  const activeSessionId = sessionId || session?.sessionId || collectionGuard.sessionId;
  const activeTabId = tabId || findCollectionTab(activeSessionId);

  if (!activeSessionId || collectionGuard.state === LeetCodeCollectionState.IDLE) {
    bootstrapLogger.info(`Stage timeout skipped: ${reason}; no active session`);
    return { timedOut: false, reason: 'no active session' };
  }

  if (session?.stage === LeetCodeCollectionState.COMPLETE || collectionGuard.state === LeetCodeCollectionState.COMPLETE) {
    bootstrapLogger.info(`Stage timeout ignored: ${stage} already completed`);
    return { timedOut: false, reason: 'session already complete', sessionId: activeSessionId };
  }

  cancelledSessionIds.add(activeSessionId);
  clearAllStageTimeouts(activeSessionId);
  navigationIssuedSessionIds.delete(activeSessionId);
  activeUploadControllers.get(activeSessionId)?.abort();
  activeUploadControllers.delete(activeSessionId);
  bootstrapLogger.error(`Collection stage timeout: ${reason}`);
  const timeoutError = new Error(reason);
  emitStageTelemetry(stage, {
    sessionId: activeSessionId,
    state: LeetCodeCollectionState.ERROR,
    previousState: session?.stage || collectionGuard.state,
    nextState: LeetCodeCollectionState.IDLE,
    pageUrl: collectionRunsByTab.get(activeTabId)?.url || null,
    username: session?.username || null,
    graphqlCount: getGraphQLCount(session?.profileData, session?.progressData),
    collectionCount: countProfileCollection(session?.profileData) + countProgressCollection(session?.progressData),
    failure: {
      reason,
      stack: timeoutError.stack
    }
  });
  clearStageTelemetry(activeSessionId);

  await sendCollectionCancel(activeTabId, providerId, {
    sessionId: activeSessionId,
    nonce: session?.nonce || null,
    reason
  });

  if (session?.sessionId === activeSessionId) {
    await setCollectionSession({
      ...session,
      stage: LeetCodeCollectionState.ERROR,
      timedOutStage: stage,
      timedOutAt: new Date().toISOString(),
      lastError: reason
    });
    await clearCollectionSession();
  }

  for (const [runTabId, run] of collectionRunsByTab.entries()) {
    if (!activeSessionId || run.sessionId === activeSessionId || runTabId === activeTabId) {
      run.status = 'idle';
      run.sessionId = null;
    }
  }

  resetCollectionGuardFromError(reason);
  return { timedOut: true, sessionId: activeSessionId, stage, reason };
}

async function runProfileStage({ tabId, providerId, url, username }) {
  chainLogger.info('Step 3 PROFILE_COLLECTION decision: reached');
  const run = getCollectionRun(tabId);
  chainLogger.info(`Step 3 values: tabId=${tabId}, providerId=${providerId}, url=${url}, username=${username}, runStatus=${run.status}`);
  if (run.status === 'running') {
    chainLogger.info('Step 3 PROFILE_COLLECTION decision: skipped; conditional=run.status === "running"; values run.status=running');
    bootstrapLogger.info('Collector not scheduled: already running for current page');
    return;
  }

  let session = null;
  let resumedProfileCollection = false;
  const existing = await getActiveCollectionSession();
  chainLogger.info(`Step 3 session values: existing=${Boolean(existing)}, existing.stage=${existing?.stage || 'none'}`);
  if (existing && existing.stage !== LeetCodeCollectionState.IDLE) {
    chainLogger.info(`Step 3 PROFILE_COLLECTION decision: skipped; conditional=existing && existing.stage !== IDLE; values existing.stage=${existing.stage}`);
    bootstrapLogger.info(`Existing collection session found: ${existing.stage}`);
    if (existing.stage === LeetCodeCollectionState.PROFILE_COLLECTION) {
      session = await ensureSessionNonce(existing);
      restoreGuardFromSession(session, { restoreActiveStage: true });
      if (shouldIgnoreDuplicate('PROFILE_COLLECTION resume', session.sessionId)) return;
      resumedProfileCollection = true;
      bootstrapLogger.info('Profile collection resumed from stored session');
    } else if ([LeetCodeCollectionState.PROFILE_COMPLETE, LeetCodeCollectionState.NAVIGATING, LeetCodeCollectionState.PROGRESS_COLLECTION].includes(existing.stage)) {
      bootstrapLogger.info('Profile already collected; resuming at progress');
      await navigateToProgressOnce(tabId, existing, `stored session stage ${existing.stage}`);
      return;
    } else if (existing.stage === LeetCodeCollectionState.COMPLETE) {
      await cleanupCompletedSession(existing);
      return;
    } else {
      return;
    }
  }

  if (!session) {
    if (shouldIgnoreDuplicate('PROFILE_COLLECTION request')) return;
    chainLogger.info('Step 3 PROFILE_COLLECTION decision: reached start');
    session = {
      sessionId: createId('leetcode-session'),
      nonce: createSessionNonce(),
      stage: LeetCodeCollectionState.PROFILE_COLLECTION,
      startedAt: new Date().toISOString(),
      username,
      profileData: null
    };
    if (!transitionCollectionState(LeetCodeCollectionState.PROFILE_COLLECTION, {
      event: 'start profile collection',
      sessionId: session.sessionId
    })) return;
  }

  run.status = 'running';
  run.sessionId = session.sessionId;
  bootstrapState.collectorInvoked = true;
  await setCollectionSession(session);

  try {
    await startStageTimeout('profile', {
      sessionId: session.sessionId,
      tabId,
      providerId,
      state: LeetCodeCollectionState.PROFILE_COLLECTION,
      previousState: resumedProfileCollection ? LeetCodeCollectionState.PROFILE_COLLECTION : LeetCodeCollectionState.IDLE,
      nextState: LeetCodeCollectionState.NAVIGATING,
      pageUrl: url,
      username
    });
    const profileData = await sendCollectionRequest(tabId, providerId, {
      stage: 'profile',
      url,
      sessionId: session.sessionId,
      nonce: session.nonce
    });
    clearStageTimeout(session.sessionId, 'profile');
    if (cancelledSessionIds.has(session.sessionId)) {
      run.status = 'idle';
      run.sessionId = null;
      cancelledSessionIds.delete(session.sessionId);
      return;
    }
    if (!profileData?.authenticated) {
      run.status = 'idle';
      run.sessionId = null;
      await cancelCollectionWorkflow({
        tabId,
        providerId,
        sessionId: session.sessionId,
        reason: 'LeetCode authentication unavailable'
      });
      return;
    }
    assertMandatoryProfileData(profileData);

    const profileStagePayload = {
      ...profileData,
      sessionId: session.sessionId,
      collectedAt: new Date().toISOString()
    };
    const stored = await setCollectionSession({
      ...session,
      stage: LeetCodeCollectionState.PROFILE_COMPLETE,
      username: profileStagePayload.username || username,
      profileData: profileStagePayload
    });

    bootstrapLogger.info('Profile collection stored');
    emitStageTelemetry('profile', {
      sessionId: session.sessionId,
      state: LeetCodeCollectionState.PROFILE_COLLECTION,
      previousState: LeetCodeCollectionState.IDLE,
      nextState: LeetCodeCollectionState.NAVIGATING,
      pageUrl: url,
      username: profileStagePayload.username || username,
      graphqlCount: getGraphQLCount(profileStagePayload),
      collectionCount: countProfileCollection(profileStagePayload)
    });
    if (!transitionCollectionState(LeetCodeCollectionState.NAVIGATING, {
      event: 'profile complete',
      sessionId: session.sessionId
    })) return;
    await setCollectionSession({
      ...stored,
      stage: LeetCodeCollectionState.NAVIGATING
    });
    await navigateToProgressOnce(tabId, stored, 'profile collection complete');
    run.status = 'completed';
    run.sessionId = session.sessionId;
  } catch (error) {
    clearStageTimeout(session.sessionId, 'profile');
    run.status = 'idle';
    run.sessionId = null;
    if (cancelledSessionIds.has(session.sessionId)) {
      cancelledSessionIds.delete(session.sessionId);
      return;
    }
    emitStageTelemetry('profile', {
      sessionId: session.sessionId,
      state: LeetCodeCollectionState.ERROR,
      previousState: LeetCodeCollectionState.PROFILE_COLLECTION,
      nextState: LeetCodeCollectionState.IDLE,
      pageUrl: url,
      username,
      failure: {
        reason: error?.message || 'Profile collection failed',
        stack: error?.stack || null
      }
    });
    await setSessionError(session, LeetCodeCollectionState.ERROR, error?.message || 'Profile collection failed');
    resetCollectionGuardFromError(error?.message || 'Profile collection failed');
    throw error;
  }
}

async function runProgressStage({ tabId, providerId, url }) {
  chainLogger.info('Step 3 PROGRESS_COLLECTION decision: reached');
  const run = getCollectionRun(tabId);
  chainLogger.info(`Step 3 values: tabId=${tabId}, providerId=${providerId}, url=${url}, runStatus=${run.status}`);
  if (run.status === 'running') {
    chainLogger.info('Step 3 PROGRESS_COLLECTION decision: skipped; conditional=run.status === "running"; values run.status=running');
    bootstrapLogger.info('Collector not scheduled: already running for current page');
    return;
  }

  let session = await getActiveCollectionSession();
  chainLogger.info(`Step 3 progress session values: hasSession=${Boolean(session)}, hasProfileData=${Boolean(session?.profileData)}, stage=${session?.stage || 'none'}`);
  session = await ensureSessionNonce(session);
  restoreGuardFromSession(session);
  rewindRestoredProgressSession(session);
  if (shouldIgnoreDuplicate('PROGRESS_COLLECTION request', session?.sessionId)) return;
  if (!session) {
    chainLogger.info('Step 3 PROGRESS_COLLECTION decision: skipped; conditional=!session');
    bootstrapLogger.info('Progress collection waiting: no stored collection session');
    return;
  }

  if (session.stage === LeetCodeCollectionState.COMPLETE) {
    chainLogger.info('Step 3 PROGRESS_COLLECTION decision: skipped; conditional=session.stage === COMPLETE');
    await cleanupCompletedSession(session);
    return;
  }

  if (session.stage === LeetCodeCollectionState.MERGING) {
    chainLogger.info('Step 3 PROGRESS_COLLECTION decision: skipped; conditional=session.stage === MERGING');
    if (session.mergedPayload) {
      bootstrapLogger.info('Merged session found after reload; resuming upload');
      const uploadStatus = await uploadMergedDataset(session, session.mergedPayload);
      bootstrapLogger.info('Upload status returned to background', uploadStatus);
    } else {
      resetCollectionGuardFromError('Merged session missing mergedPayload');
    }
    return;
  }

  if (session.stage === LeetCodeCollectionState.UPLOADING) {
    chainLogger.info('Step 3 PROGRESS_COLLECTION decision: skipped; conditional=session.stage === UPLOADING');
    await markInterruptedUpload(session);
    return;
  }

  if (session.stage === LeetCodeCollectionState.ERROR) {
    chainLogger.info(`Step 3 PROGRESS_COLLECTION decision: skipped; conditional=terminal/non-collecting stage; value=${session.stage}`);
    bootstrapLogger.info(`Progress collection skipped for stored stage: ${session.stage}`);
    return;
  }

  if (!session?.profileData) {
    chainLogger.info('Step 3 PROGRESS_COLLECTION decision: skipped; conditional=!session?.profileData');
    bootstrapLogger.info('Progress collection waiting: no stored profile session');
    return;
  }

  if (!transitionCollectionState(LeetCodeCollectionState.PROGRESS_COLLECTION, {
    event: 'start progress collection',
    sessionId: session.sessionId
  })) return;

  run.status = 'running';
  run.sessionId = session.sessionId;
  bootstrapState.collectorInvoked = true;
  chainLogger.info('Step 3 PROGRESS_COLLECTION decision: reached start');
  clearStageTimeout(session.sessionId, 'navigating');
  emitStageTelemetry('navigating', {
    sessionId: session.sessionId,
    state: LeetCodeCollectionState.NAVIGATING,
    previousState: LeetCodeCollectionState.PROFILE_COLLECTION,
    nextState: LeetCodeCollectionState.PROGRESS_COLLECTION,
    pageUrl: url,
    username: session.username || extractProfileUsername(session.profileData)
  });
  await setCollectionSession({
    ...session,
    stage: LeetCodeCollectionState.PROGRESS_COLLECTION
  });

  try {
    await startStageTimeout('progress', {
      sessionId: session.sessionId,
      tabId,
      providerId,
      state: LeetCodeCollectionState.PROGRESS_COLLECTION,
      previousState: LeetCodeCollectionState.NAVIGATING,
      nextState: LeetCodeCollectionState.MERGING,
      pageUrl: url,
      username: session.username || extractProfileUsername(session.profileData)
    });
    const progressData = await sendCollectionRequest(tabId, providerId, {
      stage: 'progress',
      url,
      sessionId: session.sessionId,
      nonce: session.nonce
    });
    clearStageTimeout(session.sessionId, 'progress');
    if (cancelledSessionIds.has(session.sessionId)) {
      run.status = 'idle';
      run.sessionId = null;
      cancelledSessionIds.delete(session.sessionId);
      return;
    }
    if (!progressData?.authenticated) {
      run.status = 'idle';
      run.sessionId = null;
      await cancelCollectionWorkflow({
        tabId,
        providerId,
        sessionId: session.sessionId,
        reason: 'LeetCode authentication unavailable on progress page'
      });
      return;
    }
    assertMandatoryProgressData(session, progressData);
    emitStageTelemetry('progress', {
      sessionId: session.sessionId,
      state: LeetCodeCollectionState.PROGRESS_COLLECTION,
      previousState: LeetCodeCollectionState.NAVIGATING,
      nextState: LeetCodeCollectionState.MERGING,
      pageUrl: url,
      username: progressData.username || session.username || extractProfileUsername(session.profileData),
      graphqlCount: getGraphQLCount(progressData),
      collectionCount: countProgressCollection(progressData)
    });

    if (!transitionCollectionState(LeetCodeCollectionState.MERGING, {
      event: 'progress complete',
      sessionId: session.sessionId
    })) return;
    await startStageTimeout('merging', {
      sessionId: session.sessionId,
      tabId,
      providerId,
      state: LeetCodeCollectionState.MERGING,
      previousState: LeetCodeCollectionState.PROGRESS_COLLECTION,
      nextState: LeetCodeCollectionState.UPLOADING,
      pageUrl: url,
      username: progressData.username || session.username || extractProfileUsername(session.profileData)
    });
    if (cancelledSessionIds.has(session.sessionId)) {
      run.status = 'idle';
      run.sessionId = null;
      cancelledSessionIds.delete(session.sessionId);
      return;
    }
    const progressStagePayload = {
      ...progressData,
      sessionId: session.sessionId,
      collectedAt: new Date().toISOString()
    };
    const mergedPayload = mergeCollectionPayload(session, progressStagePayload);
    const mergedSession = await setCollectionSession({
      ...session,
      stage: LeetCodeCollectionState.MERGING,
      progressData: progressStagePayload,
      mergedPayload,
      completedAt: mergedPayload.collectionTimestamps.mergedAt
    });
    clearStageTimeout(session.sessionId, 'merging');
    emitStageTelemetry('merging', {
      sessionId: session.sessionId,
      state: LeetCodeCollectionState.MERGING,
      previousState: LeetCodeCollectionState.PROGRESS_COLLECTION,
      nextState: LeetCodeCollectionState.UPLOADING,
      pageUrl: url,
      username: mergedPayload.username,
      graphqlCount: getGraphQLCount(session.profileData, progressStagePayload),
      collectionCount: countProfileCollection(session.profileData) + countProgressCollection(progressStagePayload)
    });

    bootstrapLogger.info('Progress collection stored; merged dataset ready for upload');
    const uploadStatus = await uploadMergedDataset(mergedSession, mergedPayload);
    bootstrapLogger.info('Upload status returned to background', uploadStatus);
    run.status = 'completed';
    run.sessionId = session.sessionId;
  } catch (error) {
    clearStageTimeout(session.sessionId, 'progress');
    clearStageTimeout(session.sessionId, 'merging');
    run.status = 'idle';
    run.sessionId = null;
    if (cancelledSessionIds.has(session.sessionId)) {
      cancelledSessionIds.delete(session.sessionId);
      return;
    }
    const failedStage = activeStageTelemetry.has(getStageTelemetryKey(session.sessionId, 'merging'))
      ? 'merging'
      : 'progress';
    emitStageTelemetry(failedStage, {
      sessionId: session.sessionId,
      state: LeetCodeCollectionState.ERROR,
      previousState: failedStage === 'merging'
        ? LeetCodeCollectionState.MERGING
        : LeetCodeCollectionState.PROGRESS_COLLECTION,
      nextState: LeetCodeCollectionState.IDLE,
      pageUrl: url,
      username: session.username || extractProfileUsername(session.profileData),
      failure: {
        reason: error?.message || 'Progress collection failed',
        stack: error?.stack || null
      }
    });
    await setSessionError(session, LeetCodeCollectionState.ERROR, error?.message || 'Progress collection failed');
    resetCollectionGuardFromError(error?.message || 'Progress collection failed');
    throw error;
  }
}

async function scheduleCollectionFromPageState(message, sender) {
  chainLogger.info('Step 2 Background scheduler: reached');
  const tabId = sender?.tab?.id;
  const url = message.payload?.url;
  const collectorAllowed = Boolean(message.payload?.isProviderPage && message.payload?.isSupportedCollectionPage);
  const pageHookLoaded = Boolean(message.payload?.pageHookLoaded);
  const pageKind = message.payload?.pageKind;
  const username = message.payload?.username;
  chainLogger.info(`Step 2 values: tabId=${tabId || 'none'}, url=${url || 'unknown'}, isProviderPage=${Boolean(message.payload?.isProviderPage)}, isSupportedCollectionPage=${Boolean(message.payload?.isSupportedCollectionPage)}, collectorAllowed=${collectorAllowed}, pageHookLoaded=${pageHookLoaded}, pageKind=${pageKind || 'none'}, username=${username || 'none'}`);

  if (collectionGuard.state !== LeetCodeCollectionState.IDLE && pageKind !== 'progress' && collectionGuard.state !== LeetCodeCollectionState.NAVIGATING) {
    shouldIgnoreDuplicate('PAGE_STATE_CHANGED duplicate', message.payload?.sessionId);
    return;
  }

  bootstrapLogger.info(`Current URL: ${url || 'unknown'}`);
  bootstrapLogger.info(`Matched rule: ${collectorAllowed ? 'https://leetcode.com/*' : 'none'}`);
  bootstrapLogger.info(`Collector allowed: ${collectorAllowed}`);

  if (!collectorAllowed) {
    bootstrapState.collectorSkipReason = 'collector not allowed for current URL';
    chainLogger.info(`Step 2 Background scheduler: skipped; conditional=!collectorAllowed; values isProviderPage=${Boolean(message.payload?.isProviderPage)}, isSupportedCollectionPage=${Boolean(message.payload?.isSupportedCollectionPage)}`);
    return;
  }

  if (!pageHookLoaded) {
    bootstrapState.collectorSkipReason = 'page hook not loaded yet';
    chainLogger.info(`Step 2 Background scheduler: skipped; conditional=!pageHookLoaded; values pageHookLoaded=${pageHookLoaded}`);
    bootstrapLogger.info('Collector not scheduled: page hook not loaded yet');
    return;
  }

  if (!tabId) {
    bootstrapState.collectorSkipReason = 'missing sender tab id';
    chainLogger.info(`Step 2 Background scheduler: skipped; conditional=!tabId; values tabId=${tabId || 'none'}`);
    bootstrapLogger.info('Collector not scheduled: missing sender tab id');
    return;
  }

  await initializeProviders();

  const run = getCollectionRun(tabId);
  if (run.url !== url) {
    chainLogger.info(`Step 2 run reset: reached; previousUrl=${run.url || 'none'}, nextUrl=${url}`);
    run.url = url;
    run.status = 'idle';
  }

  bootstrapState.collectorSkipReason = null;
  if (pageKind === 'profile') {
    chainLogger.info('Step 3 Background decides PROFILE_COLLECTION: reached');
    await runProfileStage({ tabId, providerId: message.providerId, url, username });
  } else if (pageKind === 'progress') {
    chainLogger.info('Step 3 Background decides PROGRESS_COLLECTION: reached');
    await runProgressStage({ tabId, providerId: message.providerId, url });
  } else {
    chainLogger.info(`Step 3 Background collection decision: skipped; conditional=pageKind not profile/progress; values pageKind=${pageKind || 'none'}`);
  }
}

messageBus.register(MessageType.PING, async () => ({ alive: true }));
messageBus.register(MessageType.STATE_GET, async () => stateStore.getState());
messageBus.register(MessageType.PROVIDER_STATUS_GET, async () => stateStore.getState().providerStatus);
messageBus.register(MessageType.SYNC_REQUESTED, async (message) => syncOrchestrator.requestSync(message.providerId));
messageBus.register(MessageType.SYNC_CANCELLED, async (message, sender) => cancelCollectionWorkflow({
  tabId: sender?.tab?.id || null,
  providerId: message.providerId || 'leetcode',
  sessionId: message.payload?.sessionId || null,
  reason: message.payload?.reason || 'Manual collection cancellation'
}));
messageBus.register(MessageType.PROVIDER_COLLECT_CANCEL, async (message, sender) => cancelCollectionWorkflow({
  tabId: sender?.tab?.id || null,
  providerId: message.providerId || 'leetcode',
  sessionId: message.payload?.sessionId || null,
  reason: message.payload?.reason || 'Manual collection cancellation'
}));
messageBus.register(MessageType.PROVIDER_COLLECT_RESULT, async (message) => {
  bootstrapState.collectResultReceived = true;
  bootstrapLogger.info('PROVIDER_COLLECT_RESULT received');
  const provider = providerRegistry.get(message.providerId);
  provider?.ingestCollectionResult?.(message.payload);
  return null;
});
messageBus.register(MessageType.NETWORK_EVENT, async (message) => {
  const provider = providerRegistry.get(message.providerId);
  provider?.ingestNetworkEvent?.(message.payload);
  return null;
});
messageBus.register(MessageType.PAGE_STATE_CHANGED, async (message, sender) => {
  chainLogger.info('Step 1 PAGE_STATE_CHANGED: reached background listener');
  chainLogger.info('Step 1 payload', message.payload);
  chainLogger.info(`Step 1 sender tab id: ${sender?.tab?.id || 'none'}`);
  bootstrapState.pageStateReceived = true;
  bootstrapLogger.info('PAGE_STATE_CHANGED received');
  logger.debug('Page state changed', message.payload);
  scheduleCollectionFromPageState(message, sender).catch((error) => {
    bootstrapState.collectorSkipReason = error?.message || 'scheduleCollectionFromPageState failed';
    bootstrapLogger.error('Collection scheduling failed');
    bootstrapLogger.error(`Exception message: ${error?.message || 'Unknown error'}`);
    bootstrapLogger.error(`Complete stack trace: ${error?.stack || 'No stack trace available'}`);
  });
  return null;
});
messageBus.register(MessageType.OBSERVABILITY_PAGE_SNAPSHOT, async (message, sender) => {
  const payload = message.payload || {};
  return observabilitySdk.handlePageSnapshot({
    ...payload,
    tabId: sender?.tab?.id,
    frameId: sender?.frameId || 0,
    url: payload.url || sender?.url || sender?.tab?.url || null
  });
});
messageBus.register(MessageType.OBSERVABILITY_PAGE_EXIT, async (message, sender) => {
  return observabilitySdk.handlePageExit({
    tabId: sender?.tab?.id,
    url: message.payload?.url || sender?.url || sender?.tab?.url || null,
    reason: message.payload?.reason || message.payload?.trigger || 'page_exit'
  });
});
messageBus.register(MessageType.LIVE_MONITORING_STATUS_GET, async () => {
  const detected = await liveTelemetrySdk.detectActiveContest();
  const state = await liveTelemetrySdk.getState();
  return { ...state, detected };
});
messageBus.register(MessageType.LIVE_MONITORING_START, async (message) => {
  return liveTelemetrySdk.start({ handle: message.payload?.handle });
});
messageBus.register(MessageType.LIVE_MONITORING_STOP, async (message) => {
  return liveTelemetrySdk.stop(message.payload?.reason || 'manual_stop');
});
messageBus.register(MessageType.LIVE_MONITORING_RECONNECT, async () => {
  return liveTelemetrySdk.reconnect();
});

messageBus.listenRuntime();
bootstrapLogger.info('Runtime.onMessage listener registered');
lifecycleManager.registerAlarmHandlers();
bootstrapLogger.info('Alarm handlers registered');

chrome.alarms.onAlarm.addListener((alarm) => {
  const timeoutAlarm = parseStageTimeoutAlarmName(alarm.name);
  if (!timeoutAlarm) return;
  handleDurableStageTimeout(timeoutAlarm.sessionId, timeoutAlarm.stage).catch((error) => {
    bootstrapLogger.error(`Durable stage timeout handling failed: ${error?.message || 'Unknown error'}`);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  observabilitySdk.handleTabClosed(tabId).catch((error) => {
    observabilityLogger.warn('Observability tab close handling failed', { reason: error?.message || 'unknown' });
  });
  const run = collectionRunsByTab.get(tabId);
  if (!run?.sessionId && collectionGuard.state === LeetCodeCollectionState.IDLE) return;
  cancelCollectionWorkflow({
    tabId,
    sessionId: run?.sessionId || collectionGuard.sessionId,
    reason: 'LeetCode collection tab closed'
  }).catch((error) => {
    bootstrapLogger.error(`Tab close cancellation failed: ${error?.message || 'Unknown error'}`);
  });
  collectionRunsByTab.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    liveTelemetrySdk.handlePageUrl(changeInfo.url).catch((error) => {
      bootstrapLogger.error(`Live monitoring page URL handling failed: ${error?.message || 'Unknown error'}`);
    });
  }
  if (changeInfo.url && !observabilitySdk.registry.findForUrl(changeInfo.url)) {
    observabilitySdk.handlePageExit({
      tabId,
      url: changeInfo.url,
      reason: 'navigation_url_changed'
    }).catch((error) => {
      observabilityLogger.warn('Observability navigation handling failed', { reason: error?.message || 'unknown' });
    });
  }
  if (!changeInfo.url) return;
  const run = collectionRunsByTab.get(tabId);
  const activeSessionId = run?.sessionId || collectionGuard.sessionId;
  if (!activeSessionId || collectionGuard.state === LeetCodeCollectionState.IDLE) return;

  let nextUrl;
  try {
    nextUrl = new URL(changeInfo.url);
  } catch {
    return;
  }

  if (!nextUrl.hostname.endsWith('leetcode.com')) {
    cancelCollectionWorkflow({
      tabId,
      sessionId: activeSessionId,
      reason: 'User left LeetCode during collection'
    }).catch((error) => {
      bootstrapLogger.error(`Leave-LeetCode cancellation failed: ${error?.message || 'Unknown error'}`);
    });
  }
});

chrome.tabs.onActivated.addListener(() => {
  liveTelemetrySdk.handleWindowFocusChanged(true).catch((error) => {
    bootstrapLogger.error(`Live monitoring tab activation handling failed: ${error?.message || 'Unknown error'}`);
  });
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  liveTelemetrySdk.handleWindowFocusChanged(windowId !== chrome.windows.WINDOW_ID_NONE).catch((error) => {
    bootstrapLogger.error(`Live monitoring window focus handling failed: ${error?.message || 'Unknown error'}`);
  });
});

chrome.runtime.onSuspend.addListener(() => {
  if (collectionGuard.state === LeetCodeCollectionState.IDLE) return;
  bootstrapLogger.info('Extension suspend cancellation trigger fired');
  navigationIssuedSessionIds.delete(collectionGuard.sessionId);
  cancelledSessionIds.add(collectionGuard.sessionId);
  resetCollectionGuardFromCancellation(collectionGuard.sessionId, 'Extension service worker suspended');
});

chrome.runtime.onInstalled.addListener(async () => {
  bootstrapLogger.info('onInstalled trigger fired');
  await initializeObservability();
  await initializeProviders();
  await lifecycleManager.install();
});

chrome.runtime.onStartup.addListener(async () => {
  bootstrapLogger.info('onStartup trigger fired');
  await initializeObservability();
  await observabilitySdk.recoverUnfinishedSessions('browser_startup');
  await initializeProviders();
  await lifecycleManager.startup();
});

initializeObservability()
  .then(() => observabilitySdk.recoverUnfinishedSessions('service_worker_bootstrap'))
  .then(() => initializeProviders())
  .then(() => stateStore.initialize())
  .then(() => cleanupUploadLedger('background bootstrap'))
  .then(() => getActiveCollectionSession())
  .then((session) => recoverDurableStageTimeout(session))
  .catch((error) => errorReporter.report(error, { phase: 'background.bootstrap' }));

setTimeout(() => {
  if (!bootstrapState.collectorInvoked) {
    bootstrapLogger.info('Collector never invoked.');
  }
  bootstrapLogger.info('=============================');
  bootstrapLogger.info('[CPInsight:Bootstrap Summary]');
  bootstrapLogger.info(`Content script loaded: ${bootstrapState.pageStateReceived}`);
  bootstrapLogger.info('Injected bridge loaded: content/page realm');
  bootstrapLogger.info('Page hook loaded: page realm');
  bootstrapLogger.info(`Provider imported: ${bootstrapState.providerImported}`);
  bootstrapLogger.info(`Provider initialized: ${bootstrapState.providerInitialized}`);
  bootstrapLogger.info(`Collector registered: ${bootstrapState.collectorRegistered}`);
  bootstrapLogger.info(`Collector invoked: ${bootstrapState.collectorInvoked}`);
  bootstrapLogger.info(`Reason collector did not execute (if applicable): ${bootstrapState.collectorSkipReason || 'collector request sent or completed'}`);
  bootstrapLogger.info('=============================');
}, AppConfig.debug.bootstrapSummaryDelayMs);
