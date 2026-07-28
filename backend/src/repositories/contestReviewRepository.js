const pool = require('../database/pool');
const { REVIEW_JOB_STATES } = require('../review-worker/jobStates');

function json(value) {
  return JSON.stringify(value || {});
}

async function claimNextJobs({ workerId, limit, leaseMs, retryLimit }, db = pool) {
  const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
  const result = await db.query(
    `WITH candidates AS (
       SELECT id
       FROM contest_review_jobs
       WHERE status IN ($1, $2)
         AND next_attempt_at <= NOW()
       ORDER BY requested_at ASC
       LIMIT $3
       FOR UPDATE SKIP LOCKED
     )
     UPDATE contest_review_jobs job
     SET status = $4::varchar,
         lease_owner = $5,
         lease_expires_at = $6,
         claimed_at = COALESCE(claimed_at, NOW()),
         max_retries = GREATEST(max_retries, $7),
         last_stage = $4::text,
         progress_percent = 5,
         updated_at = NOW()
     FROM candidates
     WHERE job.id = candidates.id
     RETURNING job.*`,
    [
      REVIEW_JOB_STATES.QUEUED,
      REVIEW_JOB_STATES.RETRYING,
      limit,
      REVIEW_JOB_STATES.CLAIMED,
      workerId,
      leaseExpiresAt,
      retryLimit
    ]
  );
  return result.rows;
}

async function recoverExpiredLeases(db = pool) {
  const result = await db.query(
    `UPDATE contest_review_jobs
     SET status = $1,
         lease_owner = NULL,
         lease_expires_at = NULL,
         next_attempt_at = NOW(),
         retry_history = retry_history || $2::jsonb,
         updated_at = NOW()
     WHERE status NOT IN ($3, $4, $5)
       AND lease_expires_at IS NOT NULL
       AND lease_expires_at < NOW()
     RETURNING *`,
    [
      REVIEW_JOB_STATES.RETRYING,
      JSON.stringify([{ reason: 'lease_expired', recoveredAt: new Date().toISOString() }]),
      REVIEW_JOB_STATES.COMPLETED,
      REVIEW_JOB_STATES.DEAD_LETTER,
      REVIEW_JOB_STATES.FAILED
    ]
  );
  return result.rows;
}

async function markStage(job, { stage, progressPercent, metadata = {}, message = null }, db = pool) {
  const result = await db.query(
    `UPDATE contest_review_jobs
     SET status = $2::varchar,
         last_stage = $2::text,
         progress_percent = $3,
         started_at = CASE WHEN $2 = 'running' THEN COALESCE(started_at, NOW()) ELSE started_at END,
         stage_timings = stage_timings || $4::jsonb,
         updated_at = NOW()
     WHERE id = $1
       AND lease_owner = $5
       AND lease_expires_at > NOW()
     RETURNING *`,
    [
      job.id,
      stage,
      progressPercent,
      json({ [stage]: metadata }),
      job.lease_owner
    ]
  );
  const row = result.rows[0] || null;
  if (row) {
    await insertLog({
      jobId: job.id,
      stage,
      status: stage,
      progressPercent,
      message,
      durationMs: metadata.durationMs,
      metadata
    }, db);
  }
  return row;
}

async function completeJob(job, { reviewId, result = {} }, db = pool) {
  const completed = await db.query(
    `UPDATE contest_review_jobs
     SET status = $2,
         progress_percent = 100,
         completed_at = NOW(),
         review_id = $3,
         result = $4,
         lease_owner = NULL,
         lease_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND lease_owner = $5
     RETURNING *`,
    [job.id, REVIEW_JOB_STATES.COMPLETED, reviewId, json(result), job.lease_owner]
  );
  const row = completed.rows[0] || null;
  if (row) {
    await insertLog({
      jobId: job.id,
      stage: REVIEW_JOB_STATES.COMPLETED,
      status: REVIEW_JOB_STATES.COMPLETED,
      progressPercent: 100,
      metadata: result
    }, db);
  }
  return row;
}

async function failJob(job, error, { retryLimit, nextAttemptAt }, db = pool) {
  const nextRetryCount = Number(job.retry_count || 0) + 1;
  const exhausted = nextRetryCount >= Math.max(retryLimit, Number(job.max_retries || retryLimit));
  const nextStatus = exhausted ? REVIEW_JOB_STATES.DEAD_LETTER : REVIEW_JOB_STATES.RETRYING;
  const failure = {
    retryCount: nextRetryCount,
    stage: job.last_stage || job.status,
    errorMessage: error.message,
    errorCode: error.code || 'REVIEW_WORKER_FAILURE',
    failedAt: new Date().toISOString()
  };
  const result = await db.query(
    `UPDATE contest_review_jobs
     SET status = $2,
         retry_count = $3,
         next_attempt_at = $4,
         error_message = $5,
         retry_history = retry_history || $6::jsonb,
         lease_owner = NULL,
         lease_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND lease_owner = $7
     RETURNING *`,
    [
      job.id,
      nextStatus,
      nextRetryCount,
      exhausted ? new Date().toISOString() : nextAttemptAt,
      error.message,
      JSON.stringify([failure]),
      job.lease_owner
    ]
  );
  const row = result.rows[0] || null;
  await insertLog({
    jobId: job.id,
    stage: job.last_stage || job.status,
    status: nextStatus,
    progressPercent: job.progress_percent || 0,
    message: error.message,
    metadata: { retryCount: nextRetryCount, exhausted }
  }, db);
  if (exhausted) {
    await insertDeadLetter({
      job,
      error,
      retryCount: nextRetryCount,
      payload: { metadata: job.metadata, retryHistory: [...(job.retry_history || []), failure] }
    }, db);
  }
  return { job: row, exhausted, retryCount: nextRetryCount };
}

async function insertReview(record, db = pool) {
  const result = await db.query(
    `INSERT INTO contest_reviews
       (live_session_id, user_id, contest_id, platform, title, summary,
        validated_response, quality_report, reasoning_context, evidence_package,
        recommendations, roadmap, reflections, metadata)
     VALUES ($1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10,
             $11, $12, $13, $14)
     ON CONFLICT (live_session_id) DO UPDATE
       SET updated_at = NOW()
     RETURNING *`,
    [
      record.liveSessionId,
      record.userId,
      record.contestId,
      record.platform,
      record.title,
      record.summary || null,
      json(record.validatedResponse),
      json(record.qualityReport),
      json(record.reasoningContext),
      json(record.evidencePackage),
      JSON.stringify(record.recommendations || []),
      json(record.roadmap),
      JSON.stringify(record.reflections || []),
      json(record.metadata)
    ]
  );
  return result.rows[0];
}

async function insertRoadmapUpdate(record, db = pool) {
  const result = await db.query(
    `INSERT INTO contest_roadmap_updates
       (user_id, live_session_id, review_id, roadmap, recommendation_tracking, behavior_evolution)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (review_id) DO UPDATE
       SET roadmap = EXCLUDED.roadmap,
           recommendation_tracking = EXCLUDED.recommendation_tracking,
           behavior_evolution = EXCLUDED.behavior_evolution
     RETURNING *`,
    [
      record.userId,
      record.liveSessionId,
      record.reviewId,
      json(record.roadmap),
      JSON.stringify(record.recommendationTracking || []),
      json(record.behaviorEvolution)
    ]
  );
  return result.rows[0];
}

async function insertLog(record, db = pool) {
  const result = await db.query(
    `INSERT INTO contest_review_execution_logs
       (job_id, stage, status, progress_percent, message, duration_ms, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      record.jobId,
      record.stage,
      record.status,
      record.progressPercent || 0,
      record.message || null,
      record.durationMs || null,
      json(record.metadata)
    ]
  );
  return result.rows[0];
}

async function insertDeadLetter({ job, error, retryCount, payload = {} }, db = pool) {
  const result = await db.query(
    `INSERT INTO contest_review_dead_letters
       (job_id, live_session_id, user_id, failure_reason, stack_trace, retry_count, last_stage, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      job.id,
      job.live_session_id,
      job.user_id,
      error.message,
      error.stack || null,
      retryCount,
      job.last_stage || job.status,
      json(payload)
    ]
  );
  return result.rows[0];
}

async function insertMetric(record, db = pool) {
  const result = await db.query(
    `INSERT INTO contest_review_metrics
       (metric_name, metric_value, worker_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [record.metricName, json(record.metricValue), record.workerId || null]
  );
  return result.rows[0];
}

async function getJob(userId, jobId, db = pool) {
  const result = await db.query(
    `SELECT job.*, session.platform, session.contest_id, session.contest_name, session.user_handle
     FROM contest_review_jobs job
     JOIN telemetry_live_sessions session ON session.live_session_id = job.live_session_id
     WHERE job.id = $1 AND job.user_id = $2`,
    [jobId, userId]
  );
  return result.rows[0] || null;
}

async function listJobs(userId, { limit = 50, status = null } = {}, db = pool) {
  const values = [userId];
  const clauses = ['job.user_id = $1'];
  if (status) {
    values.push(status);
    clauses.push(`job.status = $${values.length}`);
  }
  const result = await db.query(
    `SELECT job.*, session.platform, session.contest_id, session.contest_name
     FROM contest_review_jobs job
     JOIN telemetry_live_sessions session ON session.live_session_id = job.live_session_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY job.requested_at DESC
     LIMIT ${Math.max(1, Math.min(Number(limit) || 50, 200))}`,
    values
  );
  return result.rows;
}

async function latestReview(userId, db = pool) {
  const result = await db.query(
    `SELECT *
     FROM contest_reviews
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function reviewByContest(userId, contestId, { platform = null } = {}, db = pool) {
  const values = [userId, contestId];
  const clauses = ['user_id = $1', 'contest_id = $2'];

  if (platform) {
    values.push(platform);
    clauses.push(`platform = $${values.length}`);
  }

  const result = await db.query(
    `SELECT *
     FROM contest_reviews
     WHERE ${clauses.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

async function statusByContest(userId, contestId, { platform = null } = {}, db = pool) {
  const values = [userId, contestId];
  const clauses = ['job.user_id = $1', 'session.contest_id = $2'];

  if (platform) {
    values.push(platform);
    clauses.push(`session.platform = $${values.length}`);
  }

  const result = await db.query(
    `SELECT job.*, session.platform, session.contest_id, session.contest_name, review.id AS persisted_review_id
     FROM contest_review_jobs job
     JOIN telemetry_live_sessions session ON session.live_session_id = job.live_session_id
     LEFT JOIN contest_reviews review ON review.live_session_id = job.live_session_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY job.requested_at DESC
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

async function getLiveSessionByJob(jobId, db = pool) {
  const result = await db.query(
    `SELECT session.*, job.id AS job_id, job.metadata AS job_metadata
     FROM contest_review_jobs job
     JOIN telemetry_live_sessions session ON session.live_session_id = job.live_session_id
     WHERE job.id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
}

module.exports = {
  claimNextJobs,
  recoverExpiredLeases,
  markStage,
  completeJob,
  failJob,
  insertReview,
  insertRoadmapUpdate,
  insertLog,
  insertMetric,
  getJob,
  listJobs,
  latestReview,
  reviewByContest,
  statusByContest,
  getLiveSessionByJob
};
