const pool = require('../../database/pool');
const { OUTBOX_STATUS } = require('./status');

function eventValues(event, status = OUTBOX_STATUS.PENDING) {
  return [
    event.eventId,
    event.aggregateType,
    event.aggregateId,
    event.eventType,
    event.eventVersion,
    event.occurredAt,
    event.publishedAt,
    event.source,
    JSON.stringify(event.payload || {}),
    JSON.stringify(event.metadata || {}),
    event.correlationId || null,
    event.causationId || null,
    status
  ];
}

async function insert(event, db = pool) {
  const result = await db.query(
    `INSERT INTO domain_event_outbox
       (event_id, aggregate_type, aggregate_id, event_type, event_version,
        occurred_at, original_published_at, source, payload, metadata,
        correlation_id, causation_id, status)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING *`,
    eventValues(event)
  );
  return result.rows[0] || null;
}

async function acquirePending({ limit, owner, leaseMs }, db = pool) {
  const result = await db.query(
    `WITH candidates AS (
       SELECT id
       FROM domain_event_outbox candidate
       WHERE candidate.status IN ($1, $2)
         AND candidate.next_attempt_at <= NOW()
         AND NOT EXISTS (
           SELECT 1
           FROM domain_event_outbox earlier
           WHERE earlier.aggregate_type = candidate.aggregate_type
             AND earlier.aggregate_id = candidate.aggregate_id
             AND earlier.outbox_sequence < candidate.outbox_sequence
             AND earlier.status IN ($3, $4, $5)
         )
       ORDER BY candidate.outbox_sequence ASC
       LIMIT $6
       FOR UPDATE SKIP LOCKED
     )
     UPDATE domain_event_outbox outbox
     SET status = $3,
         relay_owner = $7,
         lease_expiration = NOW() + ($8::text || ' milliseconds')::interval,
         publication_token = gen_random_uuid(),
         updated_at = NOW()
     FROM candidates
     WHERE outbox.id = candidates.id
     RETURNING outbox.*`,
    [
      OUTBOX_STATUS.PENDING,
      OUTBOX_STATUS.FAILED,
      OUTBOX_STATUS.PUBLISHING,
      OUTBOX_STATUS.PENDING,
      OUTBOX_STATUS.FAILED,
      limit,
      owner,
      leaseMs
    ]
  );
  return result.rows;
}

async function markPublished({ id, publicationToken }, db = pool) {
  const result = await db.query(
    `UPDATE domain_event_outbox
     SET status = $1,
         published_at = NOW(),
         relay_owner = NULL,
         lease_expiration = NULL,
         updated_at = NOW()
     WHERE id = $2
       AND publication_token = $3
       AND status = $4
     RETURNING *`,
    [OUTBOX_STATUS.PUBLISHED, id, publicationToken, OUTBOX_STATUS.PUBLISHING]
  );
  return result.rows[0] || null;
}

async function markFailed({ id, publicationToken, retryCount, nextAttemptAt, lastError }, db = pool) {
  const result = await db.query(
    `UPDATE domain_event_outbox
     SET status = $1,
         retry_count = $2,
         next_attempt_at = $3,
         last_error = $4,
         retry_history = retry_history || $5::jsonb,
         relay_owner = NULL,
         lease_expiration = NULL,
         updated_at = NOW()
     WHERE id = $6
       AND publication_token = $7
       AND status = $8
     RETURNING *`,
    [
      OUTBOX_STATUS.FAILED,
      retryCount,
      nextAttemptAt,
      lastError.message,
      JSON.stringify([{
        retryCount,
        errorCode: lastError.code || 'OUTBOX_RELAY_FAILURE',
        errorMessage: lastError.message,
        failedAt: new Date().toISOString()
      }]),
      id,
      publicationToken,
      OUTBOX_STATUS.PUBLISHING
    ]
  );
  return result.rows[0] || null;
}

async function moveToDeadLetter({ id, publicationToken, retryCount, lastError }, db = pool) {
  const result = await db.query(
    `UPDATE domain_event_outbox
     SET status = $1,
         retry_count = $2,
         last_error = $3,
         retry_history = retry_history || $4::jsonb,
         relay_owner = NULL,
         lease_expiration = NULL,
         updated_at = NOW()
     WHERE id = $5
       AND publication_token = $6
       AND status = $7
     RETURNING *`,
    [
      OUTBOX_STATUS.DEAD_LETTER,
      retryCount,
      lastError.message,
      JSON.stringify([{
        retryCount,
        errorCode: lastError.code || 'OUTBOX_RELAY_DEAD_LETTER',
        errorMessage: lastError.message,
        stack: lastError.stack || null,
        failedAt: new Date().toISOString()
      }]),
      id,
      publicationToken,
      OUTBOX_STATUS.PUBLISHING
    ]
  );
  return result.rows[0] || null;
}

async function recoverExpiredLeases(db = pool) {
  const result = await db.query(
    `UPDATE domain_event_outbox
     SET status = $1,
         relay_owner = NULL,
         lease_expiration = NULL,
         updated_at = NOW()
     WHERE status = $2
       AND lease_expiration < NOW()
     RETURNING *`,
    [OUTBOX_STATUS.FAILED, OUTBOX_STATUS.PUBLISHING]
  );
  return result.rows;
}

async function findReplayCandidates(filters = {}, db = pool) {
  const clauses = ['status IN ($1, $2)'];
  const values = [OUTBOX_STATUS.PUBLISHED, OUTBOX_STATUS.DEAD_LETTER];

  if (filters.aggregateType) {
    values.push(filters.aggregateType);
    clauses.push(`aggregate_type = $${values.length}`);
  }
  if (filters.aggregateId) {
    values.push(filters.aggregateId);
    clauses.push(`aggregate_id = $${values.length}`);
  }
  if (filters.eventType) {
    values.push(filters.eventType);
    clauses.push(`event_type = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    clauses.push(`created_at >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    clauses.push(`created_at <= $${values.length}`);
  }
  if (filters.batchId) {
    values.push(JSON.stringify({ batchId: filters.batchId }));
    clauses.push(`metadata @> $${values.length}::jsonb`);
  }

  const result = await db.query(
    `SELECT *
     FROM domain_event_outbox
     WHERE ${clauses.join(' AND ')}
     ORDER BY aggregate_type, aggregate_id, outbox_sequence ASC
     LIMIT ${Number.isInteger(filters.limit) ? Math.max(1, filters.limit) : 1000}`,
    values
  );
  return result.rows;
}

async function recordReplay({ outboxId, eventId, requestedBy, reason, status }, db = pool) {
  const result = await db.query(
    `INSERT INTO domain_event_replay_log
       (outbox_id, event_id, requested_by, reason, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [outboxId, eventId, requestedBy || null, reason || null, status]
  );
  return result.rows[0];
}

async function metrics(db = pool) {
  const result = await db.query(
    `SELECT status, COUNT(*)::integer AS count
     FROM domain_event_outbox
     GROUP BY status`
  );
  return result.rows.reduce((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});
}

module.exports = {
  insert,
  acquirePending,
  markPublished,
  markFailed,
  moveToDeadLetter,
  recoverExpiredLeases,
  findReplayCandidates,
  recordReplay,
  metrics
};
