const { PipelineStage } = require('../stage');
const { createDomainEvent } = require('../../../domain-events/domainEvent');

function toPascalCase(eventType) {
  return eventType
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

class OutboxPublicationStage extends PipelineStage {
  constructor({ outboxRepository }) {
    super('outbox-publication');
    this.outboxRepository = outboxRepository;
  }

  async process(context) {
    if (!this.outboxRepository) {
      return {
        ...context,
        outboxEvents: []
      };
    }

    const inserted = new Set(context.insertedEvents || []);
    const outboxEvents = context.processableItems
      .filter((item) => inserted.has(item.event.eventId))
      .map((item) => createDomainEvent({
        eventType: toPascalCase(item.event.eventType),
        occurredAt: item.normalizedTimestamp,
        aggregateType: 'TelemetrySession',
        aggregateId: item.event.sessionId,
        source: 'telemetry.pipeline',
        payload: {
          telemetryEventId: item.event.eventId,
          sessionId: item.event.sessionId,
          platform: item.event.platform,
          contestId: item.event.contestId,
          contestName: item.event.contestName || null,
          problemId: item.event.problemId || null,
          eventType: item.event.eventType,
          classification: item.classification.category
        },
        metadata: {
          userId: context.userId,
          batchId: context.batch.batchId,
          requestId: context.requestId,
          sequenceNumber: item.sequenceNumber,
          sdkVersion: context.batch.sdkVersion,
          schemaVersion: context.batch.schemaVersion,
          collectorVersion: context.batch.collectorVersion,
          receivedAt: item.processed.receivedAt,
          ingestedAt: item.processed.ingestedAt
        },
        correlationId: context.requestId,
        causationId: item.event.eventId
      }));

    const persistedOutboxEvents = [];
    for (const event of outboxEvents) {
      const row = await this.outboxRepository.insert(event);
      if (row) persistedOutboxEvents.push(row);
    }

    return {
      ...context,
      outboxEvents,
      persistedOutboxEvents
    };
  }
}

module.exports = { OutboxPublicationStage, toPascalCase };
