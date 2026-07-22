import { SessionState } from '../models/session-states.js';

const allowedTransitions = Object.freeze({
  [SessionState.IDLE]: new Set([SessionState.CONTEST_DETECTED]),
  [SessionState.CONTEST_DETECTED]: new Set([SessionState.SESSION_INITIALIZING]),
  [SessionState.SESSION_INITIALIZING]: new Set([SessionState.SESSION_ACTIVE]),
  [SessionState.SESSION_ACTIVE]: new Set([SessionState.SESSION_PAUSED, SessionState.SESSION_ENDED]),
  [SessionState.SESSION_PAUSED]: new Set([SessionState.SESSION_RESUMED, SessionState.SESSION_ENDED]),
  [SessionState.SESSION_RESUMED]: new Set([SessionState.SESSION_ACTIVE, SessionState.SESSION_PAUSED, SessionState.SESSION_ENDED]),
  [SessionState.SESSION_ENDED]: new Set([SessionState.ARCHIVED]),
  [SessionState.ARCHIVED]: new Set([])
});

export class LifecycleManager {
  constructor({ logger } = {}) {
    this.logger = logger;
  }

  canTransition(from, to) {
    return Boolean(allowedTransitions[from]?.has(to));
  }

  transition(session, nextState, metadata = {}) {
    const currentState = session?.state || SessionState.IDLE;
    if (!this.canTransition(currentState, nextState)) {
      throw new Error(`Illegal observability session transition: ${currentState} -> ${nextState}`);
    }
    const transitioned = {
      ...session,
      state: nextState,
      updatedAt: new Date().toISOString(),
      stateHistory: [
        ...(session?.stateHistory || []),
        {
          from: currentState,
          to: nextState,
          timestamp: new Date().toISOString(),
          metadata
        }
      ]
    };
    this.logger?.info('Observability session transition', {
      sessionId: transitioned.sessionId,
      transition: `${currentState} -> ${nextState}`
    });
    return transitioned;
  }
}
