import React, { useRef } from 'react';
import { AiCoachView } from '../types/aiCoachTypes.js';
import { useAiCoachWorkspace } from '../state/AiCoachWorkspaceProvider.jsx';
import { SessionList } from './SessionList.jsx';

const navItems = [
  ['conversation', 'New Session'],
  ['contestReviews', 'Contest Reviews'],
  ['studyPlans', 'Study Planner'],
  ['reflections', 'Reflection Timeline'],
  ['savedReports', 'Saved Reports'],
  ['settings', 'Settings']
];

export function LeftSidebar({ searchInputRef }) {
  const { state, dispatch } = useAiCoachWorkspace();
  const localSearchRef = useRef(null);
  const ref = searchInputRef || localSearchRef;
  return (
    <aside className="coach-left-sidebar" aria-label="AI Assistant workspace navigation">
      <header>
        <h1>AI Assistant</h1>
        <button type="button" onClick={() => dispatch({ type: 'sessions/created' })}>New Session</button>
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
        {navItems.map(([view, label]) => (
          <button key={view} type="button" aria-current={state.activeView === view ? 'page' : undefined} onClick={() => view === AiCoachView.conversation ? dispatch({ type: 'sessions/created' }) : dispatch({ type: 'workspace/viewChanged', view })}>
            {label}
          </button>
        ))}
      </nav>
      <SessionList />
    </aside>
  );
}
