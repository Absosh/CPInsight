import React from 'react';
import { selectVisibleSessions } from '../state/selectors.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

export function SessionList() {
  const { state, dispatch } = useAiCoachWorkspace();
  const sessions = selectVisibleSessions(state);
  return (
    <section className="coach-session-list" aria-label="Session history">
      {sessions.map((session) => (
        <article key={session.sessionId} className="coach-session-row" data-active={session.sessionId === state.activeSessionId}>
          <button type="button" onClick={() => dispatch({ type: 'sessions/selected', sessionId: session.sessionId })}>
            <strong>{session.title}</strong>
            <span>{session.summary || session.updatedAt}</span>
          </button>
          <div className="coach-session-actions">
            <button type="button" aria-label="Pin session" onClick={() => dispatch({ type: 'sessions/pinned', sessionId: session.sessionId, pinned: !session.pinned })}>{session.pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" aria-label="Archive session" onClick={() => dispatch({ type: 'sessions/archived', sessionId: session.sessionId })}>Archive</button>
          </div>
        </article>
      ))}
    </section>
  );
}
