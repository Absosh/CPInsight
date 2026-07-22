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

class DomainEventPublicationStage extends PipelineStage {
  constructor({ eventBus }) {
    super('domain-event-publication');
    this.eventBus = eventBus;
  }

  async initialize() {
    await this.eventBus?.initialize?.();
  }

  async process(context) {
    if (!this.eventBus) {
      return {
        ...context,
        domainEvents: [],
        domainDispatchResults: []
      };
    }

    const inserted = new Set(context.insertedEvents || []);
    const domainEvents = context.processableItems
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

    const domainDispatchResults = [];
    for (const domainEvent of domainEvents) {
      domainDispatchResults.push(await this.eventBus.publish(domainEvent, {
        userId: context.userId,
        batchId: context.batch.batchId,
        requestId: context.requestId
      }));
    }

    return {
      ...context,
      domainEvents,
      domainDispatchResults
    };
  }

  async shutdown() {
    await this.eventBus?.shutdown?.();
  }
}

module.exports = { DomainEventPublicationStage, toPascalCase };
