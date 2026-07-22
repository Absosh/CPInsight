const pool = require('../database/pool');

async function insertDomainEvent(event, db = pool) {
  const result = await db.query(
    `INSERT INTO domain_events
       (event_id, event_type, event_version, occurred_at, published_at,
        aggregate_type, aggregate_id, source, payload, metadata,
        correlation_id, causation_id)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING *`,
    [
      event.eventId,
      event.eventType,
      event.eventVersion,
      event.occurredAt,
      event.publishedAt,
      event.aggregateType,
      event.aggregateId,
      event.source,
      JSON.stringify(event.payload || {}),
      JSON.stringify(event.metadata || {}),
      event.correlationId || null,
      event.causationId || null
    ]
  );
  return result.rows[0] || null;
}

async function insertAuditLog({ event, subscriberId, action, status, metadata = {} }, db = pool) {
  const result = await db.query(
    `INSERT INTO domain_event_audit_log
       (event_id, event_type, aggregate_type, aggregate_id, subscriber_id,
        action, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (event_id, subscriber_id, action) DO NOTHING
     RETURNING *`,
    [
      event.eventId,
      event.eventType,
      event.aggregateType,
      event.aggregateId,
      subscriberId,
      action,
      status,
      JSON.stringify(metadata)
    ]
  );
  return result.rows[0];
}

async function insertSubscriberFailure({ event, failure }, db = pool) {
  const result = await db.query(
    `INSERT INTO domain_event_subscriber_failures
       (event_id, event_type, subscriber_id, aggregate_type, aggregate_id,
        error_code, error_message, attempts, payload)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9)
     RETURNING *`,
    [
      event.eventId,
      event.eventType,
      failure.subscriberId,
      event.aggregateType,
      event.aggregateId,
      failure.errorCode,
      failure.errorMessage,
      failure.attempts || 1,
      JSON.stringify({ event, failure })
    ]
  );
  return result.rows[0];
}

async function insertDispatchMetric({ event, subscriberResults = [], durationMs = 0 }, db = pool) {
  const failures = subscriberResults.filter((result) => result.status === 'rejected').length;
  const result = await db.query(
    `INSERT INTO domain_event_dispatch_metrics
       (event_id, event_type, aggregate_type, aggregate_id,
        subscriber_count, failure_count, dispatch_latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (event_id) DO UPDATE SET
       subscriber_count = EXCLUDED.subscriber_count,
       failure_count = EXCLUDED.failure_count,
       dispatch_latency_ms = EXCLUDED.dispatch_latency_ms,
       recorded_at = NOW()
     RETURNING *`,
    [
      event.eventId,
      event.eventType,
      event.aggregateType,
      event.aggregateId,
      subscriberResults.length,
      failures,
      Math.max(0, Math.floor(durationMs))
    ]
  );
  return result.rows[0];
}

module.exports = {
  insertDomainEvent,
  insertAuditLog,
  insertSubscriberFailure,
  insertDispatchMetric
};
