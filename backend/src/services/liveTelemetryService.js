const crypto = require('crypto');
const HttpError = require('../utils/httpError');
const telemetryService = require('./telemetryService');
const repository = require('../repositories/liveTelemetryRepository');

const SDK_VERSION = 'live-monitoring-sdk-v1';
const SCHEMA_VERSION = 1;
const COLLECTOR_VERSION = 'codeforces-live-monitor-v1';

function createSessionToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function assertSessionToken(session, token) {
  if (!session || repository.hashToken(token) !== session.session_token_hash) {
    throw new HttpError(403, 'Invalid live telemetry session token', null, 'LIVE_SESSION_TOKEN_INVALID');
  }
}

function toTelemetryBatch(userId, session, body) {
  const batchId = crypto.randomUUID();
  return {
    batchId,
    sequenceNumber: body.sequenceNumber,
    createdAt: new Date().toISOString(),
    sdkVersion: SDK_VERSION,
    schemaVersion: SCHEMA_VERSION,
    collectorVersion: body.metadata?.collectorVersion || COLLECTOR_VERSION,
    events: body.events.map((event, index) => ({
      sequenceNumber: body.sequenceNumber + index,
      event: {
        eventId: event.eventId,
        sessionId: session.telemetry_session_id,
        userId,
        platform: session.platform,
        contestId: session.contest_id,
        contestName: session.contest_name,
        problemId: event.problemId || null,
        eventType: event.eventType,
        timestamp: event.timestamp,
        pageUrl: event.pageUrl,
        metadata: {
          ...(event.metadata || {}),
          liveSessionId: session.live_session_id,
          source: 'live_monitoring',
          userHandle: session.user_handle
        }
      }
    }))
  };
}

async function startSession(userId, body) {
  const existing = await repository.findActiveByContest(userId, body.platform, body.contestId);
  if (existing) {
    return {
      liveSessionId: existing.live_session_id,
      telemetrySessionId: existing.telemetry_session_id,
      state: existing.state,
      resumed: true,
      sessionToken: null
    };
  }

  const sessionToken = createSessionToken();
  const record = await repository.createSession({
    userId,
    liveSessionId: crypto.randomUUID(),
    telemetrySessionId: `live:${body.platform}:${body.contestId}:${crypto.randomUUID()}`,
    platform: body.platform,
    contestId: body.contestId,
    contestName: body.contestName,
    contestUrl: body.contestUrl,
    userHandle: body.userHandle,
    state: 'monitoring',
    sessionToken,
    metadata: {
      contestStartTime: body.contestStartTime || null,
      contestEndTime: body.contestEndTime || null,
      ...(body.metadata || {})
    }
  });
  await repository.insertMetric({
    liveSessionId: record.live_session_id,
    userId,
    metricName: 'telemetry.connected',
    metricValue: { platform: body.platform, contestId: body.contestId }
  });
  return {
    liveSessionId: record.live_session_id,
    telemetrySessionId: record.telemetry_session_id,
    state: record.state,
    sessionToken,
    resumed: false
  };
}

async function ingestEvents(userId, body, headers = {}) {
  const session = await repository.findSessionForUser(userId, body.liveSessionId);
  assertSessionToken(session, body.sessionToken);
  if (session.state === 'completed') {
    throw new HttpError(409, 'Live telemetry session is already completed', null, 'LIVE_SESSION_COMPLETED');
  }
  const batch = toTelemetryBatch(userId, session, body);
  const acknowledgement = await telemetryService.uploadTelemetryBatch(userId, batch, {
    ...headers,
    'x-live-session-id': body.liveSessionId
  });
  await repository.insertReceipts(body.liveSessionId, batch.events);
  await repository.updateSession(body.liveSessionId, {
    state: 'monitoring',
    connectionStatus: 'connected',
    eventsReceived: body.events.length,
    eventsAcknowledged: acknowledgement.acknowledgedEventIds.length,
    statistics: {
      lastBatchId: batch.batchId,
      highestSequenceNumber: acknowledgement.highestSequenceNumber
    }
  });
  return {
    ...acknowledgement,
    liveSessionId: body.liveSessionId
  };
}

async function heartbeat(userId, body) {
  const session = await repository.findSessionForUser(userId, body.liveSessionId);
  assertSessionToken(session, body.sessionToken);
  await repository.insertHeartbeat({
    liveSessionId: body.liveSessionId,
    connectionStatus: body.connectionStatus,
    eventCount: body.eventCount,
    queueDepth: body.queueDepth,
    metadata: body.metadata
  });
  return repository.updateSession(body.liveSessionId, {
    state: body.connectionStatus === 'reconnecting' ? 'reconnecting' : session.state,
    connectionStatus: body.connectionStatus,
    lastHeartbeatAt: new Date().toISOString(),
    statistics: {
      eventCount: body.eventCount,
      queueDepth: body.queueDepth
    }
  });
}

async function stopSession(userId, body) {
  const session = await repository.findSessionForUser(userId, body.liveSessionId);
  assertSessionToken(session, body.sessionToken);
  const stopped = await repository.updateSession(body.liveSessionId, {
    state: 'processing_review',
    connectionStatus: 'stopped',
    stoppedAt: new Date().toISOString(),
    statistics: body.finalStatistics
  });
  const reviewJob = await repository.queueReviewJob({
    liveSessionId: body.liveSessionId,
    userId,
    metadata: {
      reason: body.reason,
      telemetrySessionId: session.telemetry_session_id,
      platform: session.platform,
      contestId: session.contest_id
    }
  });
  await repository.insertMetric({
    liveSessionId: body.liveSessionId,
    userId,
    metricName: 'review.processing',
    metricValue: { reviewJobId: reviewJob.id, reason: body.reason }
  });
  return {
    liveSessionId: body.liveSessionId,
    state: stopped.state,
    reviewJobId: reviewJob.id
  };
}

module.exports = { startSession, ingestEvents, heartbeat, stopSession };
