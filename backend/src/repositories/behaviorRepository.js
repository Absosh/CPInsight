const pool = require('../database/pool');

async function getTelemetryEvents(userId, { from = null, to = null, limit = 100000 } = {}, db = pool) {
  const values = [userId];
  const clauses = ['user_id = $1'];
  if (from) {
    values.push(from);
    clauses.push(`event_timestamp >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    clauses.push(`event_timestamp <= $${values.length}`);
  }
  const result = await db.query(
    `SELECT *
     FROM telemetry_events
     WHERE ${clauses.join(' AND ')}
     ORDER BY event_timestamp ASC, sequence_number ASC
     LIMIT ${Math.max(1, Math.min(500000, Number(limit) || 100000))}`,
    values
  );
  return result.rows;
}

async function insertSession(userId, session, db = pool) {
  const result = await db.query(
    `INSERT INTO behavior_sessions
       (user_id, source_session_id, session_type, status, platform, contest_id,
        started_at, ended_at, duration_ms, problem_timeline, focus_timeline,
        submission_timeline, navigation_timeline, reconstruction_metadata,
        reconstruction_version)
     VALUES ($1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10, $11,
             $12, $13, $14, $15)
     ON CONFLICT (user_id, source_session_id, reconstruction_version) DO UPDATE SET
       status = EXCLUDED.status,
       ended_at = EXCLUDED.ended_at,
       duration_ms = EXCLUDED.duration_ms,
       problem_timeline = EXCLUDED.problem_timeline,
       focus_timeline = EXCLUDED.focus_timeline,
       submission_timeline = EXCLUDED.submission_timeline,
       navigation_timeline = EXCLUDED.navigation_timeline,
       reconstruction_metadata = EXCLUDED.reconstruction_metadata
     RETURNING *`,
    [
      userId,
      session.sourceSessionId,
      session.sessionType,
      session.status,
      session.platform,
      session.contestId,
      session.startedAt,
      session.endedAt,
      session.durationMs,
      JSON.stringify(session.problemTimeline),
      JSON.stringify(session.focusTimeline),
      JSON.stringify(session.submissionTimeline),
      JSON.stringify(session.navigationTimeline),
      JSON.stringify(session.reconstructionMetadata),
      session.reconstructionVersion
    ]
  );
  return result.rows[0];
}

async function insertFeatures({ userId, sessionRow, session, features, windowKey = 'session' }, db = pool) {
  const inserted = [];
  for (const item of features) {
    const result = await db.query(
      `INSERT INTO behavior_features
         (user_id, behavior_session_id, source_session_id, feature_name, feature_group,
          value, confidence, window_key, platform, contest_id, feature_version,
          extractor_id, metadata)
       VALUES ($1, $2, $3, $4, $5,
               $6, $7, $8, $9, $10, $11,
               $12, $13)
       RETURNING *`,
      [
        userId,
        sessionRow.id,
        session.sourceSessionId,
        item.featureName,
        item.featureGroup,
        JSON.stringify(item.value),
        item.confidence,
        windowKey,
        session.platform,
        session.contestId,
        item.featureVersion,
        item.extractorId,
        JSON.stringify(item.metadata || {})
      ]
    );
    inserted.push({
      id: result.rows[0].id,
      ...item
    });
  }
  return inserted;
}

async function insertProfile(profile, db = pool) {
  const result = await db.query(
    `INSERT INTO behavior_profiles
       (user_id, profile_window, platform, profile_version, reading_style,
        decision_style, attention_pattern, contest_strategy, persistence,
        risk_profile, stress_profile, learning_style, time_management,
        confidence, feature_ids)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $13,
             $14, $15)
     RETURNING *`,
    [
      profile.userId,
      profile.profileWindow,
      profile.platform,
      profile.profileVersion,
      JSON.stringify(profile.readingStyle),
      JSON.stringify(profile.decisionStyle),
      JSON.stringify(profile.attentionPattern),
      JSON.stringify(profile.contestStrategy),
      JSON.stringify(profile.persistence),
      JSON.stringify(profile.riskProfile),
      JSON.stringify(profile.stressProfile),
      JSON.stringify(profile.learningStyle),
      JSON.stringify(profile.timeManagement),
      profile.confidence,
      profile.featureIds
    ]
  );
  return result.rows[0];
}

async function insertMetrics(record, db = pool) {
  const result = await db.query(
    `INSERT INTO feature_extraction_metrics
       (user_id, run_id, sessions_reconstructed, features_extracted,
        extraction_latency_ms, confidence_distribution, incomplete_sessions,
        failed_reconstructions, feature_version, status, error_message)
     VALUES ($1, $2, $3, $4,
             $5, $6, $7,
             $8, $9, $10, $11)
     RETURNING *`,
    [
      record.userId || null,
      record.runId,
      record.sessionsReconstructed || 0,
      record.featuresExtracted || 0,
      record.extractionLatencyMs || 0,
      JSON.stringify(record.confidenceDistribution || {}),
      record.incompleteSessions || 0,
      record.failedReconstructions || 0,
      record.featureVersion || 1,
      record.status,
      record.errorMessage || null
    ]
  );
  return result.rows[0];
}

async function getSessions(userId, limit = 50, db = pool) {
  const result = await db.query(
    `SELECT * FROM behavior_sessions
     WHERE user_id = $1
     ORDER BY started_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function getLatestProfile(userId, windowKey = 'all', db = pool) {
  const result = await db.query(
    `SELECT * FROM behavior_profiles
     WHERE user_id = $1 AND profile_window = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, windowKey]
  );
  return result.rows[0] || null;
}

async function getFeatures(userId, { windowKey = null, featureName = null, limit = 200 } = {}, db = pool) {
  const values = [userId];
  const clauses = ['user_id = $1'];
  if (windowKey) {
    values.push(windowKey);
    clauses.push(`window_key = $${values.length}`);
  }
  if (featureName) {
    values.push(featureName);
    clauses.push(`feature_name = $${values.length}`);
  }
  values.push(Math.max(1, Math.min(1000, Number(limit) || 200)));
  const result = await db.query(
    `SELECT * FROM behavior_features
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

module.exports = {
  getTelemetryEvents,
  insertSession,
  insertFeatures,
  insertProfile,
  insertMetrics,
  getSessions,
  getLatestProfile,
  getFeatures
};
