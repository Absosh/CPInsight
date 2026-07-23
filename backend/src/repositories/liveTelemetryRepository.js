const crypto = require('crypto');
const pool = require('../database/pool');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(record, db = pool) {
  const result = await db.query(
    `INSERT INTO telemetry_live_sessions
       (user_id, live_session_id, telemetry_session_id, platform, contest_id,
        contest_name, contest_url, user_handle, state, session_token_hash, metadata)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      record.userId,
      record.liveSessionId,
      record.telemetrySessionId,
      record.platform,
      record.contestId,
      record.contestName || null,
      record.contestUrl,
      record.userHandle || null,
      record.state,
      hashToken(record.sessionToken),
      JSON.stringify(record.metadata || {})
    ]
  );
  return result.rows[0];
}

async function findSessionForUser(userId, liveSessionId, db = pool) {
  const result = await db.query(
    'SELECT * FROM telemetry_live_sessions WHERE user_id = $1 AND live_session_id = $2',
    [userId, liveSessionId]
  );
  return result.rows[0] || null;
}

async function findActiveByContest(userId, platform, contestId, db = pool) {
  const result = await db.query(
    `SELECT * FROM telemetry_live_sessions
     WHERE user_id = $1 AND platform = $2 AND contest_id = $3
       AND state IN ('preparing', 'monitoring', 'paused', 'reconnecting', 'processing_review')
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId, platform, contestId]
  );
  return result.rows[0] || null;
}

async function updateSession(liveSessionId, fields, db = pool) {
  const result = await db.query(
    `UPDATE telemetry_live_sessions
     SET state = COALESCE($2, state),
         connection_status = COALESCE($3, connection_status),
         last_heartbeat_at = COALESCE($4, last_heartbeat_at),
         stopped_at = COALESCE($5, stopped_at),
         events_received = events_received + COALESCE($6, 0),
         events_acknowledged = events_acknowledged + COALESCE($7, 0),
         statistics = statistics || COALESCE($8, '{}'::jsonb),
         updated_at = NOW()
     WHERE live_session_id = $1
     RETURNING *`,
    [
      liveSessionId,
      fields.state || null,
      fields.connectionStatus || null,
      fields.lastHeartbeatAt || null,
      fields.stoppedAt || null,
      fields.eventsReceived || 0,
      fields.eventsAcknowledged || 0,
      JSON.stringify(fields.statistics || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertHeartbeat(record, db = pool) {
  const result = await db.query(
    `INSERT INTO telemetry_live_heartbeat_logs
       (live_session_id, connection_status, event_count, queue_depth, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [record.liveSessionId, record.connectionStatus, record.eventCount || 0, record.queueDepth || 0, JSON.stringify(record.metadata || {})]
  );
  return result.rows[0];
}

async function insertReceipts(liveSessionId, events, db = pool) {
  if (!events.length) return [];
  const rows = [];
  for (const item of events) {
    const result = await db.query(
      `INSERT INTO telemetry_live_event_receipts
         (live_session_id, event_id, event_type, sequence_number, metadata)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING *`,
      [liveSessionId, item.event.eventId, item.event.eventType, item.sequenceNumber, JSON.stringify(item.event.metadata || {})]
    );
    if (result.rows[0]) rows.push(result.rows[0]);
  }
  return rows;
}

async function insertMetric(record, db = pool) {
  const result = await db.query(
    `INSERT INTO contest_monitoring_metrics
       (live_session_id, user_id, metric_name, metric_value)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [record.liveSessionId, record.userId, record.metricName, JSON.stringify(record.metricValue || {})]
  );
  return result.rows[0];
}

async function queueReviewJob(record, db = pool) {
  const result = await db.query(
    `INSERT INTO contest_review_jobs
       (live_session_id, user_id, status, metadata)
     VALUES ($1, $2, 'queued', $3)
     RETURNING *`,
    [record.liveSessionId, record.userId, JSON.stringify(record.metadata || {})]
  );
  return result.rows[0];
}

module.exports = {
  hashToken,
  createSession,
  findSessionForUser,
  findActiveByContest,
  updateSession,
  insertHeartbeat,
  insertReceipts,
  insertMetric,
  queueReviewJob
};
