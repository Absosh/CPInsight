const pool = require('../database/pool');
const HttpError = require('../utils/httpError');
const telemetryRepository = require('../repositories/telemetryRepository');
const outboxRepository = require('../domain-events/outbox/repository');
const { createTelemetryProcessingPipeline } = require('../telemetry/pipeline/factory');
const { TelemetryPipelineError } = require('../telemetry/pipeline/errors');

function scopedRepository(db) {
  return {
    findExistingEvents: (eventIds) => telemetryRepository.findExistingEvents(eventIds, db),
    upsertBatch: (payload) => telemetryRepository.upsertBatch(payload, db),
    insertEvent: (payload) => telemetryRepository.insertEvent(payload, db),
    insertProcessedEvent: (payload) => telemetryRepository.insertProcessedEvent(payload, db),
    insertPipelineMetrics: (payload) => telemetryRepository.insertPipelineMetrics(payload, db)
  };
}

function scopedOutboxRepository(db) {
  return {
    insert: (event) => outboxRepository.insert(event, db)
  };
}

async function recordFailure({ userId, batch, headers, error }) {
  const firstEvent = batch?.events?.[0];
  await Promise.allSettled([
    telemetryRepository.insertUploadAttempt({
      userId,
      batchId: batch?.batchId || null,
      status: error.transient ? 'transient_failure' : 'failed',
      eventCount: batch?.events?.length || 0,
      acknowledgedCount: 0,
      errorCode: error.code || 'TELEMETRY_PROCESSING_FAILURE',
      errorMessage: error.message,
      requestMetadata: {
        idempotencyKey: headers['idempotency-key'] || null,
        userAgent: headers['user-agent'] || null
      }
    }),
    telemetryRepository.insertDeadLetter({
      userId,
      batchId: batch?.batchId || null,
      eventId: firstEvent?.event?.eventId || null,
      sequenceNumber: firstEvent?.sequenceNumber || null,
      failureCategory: error.category || 'processing',
      failureCode: error.code || 'TELEMETRY_PROCESSING_FAILURE',
      failureMessage: error.message,
      transient: Boolean(error.transient),
      payload: batch || null
    }),
    telemetryRepository.insertPipelineMetrics({
      userId,
      batchId: batch?.batchId || null,
      requestId: null,
      status: 'failed',
      metrics: {
        eventsReceived: batch?.events?.length || 0,
        eventsProcessed: 0,
        duplicatesRemoved: 0,
        validationFailures: error.category === 'validation' || error.category === 'ordering' ? 1 : 0,
        processingErrors: 1,
        retryCount: 0,
        queueDepth: batch?.events?.length || 0,
        pipelineThroughput: 0,
        averageProcessingLatency: 0
      },
      errorCode: error.code || 'TELEMETRY_PROCESSING_FAILURE',
      errorMessage: error.message
    })
  ]);
}

async function uploadTelemetryBatch(userId, batch, headers = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const pipeline = createTelemetryProcessingPipeline({
      repository: scopedRepository(client),
      outboxRepository: scopedOutboxRepository(client)
    });
    await pipeline.initialize();
    const context = await pipeline.process({
      userId,
      batch,
      headers,
      receivedAt: new Date().toISOString(),
      requestId: headers['x-request-id'] || undefined
    });
    await telemetryRepository.insertUploadAttempt({
      userId,
      batchId: batch.batchId,
      status: 'accepted',
      eventCount: batch.events.length,
      acknowledgedCount: context.acknowledgement.acknowledgedEventIds.length,
      requestMetadata: {
        idempotencyKey: headers['idempotency-key'] || null,
        userAgent: headers['user-agent'] || null
      }
    }, client);
    await client.query('COMMIT');
    await pipeline.flush();
    await pipeline.shutdown();
    return context.acknowledgement;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    const normalized = error instanceof TelemetryPipelineError
      ? error
      : new TelemetryPipelineError(error?.message || 'Telemetry processing failed', {
        code: 'STORAGE_FAILURE',
        status: 500,
        category: 'storage',
        transient: true
      });
    await recordFailure({ userId, batch, headers, error: normalized });
    if (normalized.status && normalized.status < 500) {
      throw new HttpError(normalized.status, normalized.message, normalized.details, normalized.code);
    }
    if (error instanceof HttpError) throw error;
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { uploadTelemetryBatch };
