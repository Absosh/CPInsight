import { AppConfig } from '../config/defaults.js';
import { StorageArea, StorageKey } from '../constants/storage-keys.js';
import { detectCodeforcesContest } from './codeforces-detector.js';
import { CodeforcesApiClient } from './codeforces-api-client.js';
import { SubmissionDiffEngine } from './submission-diff-engine.js';
import { LiveMonitoringState, assertLiveMonitoringTransition } from './state-machine.js';

function nowIso() {
  return new Date().toISOString();
}

function normalizeEventType(type) {
  return String(type).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

export class LiveTelemetrySDK {
  constructor({ storage, httpClient, tokenProvider, logger, codeforcesClient = new CodeforcesApiClient() } = {}) {
    this.storage = storage;
    this.httpClient = httpClient;
    this.tokenProvider = tokenProvider;
    this.logger = logger;
    this.codeforcesClient = codeforcesClient;
    this.diffEngine = new SubmissionDiffEngine();
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.sequenceNumber = 1;
  }

  async getState() {
    return this.storage.get(StorageKey.LIVE_MONITORING_STATE, { state: LiveMonitoringState.IDLE }, StorageArea.LOCAL);
  }

  async setState(next) {
    await this.storage.set(StorageKey.LIVE_MONITORING_STATE, next, StorageArea.LOCAL);
    return next;
  }

  async detectActiveContest() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return detectCodeforcesContest(tab?.url);
  }

  async start({ handle } = {}) {
    const detected = await this.detectActiveContest();
    if (!detected.supported) {
      const state = { state: LiveMonitoringState.IDLE, detected, error: detected.reason };
      await this.setState(state);
      return state;
    }
    const current = await this.getState();
    assertLiveMonitoringTransition(current.state || LiveMonitoringState.IDLE, LiveMonitoringState.PREPARING);
    await this.setState({ ...current, state: LiveMonitoringState.PREPARING, detected, userHandle: handle });
    const token = await this.tokenProvider.getAccessToken();
    if (!token) throw new Error('CPInsight authentication is required before live monitoring');
    const session = await this.httpClient.request(AppConfig.liveMonitoring.startPath, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        platform: detected.platform,
        contestId: detected.contestId,
        contestName: detected.contestName,
        contestUrl: detected.contestUrl,
        userHandle: handle,
        metadata: { contestType: detected.contestType }
      })
    });
    const next = {
      state: LiveMonitoringState.MONITORING,
      detected,
      userHandle: handle,
      liveSessionId: session.liveSessionId,
      sessionToken: session.sessionToken || current.sessionToken,
      telemetrySessionId: session.telemetrySessionId,
      startedAt: nowIso(),
      elapsedMs: 0,
      eventsSent: 0,
      queueDepth: 0,
      connectionHealth: 'connected',
      lastPollAt: null,
      lastHeartbeatAt: null
    };
    await this.setState(next);
    await this.emitEvent('session_started', { metadata: { contest: detected } });
    if (detected.problemId) {
      await this.emitEvent('problem_opened', { problemId: detected.problemId, pageUrl: detected.pageUrl });
      await this.setState({ ...(await this.getState()), currentProblemId: detected.problemId, problemEnteredAt: Date.now(), lastActivityAt: Date.now() });
    }
    await this.flushQueue();
    this.schedulePolling(AppConfig.liveMonitoring.fastPollMs);
    this.scheduleHeartbeat();
    return next;
  }

  async stop(reason = 'manual_stop') {
    const state = await this.getState();
    if (!state.liveSessionId || !state.sessionToken) return state;
    await this.emitEvent('session_stopped', { metadata: { reason } });
    await this.flushQueue();
    const token = await this.tokenProvider.getAccessToken();
    const stopped = await this.httpClient.request(AppConfig.liveMonitoring.stopPath, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        liveSessionId: state.liveSessionId,
        sessionToken: state.sessionToken,
        reason,
        finalStatistics: { eventsSent: state.eventsSent || 0, stoppedAt: nowIso() }
      })
    });
    this.clearTimers();
    const next = { ...state, state: LiveMonitoringState.PROCESSING_REVIEW, connectionHealth: 'stopped', reviewJobId: stopped.reviewJobId, stoppedAt: nowIso() };
    await this.setState(next);
    return next;
  }

  async reconnect() {
    const state = await this.getState();
    if (!state.liveSessionId) return state;
    await this.setState({ ...state, state: LiveMonitoringState.RECONNECTING, connectionHealth: 'reconnecting' });
    await this.flushQueue();
    this.schedulePolling(AppConfig.liveMonitoring.fastPollMs);
    this.scheduleHeartbeat();
    return this.getState();
  }

  async handlePageUrl(url) {
    const state = await this.getState();
    if (state.state !== LiveMonitoringState.MONITORING) return;
    const detected = detectCodeforcesContest(url);
    if (!detected.supported || detected.contestId !== state.detected?.contestId) return;
    const now = Date.now();
    if (detected.problemId && detected.problemId !== state.currentProblemId) {
      if (state.currentProblemId && state.problemEnteredAt) {
        await this.emitEvent('reading_duration', {
          problemId: state.currentProblemId,
          pageUrl: state.detected.pageUrl,
          metadata: { durationMs: now - state.problemEnteredAt }
        });
        await this.emitEvent('problem_switch', {
          problemId: detected.problemId,
          pageUrl: detected.pageUrl,
          metadata: { previousProblemId: state.currentProblemId }
        });
      } else {
        await this.emitEvent('problem_opened', { problemId: detected.problemId, pageUrl: detected.pageUrl });
      }
      await this.setState({ ...state, detected, currentProblemId: detected.problemId, problemEnteredAt: now, lastActivityAt: now });
    }
  }

  async handleWindowFocusChanged(focused) {
    const state = await this.getState();
    if (state.state !== LiveMonitoringState.MONITORING) return;
    await this.emitEvent(focused ? 'window_focus' : 'window_blur', {
      metadata: { connectionHealth: state.connectionHealth || 'connected' }
    });
    await this.setState({ ...state, lastActivityAt: Date.now() });
  }

  async evaluateIdle() {
    const state = await this.getState();
    if (state.state !== LiveMonitoringState.MONITORING) return;
    const idleMs = Date.now() - (state.lastActivityAt || Date.now());
    if (idleMs > 120000 && !state.idle) {
      await this.emitEvent('idle', { metadata: { idleMs } });
      await this.setState({ ...state, idle: true });
    } else if (state.idle && idleMs <= 120000) {
      await this.emitEvent('resume', { metadata: { idleMs } });
      await this.setState({ ...state, idle: false, lastActivityAt: Date.now() });
    }
  }

  async emitEvent(eventType, { problemId = null, pageUrl = null, metadata = {}, timestamp = nowIso(), dedupeKey = null } = {}) {
    const state = await this.getState();
    if (!state.detected) return null;
    const event = {
      eventId: crypto.randomUUID(),
      eventType: normalizeEventType(eventType),
      timestamp,
      pageUrl: pageUrl || state.detected.pageUrl || state.detected.contestUrl,
      problemId,
      metadata: {
        ...metadata,
        dedupeKey,
        source: 'extension_live_monitoring'
      }
    };
    const queue = await this.storage.get(StorageKey.LIVE_MONITORING_QUEUE, [], StorageArea.LOCAL);
    if (dedupeKey && queue.some((item) => item.metadata?.dedupeKey === dedupeKey)) return null;
    await this.storage.set(StorageKey.LIVE_MONITORING_QUEUE, [...queue, event], StorageArea.LOCAL);
    await this.setState({ ...state, queueDepth: queue.length + 1 });
    return event;
  }

  async pollOnce() {
    const state = await this.getState();
    if (state.state !== LiveMonitoringState.MONITORING || !state.userHandle) return;
    try {
      const submissions = await this.codeforcesClient.userStatus(state.userHandle, { count: 25 });
      const standingsPayload = await this.codeforcesClient.contestStandings(state.detected.contestId, state.userHandle).catch(() => null);
      const standings = standingsPayload?.rows?.[0]
        ? { rank: standingsPayload.rows[0].rank, points: standingsPayload.rows[0].points, penalty: standingsPayload.rows[0].penalty }
        : null;
      const snapshot = { submissions, standings, polledAt: nowIso() };
      const previous = await this.storage.get(StorageKey.LIVE_MONITORING_SNAPSHOT, {}, StorageArea.LOCAL);
      const diffEvents = this.diffEngine.diff(previous, snapshot);
      for (const event of diffEvents) {
        await this.emitEvent(event.eventType, event);
      }
      await this.storage.set(StorageKey.LIVE_MONITORING_SNAPSHOT, snapshot, StorageArea.LOCAL);
      await this.flushQueue();
      const interval = diffEvents.length ? AppConfig.liveMonitoring.fastPollMs : AppConfig.liveMonitoring.idlePollMs;
      await this.setState({ ...(await this.getState()), lastPollAt: nowIso(), connectionHealth: 'connected' });
      this.schedulePolling(interval);
    } catch (error) {
      this.logger?.warn('Live monitoring poll failed', { reason: error.message });
      await this.setState({ ...(await this.getState()), state: LiveMonitoringState.RECONNECTING, connectionHealth: 'reconnecting', error: error.message });
      this.schedulePolling(AppConfig.liveMonitoring.idlePollMs);
    }
  }

  async flushQueue() {
    const state = await this.getState();
    const queue = await this.storage.get(StorageKey.LIVE_MONITORING_QUEUE, [], StorageArea.LOCAL);
    if (!queue.length || !state.liveSessionId || !state.sessionToken) return;
    const token = await this.tokenProvider.getAccessToken();
    if (!token || !navigator.onLine) return;
    const events = queue.slice(0, AppConfig.liveMonitoring.maxEventsPerUpload);
    const response = await this.httpClient.request(AppConfig.liveMonitoring.uploadPath, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        liveSessionId: state.liveSessionId,
        sessionToken: state.sessionToken,
        sequenceNumber: this.sequenceNumber,
        events,
        metadata: { collectorVersion: 'codeforces-live-monitor-v1' }
      })
    });
    const acknowledged = new Set(response.acknowledgedEventIds || []);
    const remaining = queue.filter((event) => !acknowledged.has(event.eventId));
    this.sequenceNumber += events.length;
    await this.storage.set(StorageKey.LIVE_MONITORING_QUEUE, remaining, StorageArea.LOCAL);
    await this.setState({ ...state, eventsSent: (state.eventsSent || 0) + acknowledged.size, queueDepth: remaining.length, connectionHealth: 'connected' });
  }

  async sendHeartbeat() {
    const state = await this.getState();
    if (!state.liveSessionId || !state.sessionToken) return;
    const token = await this.tokenProvider.getAccessToken();
    if (!token) return;
    const queue = await this.storage.get(StorageKey.LIVE_MONITORING_QUEUE, [], StorageArea.LOCAL);
    await this.httpClient.request(AppConfig.liveMonitoring.heartbeatPath, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        liveSessionId: state.liveSessionId,
        sessionToken: state.sessionToken,
        connectionStatus: navigator.onLine ? 'connected' : 'offline',
        eventCount: state.eventsSent || 0,
        queueDepth: queue.length,
        metadata: { elapsedMs: state.startedAt ? Date.now() - Date.parse(state.startedAt) : 0 }
      })
    });
    await this.emitEvent('heartbeat', { metadata: { queueDepth: queue.length, eventCount: state.eventsSent || 0 } });
    await this.evaluateIdle();
    await this.setState({ ...state, lastHeartbeatAt: nowIso(), queueDepth: queue.length });
  }

  schedulePolling(delayMs) {
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.pollOnce(), delayMs);
  }

  scheduleHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch((error) => this.logger?.warn('Live monitoring heartbeat failed', { reason: error.message }));
    }, AppConfig.liveMonitoring.heartbeatPeriodMinutes * 60 * 1000);
  }

  clearTimers() {
    clearTimeout(this.pollTimer);
    clearInterval(this.heartbeatTimer);
  }
}
