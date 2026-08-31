import React, { useRef } from 'react';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';
import { selectVisibleSessions } from '../state/selectors.js';
import { SessionList } from './SessionList.jsx';

const navItems = [
  ['conversation', 'Sessions', 'Continue coaching threads', 'CH'],
  ['contestReviews', 'Contest Reviews', 'Review completed contests', 'CR'],
  ['studyPlans', 'Study Planner', 'Prioritized practice plan', 'SP'],
  ['reflections', 'Reflection Timeline', 'Validated behavior memory', 'RT']
];

function returnToDashboard() {
  window.location.href = 'dashboard.html';
}

const iconPaths = {
  chevron: 'm6 9 6 6 6-6',
  search: 'm21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  chat: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z'
};

function SidebarIcon({ name }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d={iconPaths[name]} />
    </svg>
  );
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function activityDateLabel(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return 'Recent';

  const today = startOfDay(new Date());
  const day = startOfDay(date);
  const diffDays = Math.round((today - day) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupActivitySessions(sessions) {
  return sessions.reduce((groups, session) => {
    const label = activityDateLabel(session.updatedAt || session.createdAt);
    const group = groups.find((item) => item.label === label);
    if (group) group.sessions.push(session);
    else groups.push({ label, sessions: [session] });
    return groups;
  }, []);
}

function ActivityList({ sessions, activeSessionId, onSelect }) {
  const priority = sessions.filter((session) => session.pinned).slice(0, 4);
  const regular = sessions.filter((session) => !session.pinned);
  const groups = groupActivitySessions(regular);

  return (
    <section className="coach-activity-list" aria-label="Activity">
      {priority.length ? (
        <div className="coach-activity-group">
          <h2>Priority</h2>
          {priority.map((session) => (
            <button key={session.sessionId} type="button" data-active={session.sessionId === activeSessionId} onClick={() => onSelect(session.sessionId)}>
              <strong>{session.title}</strong>
              <small><SidebarIcon name="chat" /> CPInsight · Work</small>
            </button>
          ))}
        </div>
      ) : null}
      {groups.map((group) => (
        <div className="coach-activity-group" key={group.label}>
          <h2>{group.label}</h2>
          {group.sessions.map((session) => (
            <button key={session.sessionId} type="button" data-active={session.sessionId === activeSessionId} onClick={() => onSelect(session.sessionId)}>
              <strong>{session.title}</strong>
              <small><SidebarIcon name="chat" /> Chat</small>
            </button>
          ))}
        </div>
      ))}
      {!sessions.length ? (
        <p className="coach-activity-empty">No activity yet.</p>
      ) : null}
    </section>
  );
}

export function LeftSidebar({ searchInputRef }) {
  const { state, dispatch, startNewConversation, selectConversation } = useAiCoachWorkspace();
  const localSearchRef = useRef(null);
  const ref = searchInputRef || localSearchRef;
  const [activityOpen, setActivityOpen] = React.useState(false);
  const sessions = selectVisibleSessions(state);

  async function openActivitySession(sessionId) {
    await selectConversation(sessionId);
    setActivityOpen(false);
  }

  return (
    <aside className="coach-left-sidebar" aria-label="AI Assistant workspace navigation">
      <div className="coach-sidebar-main">
        <header className="coach-chatgpt-header">
          <button type="button" className="coach-product-switch" aria-label="AI Assistant menu" onClick={() => setActivityOpen(false)}>
            <span>CPInsight</span>
            <SidebarIcon name="chevron" />
          </button>
          <div className="coach-header-actions">
            <button
              type="button"
              aria-label="Focus search"
              onClick={() => {
                setActivityOpen(false);
                ref.current?.focus();
              }}
            >
              <SidebarIcon name="search" />
            </button>
            <button
              type="button"
              aria-label="Open activity"
              aria-pressed={activityOpen}
              onClick={() => setActivityOpen((open) => !open)}
            >
              <SidebarIcon name="bell" />
            </button>
          </div>
        </header>
        <button
          type="button"
          className="coach-new-chat-row"
          onClick={() => {
            setActivityOpen(false);
            startNewConversation();
          }}
        >
          <SidebarIcon name="edit" />
          <span>New chat</span>
        </button>
        {activityOpen ? (
          <ActivityList sessions={sessions} activeSessionId={state.activeSessionId} onSelect={openActivitySession} />
        ) : (
          <>
            <label className="coach-search">
              <span>Search</span>
              <input
                ref={ref}
                value={state.searchQuery}
                onChange={(event) => dispatch({ type: 'workspace/searchChanged', query: event.target.value })}
                placeholder="Sessions, evidence, reflections"
              />
            </label>
            <div className="coach-filter-row">
              <select value={state.filters.status} onChange={(event) => dispatch({ type: 'workspace/filterChanged', key: 'status', value: event.target.value })} aria-label="Session status filter">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <select value={state.filters.confidence} onChange={(event) => dispatch({ type: 'workspace/filterChanged', key: 'confidence', value: event.target.value })} aria-label="Confidence filter">
                <option value="all">Any confidence</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <nav className="coach-nav">
              {navItems.map(([view, label, subtitle, icon]) => (
                <button key={view} type="button" aria-current={state.activeView === view ? 'page' : undefined} onClick={() => dispatch({ type: 'workspace/viewChanged', view })}>
                  <span className="coach-nav-icon" aria-hidden="true">{icon}</span>
                  <span>
                    <strong>{label}</strong>
                    <small>{subtitle}</small>
                  </span>
                </button>
              ))}
            </nav>
            <SessionList />
          </>
        )}
      </div>
      <div className="coach-sidebar-footer">
        <button type="button" className="coach-return-button" onClick={returnToDashboard}>
          <span className="coach-nav-icon" aria-hidden="true">&lt;</span>
          <span>
            <strong>Return</strong>
            <small>Back to dashboard</small>
          </span>
        </button>
      </div>
    </aside>
  );
}
