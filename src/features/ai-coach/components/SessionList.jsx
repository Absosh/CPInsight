import React from 'react';
import { selectVisibleSessions } from '../state/selectors.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

export function SessionList() {
  const {
    state,
    selectConversation,
    renameConversation,
    pinConversation,
    archiveConversation,
    deleteConversation,
    duplicateConversation
  } = useAiCoachWorkspace();
  const sessions = selectVisibleSessions(state);
  const dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function handleRename(session) {
    const title = globalThis.prompt?.('Rename conversation', session.title);
    if (title && title.trim() && title.trim() !== session.title) await renameConversation(session.sessionId, title.trim());
  }

  async function handleDelete(session) {
    if (globalThis.confirm?.(`Delete "${session.title}"?`)) await deleteConversation(session.sessionId);
  }

  return (
    <section className="coach-session-list" aria-label="Session history">
      {sessions.map((session) => (
        <article key={session.sessionId} className="coach-session-row" data-active={session.sessionId === state.activeSessionId}>
          <button type="button" onClick={() => selectConversation(session.sessionId)}>
            <strong>{session.pinned ? 'Pinned: ' : ''}{session.title}</strong>
            <span>{session.preview || session.summary || dateFormatter.format(new Date(session.updatedAt))}</span>
          </button>
          <div className="coach-session-actions">
            <button type="button" aria-label="Rename conversation" onClick={() => handleRename(session)}>Rename</button>
            <button type="button" aria-label="Pin conversation" onClick={() => pinConversation(session.sessionId, !session.pinned)}>{session.pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" aria-label="Duplicate conversation" onClick={() => duplicateConversation(session.sessionId)}>Duplicate</button>
            <button type="button" aria-label="Archive conversation" onClick={() => archiveConversation(session.sessionId)}>Archive</button>
            <button type="button" aria-label="Delete conversation" onClick={() => handleDelete(session)}>Delete</button>
          </div>
        </article>
      ))}
    </section>
  );
}
