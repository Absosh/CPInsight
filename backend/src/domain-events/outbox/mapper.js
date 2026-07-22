const { createDomainEvent } = require('../domainEvent');

function rowToDomainEvent(row) {
  return createDomainEvent({
    eventId: row.event_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    occurredAt: new Date(row.occurred_at).toISOString(),
    publishedAt: new Date(row.original_published_at || row.created_at).toISOString(),
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    source: row.source,
    payload: row.payload || {},
    metadata: {
      ...(row.metadata || {}),
      outboxId: row.id,
      publicationToken: row.publication_token
    },
    correlationId: row.correlation_id || null,
    causationId: row.causation_id || null
  });
}

module.exports = { rowToDomainEvent };
