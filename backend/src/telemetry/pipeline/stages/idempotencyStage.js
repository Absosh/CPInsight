const { PipelineStage } = require('../stage');
const { TelemetryPipelineError } = require('../errors');

class IdempotencyStage extends PipelineStage {
  constructor({ repository }) {
    super('idempotency-check');
    this.repository = repository;
  }

  async process(context) {
    const eventIds = context.batch.events.map((item) => item.event.eventId);
    const existingEvents = await this.repository.findExistingEvents(eventIds);
    const conflicting = existingEvents.find((row) => row.user_id !== context.userId);
    if (conflicting) {
      throw new TelemetryPipelineError('Telemetry event id conflicts with another user', {
        code: 'EVENT_ID_CONFLICT',
        status: 409,
        category: 'idempotency',
        details: { eventId: conflicting.event_id }
      });
    }
    const duplicateEventIds = new Set(existingEvents.map((row) => String(row.event_id)));
    const newItems = context.batch.events.filter((item) => !duplicateEventIds.has(item.event.eventId));
    return {
      ...context,
      duplicateEventIds,
      processableItems: newItems,
      acknowledgedEventIds: eventIds,
      metrics: {
        ...context.metrics,
        duplicatesRemoved: duplicateEventIds.size
      }
    };
  }
}

module.exports = { IdempotencyStage };
