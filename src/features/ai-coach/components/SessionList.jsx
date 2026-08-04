import React, { useState } from 'react';
import { selectVisibleSessions } from '../state/selectors.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';

const iconPaths = {
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  rename: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z',
  pin: 'M12 17v5M5 3h14l-2 6 3 4H4l3-4-2-6Z',
  duplicate: 'M8 8h11v11H8zM5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1',
  archive: 'M3 7h18M5 7v12h14V7M9 11h6M4 4h16v3H4z',
  delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3'
};

function SessionIcon({ name }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d={iconPaths[name]} />
    </svg>
  );
}

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
  const [openMenuId, setOpenMenuId] = useState(null);
  const sessions = selectVisibleSessions(state);

  async function handleRename(session) {
    const title = globalThis.prompt?.('Rename conversation', session.title);
    if (title && title.trim() && title.trim() !== session.title) await renameConversation(session.sessionId, title.trim());
  }

  async function handleDelete(session) {
    if (globalThis.confirm?.(`Delete "${session.title}"?`)) await deleteConversation(session.sessionId);
  }

  const actions = (session) => [
    { label: 'Rename', icon: 'rename', onClick: () => handleRename(session) },
    { label: session.pinned ? 'Unpin chat' : 'Pin chat', icon: 'pin', onClick: () => pinConversation(session.sessionId, !session.pinned) },
    { label: 'Duplicate', icon: 'duplicate', onClick: () => duplicateConversation(session.sessionId) },
    { label: 'Archive', icon: 'archive', onClick: () => archiveConversation(session.sessionId) },
    { label: 'Delete', icon: 'delete', onClick: () => handleDelete(session), danger: true }
  ];

  async function runAction(action) {
    setOpenMenuId(null);
    await action.onClick();
  }

  return (
    <section className="coach-session-list" aria-label="Session history">
      {sessions.map((session) => (
        <article key={session.sessionId} className="coach-session-row" data-active={session.sessionId === state.activeSessionId}>
          <button className="coach-session-title-button" type="button" onClick={() => selectConversation(session.sessionId)}>
            <strong>{session.title}</strong>
          </button>
          <div className="coach-session-row-tools">
            {session.pinned ? (
              <span className="coach-session-pin" aria-label="Pinned chat" title="Pinned chat">
                <SessionIcon name="pin" />
              </span>
            ) : null}
            <button
              type="button"
              className="coach-session-menu-button"
              aria-label={`Open actions for ${session.title}`}
              aria-expanded={openMenuId === session.sessionId}
              onClick={() => setOpenMenuId((current) => current === session.sessionId ? null : session.sessionId)}
            >
              <SessionIcon name="dots" />
            </button>
            {openMenuId === session.sessionId ? (
              <div className="coach-session-menu" role="menu">
                {actions(session).map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    data-danger={action.danger ? 'true' : undefined}
                    onClick={() => runAction(action)}
                  >
                    <SessionIcon name={action.icon} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
