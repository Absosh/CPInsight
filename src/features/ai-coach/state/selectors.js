import { searchWorkspace } from '../utils/search.js';

export function selectActiveSession(state) {
  return state.sessions.find((session) => session.sessionId === state.activeSessionId) || state.sessions[0] || null;
}

export function selectVisibleSessions(state) {
  return state.sessions
    .filter((session) => session.status !== 'deleted')
    .filter((session) => state.filters.status === 'all' || session.status === state.filters.status)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function selectWorkspaceSearch(state) {
  const messages = state.sessions.flatMap((session) => session.messages);
  const evidence = messages.flatMap((message) => message.sections?.evidence || []);
  const recommendations = messages.flatMap((message) => message.sections?.recommendations || []);
  return searchWorkspace({
    sessions: selectVisibleSessions(state),
    reflections: state.contextualInsights.recentReflections,
    recommendations,
    evidence,
    query: state.searchQuery
  });
}
