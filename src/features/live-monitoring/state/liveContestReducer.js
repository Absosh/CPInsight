const initialStats = Object.freeze({
  solved: 0,
  attempts: 0,
  rank: null,
  penalty: null,
  submissions: [],
  verdicts: {},
  behaviorSignals: [],
  confidence: 0,
  timeline: [],
  connectionStatus: 'disconnected',
  contestDurationMs: 0
});

export function createInitialLiveContestState() {
  return { ...initialStats };
}

export function liveContestReducer(state, action) {
  const eventType = action.eventType || action.payload?.metadata?.domainEventType || action.type;
  const event = action.payload?.payload || action.payload || {};
  const metadata = action.payload?.metadata || {};
  const timelineItem = {
    id: event.telemetryEventId || action.id || `${eventType}:${Date.now()}`,
    eventType,
    occurredAt: action.payload?.occurredAt || new Date().toISOString(),
    problemId: event.problemId || null,
    metadata
  };
  if (eventType === 'telemetry.connected') return { ...state, connectionStatus: 'connected' };
  if (eventType === 'telemetry.disconnected') return { ...state, connectionStatus: 'disconnected' };
  if (event.eventType === 'ACCEPTED' || event.eventType === 'PROBLEM_SOLVED') {
    return { ...state, solved: state.solved + 1, timeline: [timelineItem, ...state.timeline].slice(0, 200) };
  }
  if (event.eventType === 'SUBMISSION_CREATED') {
    return { ...state, attempts: state.attempts + 1, submissions: [timelineItem, ...state.submissions].slice(0, 100), timeline: [timelineItem, ...state.timeline].slice(0, 200) };
  }
  if (event.eventType === 'SUBMISSION_VERDICT') {
    const verdict = metadata.verdict || 'UNKNOWN';
    return {
      ...state,
      verdicts: { ...state.verdicts, [verdict]: (state.verdicts[verdict] || 0) + 1 },
      timeline: [timelineItem, ...state.timeline].slice(0, 200)
    };
  }
  if (event.eventType === 'RANK_CHANGED') {
    return {
      ...state,
      rank: metadata.rank || state.rank,
      penalty: metadata.penalty || state.penalty,
      timeline: [timelineItem, ...state.timeline].slice(0, 200)
    };
  }
  if (event.eventType?.startsWith('BEHAVIOR_')) {
    return { ...state, behaviorSignals: [timelineItem, ...state.behaviorSignals].slice(0, 50), timeline: [timelineItem, ...state.timeline].slice(0, 200) };
  }
  return { ...state, timeline: [timelineItem, ...state.timeline].slice(0, 200) };
}
