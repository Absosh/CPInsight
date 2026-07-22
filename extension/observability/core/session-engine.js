import { createId } from '../../utils/id.js';
import { TelemetryEventType } from '../models/event-types.js';
import { ContestStatus, PageKind } from '../models/page-context.js';
import { SessionState } from '../models/session-states.js';

function compactProblemId(pageContext) {
  if (!pageContext?.problemCode && !pageContext?.problemIndex) return null;
  return [pageContext.problemIndex, pageContext.problemCode].filter(Boolean).join(':');
}

function createSessionKey({ collectorId, contestId }) {
  return `${collectorId}:${contestId}`;
}

export class SessionEngine {
  constructor({ store, eventBus, lifecycleManager, logger } = {}) {
    this.store = store;
    this.eventBus = eventBus;
    this.lifecycleManager = lifecycleManager;
    this.logger = logger;
  }

  async recoverUnfinishedSessions(reason = 'startup') {
    const sessions = await this.store.getSessions();
    const recoverable = Object.values(sessions).filter((session) =>
      ![SessionState.SESSION_ENDED, SessionState.ARCHIVED].includes(session.state)
    );
    for (const session of recoverable) {
      const paused = this.ensurePaused(session, { reason });
      await this.store.upsertSession(paused);
      await this.emitForSession(paused, TelemetryEventType.SESSION_RECOVERED, {
        pageUrl: paused.currentUrl,
        metadata: { reason }
      });
    }
    return recoverable.length;
  }

  async handlePageSnapshot(snapshot) {
    const pageContext = snapshot.pageContext || {};
    if (!pageContext.platform || !pageContext.contestId || pageContext.kind === PageKind.UNSUPPORTED) {
      return this.detachTab(snapshot.tabId, snapshot.url, 'unsupported_or_invalid_page');
    }

    const sessionKey = createSessionKey({
      collectorId: snapshot.collectorId,
      contestId: pageContext.contestId
    });
    let session = await this.store.getSession(sessionKey);
    const isNewSession = !session || [SessionState.SESSION_ENDED, SessionState.ARCHIVED].includes(session.state);

    if (isNewSession) {
      session = await this.createSession({ sessionKey, snapshot, pageContext });
    } else {
      session = await this.attachTab(session, snapshot);
      if (session.state === SessionState.SESSION_PAUSED && snapshot.visibilityState !== 'hidden') {
        session = this.lifecycleManager.transition(session, SessionState.SESSION_RESUMED, { reason: 'supported_page_visible' });
        await this.store.upsertSession(session);
        await this.emitForSession(session, TelemetryEventType.TAB_VISIBLE, {
          pageUrl: snapshot.url,
          metadata: { tabId: snapshot.tabId }
        });
        await this.emitForSession(session, TelemetryEventType.SESSION_RESUMED, { pageUrl: snapshot.url });
        session = this.lifecycleManager.transition(session, SessionState.SESSION_ACTIVE, { reason: 'resume_complete' });
      }
      await this.store.upsertSession(session);
    }

    if (snapshot.navigationType === 'reload') {
      await this.emitForSession(session, TelemetryEventType.PAGE_RELOADED, {
        pageUrl: snapshot.url,
        metadata: { tabId: snapshot.tabId }
      });
    }

    session = await this.updateProblem(session, pageContext, snapshot.url);
    session = await this.updateVisibility(session, snapshot);

    if (pageContext.contestStatus === ContestStatus.FINISHED) {
      session = await this.endSession(session, snapshot.url, 'contest_finished');
    }

    return session;
  }

  async createSession({ sessionKey, snapshot, pageContext }) {
    const baseSession = {
      sessionKey,
      sessionId: createId('contest_session'),
      userId: null,
      platform: pageContext.platform,
      collectorId: snapshot.collectorId,
      contestId: String(pageContext.contestId),
      contestName: pageContext.contestName || null,
      contestType: pageContext.contestType || null,
      contestStartTime: pageContext.contestStartTime || null,
      contestEndTime: pageContext.contestEndTime || null,
      state: SessionState.IDLE,
      tabIds: [],
      currentUrl: snapshot.url,
      currentProblemId: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      stateHistory: [],
      metadata: {
        source: snapshot.source || 'content_script',
        schemaVersion: snapshot.schemaVersion || 1
      }
    };
    let session = this.lifecycleManager.transition(baseSession, SessionState.CONTEST_DETECTED, { reason: 'collector_snapshot' });
    session = await this.attachTab(session, snapshot);
    await this.store.upsertSession(session);
    await this.emitForSession(session, TelemetryEventType.CONTEST_DETECTED, { pageUrl: snapshot.url });
    session = this.lifecycleManager.transition(session, SessionState.SESSION_INITIALIZING, { reason: 'session_id_allocated' });
    session = this.lifecycleManager.transition(session, SessionState.SESSION_ACTIVE, { reason: 'session_ready' });
    await this.store.upsertSession(session);
    await this.emitForSession(session, TelemetryEventType.SESSION_STARTED, { pageUrl: snapshot.url });
    return session;
  }

  async attachTab(session, snapshot) {
    const tabId = String(snapshot.tabId);
    const tabIds = new Set(session.tabIds || []);
    tabIds.add(tabId);
    await this.store.assignTab(tabId, {
      sessionKey: session.sessionKey,
      url: snapshot.url,
      updatedAt: new Date().toISOString()
    });
    return {
      ...session,
      tabIds: Array.from(tabIds),
      currentUrl: snapshot.url,
      updatedAt: new Date().toISOString()
    };
  }

  async detachTab(tabId, pageUrl, reason) {
    if (tabId === undefined || tabId === null) return null;
    const tabKey = String(tabId);
    const linked = await this.store.removeTab(tabKey);
    if (!linked) return null;
    const session = await this.store.getSession(linked.sessionKey);
    if (!session || [SessionState.SESSION_ENDED, SessionState.ARCHIVED].includes(session.state)) return session;
    const nextTabIds = (session.tabIds || []).filter((id) => id !== tabKey);
    let nextSession = {
      ...session,
      tabIds: nextTabIds,
      currentUrl: pageUrl || session.currentUrl,
      updatedAt: new Date().toISOString()
    };
    await this.emitForSession(nextSession, TelemetryEventType.PAGE_EXITED, {
      pageUrl: pageUrl || session.currentUrl,
      metadata: { tabId, reason }
    });
    if (nextTabIds.length === 0) {
      nextSession = this.ensurePaused(nextSession, { reason });
      await this.emitForSession(nextSession, TelemetryEventType.SESSION_PAUSED, {
        pageUrl: nextSession.currentUrl,
        metadata: { reason }
      });
    }
    await this.store.replaceSession(nextSession);
    return nextSession;
  }

  async handleTabClosed(tabId) {
    const tabKey = String(tabId);
    const tabIndex = await this.store.getTabIndex();
    const linked = tabIndex[tabKey];
    if (!linked) return null;
    const session = await this.store.getSession(linked.sessionKey);
    await this.detachTab(tabId, linked.url, 'tab_closed');
    if (session) {
      await this.emitForSession(session, TelemetryEventType.TAB_CLOSED, {
        pageUrl: linked.url,
        metadata: { tabId }
      });
    }
    return session;
  }

  async updateProblem(session, pageContext, pageUrl) {
    if (pageContext.kind !== PageKind.PROBLEM) return session;
    const problemId = compactProblemId(pageContext);
    if (!problemId || session.currentProblemId === problemId) return session;
    const eventType = session.currentProblemId ? TelemetryEventType.PROBLEM_SWITCHED : TelemetryEventType.PROBLEM_OPENED;
    const nextSession = {
      ...session,
      currentProblemId: problemId,
      currentProblemCode: pageContext.problemCode || null,
      currentProblemIndex: pageContext.problemIndex || null,
      updatedAt: new Date().toISOString()
    };
    await this.store.upsertSession(nextSession);
    await this.emitForSession(nextSession, eventType, {
      pageUrl,
      problemId,
      metadata: {
        problemCode: pageContext.problemCode || null,
        problemIndex: pageContext.problemIndex || null
      }
    });
    return nextSession;
  }

  async updateVisibility(session, snapshot) {
    if (!snapshot.visibilityState) return session;
    if (snapshot.visibilityState === 'hidden' && session.state === SessionState.SESSION_ACTIVE) {
      const nextSession = this.lifecycleManager.transition(session, SessionState.SESSION_PAUSED, { reason: 'tab_hidden' });
      await this.store.upsertSession(nextSession);
      await this.emitForSession(nextSession, TelemetryEventType.TAB_HIDDEN, {
        pageUrl: snapshot.url,
        metadata: { tabId: snapshot.tabId }
      });
      return nextSession;
    }
    if (snapshot.visibilityState === 'visible' && session.state === SessionState.SESSION_PAUSED) {
      let nextSession = this.lifecycleManager.transition(session, SessionState.SESSION_RESUMED, { reason: 'tab_visible' });
      await this.emitForSession(nextSession, TelemetryEventType.TAB_VISIBLE, {
        pageUrl: snapshot.url,
        metadata: { tabId: snapshot.tabId }
      });
      nextSession = this.lifecycleManager.transition(nextSession, SessionState.SESSION_ACTIVE, { reason: 'visible_resume_complete' });
      await this.store.upsertSession(nextSession);
      return nextSession;
    }
    return session;
  }

  async endSession(session, pageUrl, reason) {
    if ([SessionState.SESSION_ENDED, SessionState.ARCHIVED].includes(session.state)) return session;
    const resumable = session.state === SessionState.SESSION_RESUMED
      ? this.lifecycleManager.transition(session, SessionState.SESSION_ACTIVE, { reason: 'normalize_before_end' })
      : session;
    const ended = this.lifecycleManager.transition(resumable, SessionState.SESSION_ENDED, { reason });
    const archived = this.lifecycleManager.transition({
      ...ended,
      endedAt: new Date().toISOString()
    }, SessionState.ARCHIVED, { reason: 'terminal_session_persisted' });
    await this.store.upsertSession(archived);
    await this.emitForSession(archived, TelemetryEventType.SESSION_ENDED, {
      pageUrl,
      metadata: { reason }
    });
    return archived;
  }

  ensurePaused(session, metadata = {}) {
    if ([SessionState.SESSION_PAUSED, SessionState.SESSION_ENDED, SessionState.ARCHIVED].includes(session.state)) {
      return session;
    }
    if (session.state === SessionState.SESSION_RESUMED) {
      const active = this.lifecycleManager.transition(session, SessionState.SESSION_ACTIVE, { reason: 'normalize_before_pause' });
      return this.lifecycleManager.transition(active, SessionState.SESSION_PAUSED, metadata);
    }
    if (session.state !== SessionState.SESSION_ACTIVE) return session;
    return this.lifecycleManager.transition(session, SessionState.SESSION_PAUSED, metadata);
  }

  emitForSession(session, eventType, overrides = {}) {
    const problemId = overrides.problemId || session.currentProblemId || null;
    const metadata = {
      collectorId: session.collectorId,
      contestType: session.contestType || null,
      contestStartTime: session.contestStartTime || null,
      contestEndTime: session.contestEndTime || null,
      ...(overrides.metadata || {})
    };
    metadata.dedupeKey = [
      session.sessionId,
      eventType,
      problemId || 'contest',
      overrides.pageUrl || session.currentUrl,
      metadata.tabId || 'session',
      metadata.reason || ''
    ].join(':');
    return this.eventBus.emit({
      sessionId: session.sessionId,
      userId: session.userId || null,
      platform: session.platform,
      contestId: session.contestId,
      contestName: session.contestName,
      problemId,
      eventType,
      pageUrl: overrides.pageUrl || session.currentUrl,
      metadata
    });
  }
}
