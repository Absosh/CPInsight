const RECONSTRUCTION_VERSION = 1;
const SESSION_GAP_MS = 30 * 60 * 1000;

function timestamp(event) {
  return new Date(event.event_timestamp || event.timestamp || event.normalized_timestamp).getTime();
}

function normalizePayload(row) {
  const payload = row.payload || {};
  return {
    rowId: row.id || null,
    eventId: row.event_id || payload.eventId,
    sessionId: row.session_id || payload.sessionId,
    platform: row.platform || payload.platform,
    contestId: row.contest_id || payload.contestId || null,
    contestName: row.contest_name || payload.contestName || null,
    problemId: row.problem_id || payload.problemId || null,
    eventType: row.event_type || payload.eventType,
    pageUrl: row.page_url || payload.pageUrl || null,
    timestamp: new Date(row.event_timestamp || payload.timestamp).toISOString(),
    metadata: row.metadata || payload.metadata || {}
  };
}

function inferStatus(events) {
  if (events.some((event) => event.eventType === 'SESSION_ENDED')) return 'completed';
  if (events.some((event) => event.eventType === 'SESSION_PAUSED')) return 'interrupted';
  const last = events[events.length - 1];
  if (!last) return 'abandoned';
  const ageMs = Date.now() - Date.parse(last.timestamp);
  return ageMs > SESSION_GAP_MS ? 'abandoned' : 'active';
}

class SessionReconstructor {
  reconstruct(rows) {
    const events = rows
      .map(normalizePayload)
      .filter((event) => event.sessionId && event.eventType && event.timestamp)
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp) || left.eventId.localeCompare(right.eventId));

    const bySession = new Map();
    for (const event of events) {
      if (!bySession.has(event.sessionId)) bySession.set(event.sessionId, []);
      const sessionEvents = bySession.get(event.sessionId);
      if (!sessionEvents.some((existing) => existing.eventId === event.eventId)) sessionEvents.push(event);
    }

    return [...bySession.entries()].map(([sessionId, sessionEvents]) => this.reconstructOne(sessionId, sessionEvents));
  }

  reconstructOne(sessionId, events) {
    const first = events[0];
    const last = events[events.length - 1];
    const problemTimeline = [];
    const focusTimeline = [];
    const submissionTimeline = [];
    const navigationTimeline = [];
    let currentProblem = null;
    let currentProblemStartedAt = null;

    for (const event of events) {
      if (event.eventType === 'PROBLEM_OPENED' || event.eventType === 'PROBLEM_SWITCHED') {
        if (currentProblem && currentProblemStartedAt) {
          problemTimeline.push({
            problemId: currentProblem,
            startedAt: currentProblemStartedAt,
            endedAt: event.timestamp,
            durationMs: Date.parse(event.timestamp) - Date.parse(currentProblemStartedAt)
          });
        }
        currentProblem = event.problemId;
        currentProblemStartedAt = event.timestamp;
      }
      if (event.eventType === 'TAB_HIDDEN' || event.eventType === 'TAB_VISIBLE') {
        focusTimeline.push({ type: event.eventType, at: event.timestamp });
      }
      if (event.eventType.includes('SUBMISSION')) {
        submissionTimeline.push({ type: event.eventType, problemId: event.problemId, at: event.timestamp });
      }
      if (event.pageUrl) {
        navigationTimeline.push({ type: event.eventType, problemId: event.problemId, pageUrl: event.pageUrl, at: event.timestamp });
      }
    }

    if (currentProblem && currentProblemStartedAt) {
      problemTimeline.push({
        problemId: currentProblem,
        startedAt: currentProblemStartedAt,
        endedAt: last.timestamp,
        durationMs: Math.max(0, Date.parse(last.timestamp) - Date.parse(currentProblemStartedAt))
      });
    }

    const startedAt = first.timestamp;
    const endedAt = inferStatus(events) === 'active' ? null : last.timestamp;
    return Object.freeze({
      sourceSessionId: sessionId,
      sessionType: first.contestId ? 'contest' : 'practice',
      status: inferStatus(events),
      platform: first.platform,
      contestId: first.contestId,
      contestName: first.contestName,
      startedAt,
      endedAt,
      durationMs: Math.max(0, timestamp(last) - timestamp(first)),
      events,
      problemTimeline,
      focusTimeline,
      submissionTimeline,
      navigationTimeline,
      reconstructionMetadata: {
        eventCount: events.length,
        duplicatePolicy: 'eventId',
        incomplete: !endedAt,
        reconstructionVersion: RECONSTRUCTION_VERSION
      },
      reconstructionVersion: RECONSTRUCTION_VERSION
    });
  }
}

module.exports = { SessionReconstructor, RECONSTRUCTION_VERSION };
