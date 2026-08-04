import React, { useRef } from 'react';
import { AiCoachView } from '../types/aiCoachTypes.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';
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

export function LeftSidebar({ searchInputRef }) {
  const { state, dispatch } = useAiCoachWorkspace();
  const localSearchRef = useRef(null);
  const ref = searchInputRef || localSearchRef;
  return (
    <aside className="coach-left-sidebar" aria-label="AI Assistant workspace navigation">
      <header>
        <div>
          <span className="coach-brand-mark">AI</span>
          <h1>AI Assistant</h1>
        </div>
        <button type="button" onClick={() => dispatch({ type: 'sessions/created' })}>New</button>
      </header>
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
          <button key={view} type="button" aria-current={state.activeView === view ? 'page' : undefined} onClick={() => view === AiCoachView.conversation ? dispatch({ type: 'sessions/created' }) : dispatch({ type: 'workspace/viewChanged', view })}>
            <span className="coach-nav-icon" aria-hidden="true">{icon}</span>
            <span>
              <strong>{label}</strong>
              <small>{subtitle}</small>
            </span>
          </button>
        ))}
      </nav>
      <button type="button" className="coach-return-button" onClick={returnToDashboard}>
        <span className="coach-nav-icon" aria-hidden="true">←</span>
        <span>
          <strong>Return</strong>
          <small>Back to dashboard</small>
        </span>
      </button>
      <SessionList />
    </aside>
  );
}
