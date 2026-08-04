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

  const actions = (session) => [
    { label: 'Rename conversation', icon: '✎', onClick: () => handleRename(session) },
    { label: session.pinned ? 'Unpin conversation' : 'Pin conversation', icon: session.pinned ? '⌾' : '⌖', onClick: () => pinConversation(session.sessionId, !session.pinned) },
    { label: 'Duplicate conversation', icon: '⧉', onClick: () => duplicateConversation(session.sessionId) },
    { label: 'Archive conversation', icon: '⌄', onClick: () => archiveConversation(session.sessionId) },
    { label: 'Delete conversation', icon: '×', onClick: () => handleDelete(session), danger: true }
  ];

  return (
    <section className="coach-session-list" aria-label="Session history">
      {sessions.map((session) => (
        <article key={session.sessionId} className="coach-session-row" data-active={session.sessionId === state.activeSessionId}>
          <button type="button" onClick={() => selectConversation(session.sessionId)}>
            <strong>{session.pinned ? 'Pinned: ' : ''}{session.title}</strong>
            <span>{session.preview || session.summary || dateFormatter.format(new Date(session.updatedAt))}</span>
          </button>
          <div className="coach-session-actions">
            {actions(session).map((action) => (
              <button
                key={action.label}
                type="button"
                className="coach-session-icon-button"
                data-danger={action.danger ? 'true' : undefined}
                aria-label={action.label}
                title={action.label}
                onClick={action.onClick}
              >
                <span aria-hidden="true">{action.icon}</span>
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
