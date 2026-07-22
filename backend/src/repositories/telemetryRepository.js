const pool = require('../database/pool');

async function findExistingEvents(eventIds, db = pool) {
  if (!eventIds.length) return [];
  const result = await db.query(
    'SELECT event_id, user_id FROM telemetry_events WHERE event_id = ANY($1::uuid[])',
    [eventIds]
  );
  return result.rows;
}

async function upsertBatch({ userId, batch }, db = pool) {
  const result = await db.query(
    `INSERT INTO telemetry_batches
       (user_id, batch_id, sequence_number, sdk_version, schema_version,
        collector_version, event_count, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'accepted')
     ON CONFLICT (user_id, batch_id)
     DO UPDATE SET
       event_count = GREATEST(telemetry_batches.event_count, EXCLUDED.event_count),
       status = 'accepted'
     RETURNING *`,
    [
      userId,
      batch.batchId,
      batch.sequenceNumber,
      batch.sdkVersion,
      batch.schemaVersion,
      batch.collectorVersion,
      batch.events.length
    ]
  );
  return result.rows[0];
}

async function insertEvent({ userId, batchRowId, batch, item }, db = pool) {
  const event = item.event;
  const result = await db.query(
    `INSERT INTO telemetry_events
       (user_id, batch_row_id, event_id, session_id, platform, contest_id,
        contest_name, problem_id, event_type, event_timestamp, page_url,
        sequence_number, schema_version, sdk_version, collector_version,
        payload, metadata, ingestion_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17, 'accepted')
     ON CONFLICT (event_id) DO NOTHING
     RETURNING id, event_id`,
    [
      userId,
      batchRowId,
      event.eventId,
      event.sessionId,
      event.platform,
      event.contestId,
      event.contestName || null,
      event.problemId || null,
      event.eventType,
      event.timestamp,
      event.pageUrl,
      item.sequenceNumber,
      batch.schemaVersion,
      batch.sdkVersion,
      batch.collectorVersion,
      JSON.stringify(event),
      JSON.stringify(event.metadata || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertProcessedEvent({ userId, rawEventId, batch, item, requestId }, db = pool) {
  const result = await db.query(
    `INSERT INTO processed_telemetry_events
       (user_id, raw_event_row_id, event_id, batch_id, request_id,
        sequence_number, event_type, classification, normalized_timestamp,
        received_at, ingested_at, processing_latency_ms, sdk_version,
        schema_version, collector_version, platform, processing_metadata,
        classification_metadata)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $13,
             $14, $15, $16, $17, $18)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING *`,
    [
      userId,
      rawEventId,
      item.event.eventId,
      batch.batchId,
      requestId,
      item.sequenceNumber,
      item.event.eventType,
      item.classification.category,
      item.normalizedTimestamp,
      item.processed.receivedAt,
      item.processed.ingestedAt,
      Math.max(0, Math.floor(item.processed.processingLatency || 0)),
      batch.sdkVersion,
      batch.schemaVersion,
      batch.collectorVersion,
      item.event.platform,
      JSON.stringify(item.processed),
      JSON.stringify(item.classification)
    ]
  );
  return result.rows[0] || null;
}

async function insertUploadAttempt(record, db = pool) {
  const result = await db.query(
    `INSERT INTO upload_attempts
       (user_id, batch_id, status, event_count, acknowledged_count,
        error_code, error_message, request_metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      record.userId,
      record.batchId,
      record.status,
      record.eventCount || 0,
      record.acknowledgedCount || 0,
      record.errorCode || null,
      record.errorMessage || null,
      JSON.stringify(record.requestMetadata || {})
    ]
  );
  return result.rows[0];
}

async function insertEventFailure(record, db = pool) {
  const result = await db.query(
    `INSERT INTO event_failures
       (user_id, batch_id, event_id, sequence_number, failure_code, failure_message, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      record.userId || null,
      record.batchId || null,
      record.eventId || null,
      record.sequenceNumber || null,
      record.failureCode,
      record.failureMessage,
      record.payload ? JSON.stringify(record.payload) : null
    ]
  );
  return result.rows[0];
}

async function insertDeadLetter(record, db = pool) {
  const result = await db.query(
    `INSERT INTO telemetry_dead_letters
       (user_id, batch_id, event_id, sequence_number, failure_category,
        failure_code, failure_message, transient, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      record.userId || null,
      record.batchId || null,
      record.eventId || null,
      record.sequenceNumber || null,
      record.failureCategory,
      record.failureCode,
      record.failureMessage,
      Boolean(record.transient),
      record.payload ? JSON.stringify(record.payload) : null
    ]
  );
  return result.rows[0];
}

async function insertPipelineMetrics(record, db = pool) {
  const metrics = record.metrics || {};
  const result = await db.query(
    `INSERT INTO telemetry_pipeline_metrics
       (user_id, batch_id, request_id, status, events_received,
        events_processed, duplicates_removed, validation_failures,
        processing_errors, retry_count, queue_depth, pipeline_throughput,
        average_processing_latency_ms, error_code, error_message)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7, $8,
             $9, $10, $11, $12,
             $13, $14, $15)
     RETURNING *`,
    [
      record.userId || null,
      record.batchId || null,
      record.requestId || null,
      record.status,
      metrics.eventsReceived || 0,
      metrics.eventsProcessed || 0,
      metrics.duplicatesRemoved || 0,
      metrics.validationFailures || 0,
      metrics.processingErrors || 0,
      metrics.retryCount || 0,
      metrics.queueDepth || 0,
      metrics.pipelineThroughput || 0,
      metrics.averageProcessingLatency || 0,
      record.errorCode || null,
      record.errorMessage || null
    ]
  );
  return result.rows[0];
}

module.exports = {
  findExistingEvents,
  upsertBatch,
  insertEvent,
  insertProcessedEvent,
  insertUploadAttempt,
  insertEventFailure,
  insertDeadLetter,
  insertPipelineMetrics
};
