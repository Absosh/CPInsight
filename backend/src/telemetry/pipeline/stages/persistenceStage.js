const { PipelineStage } = require('../stage');

class PersistenceStage extends PipelineStage {
  constructor({ repository }) {
    super('persistence');
    this.repository = repository;
  }

  async process(context) {
    const batchRow = await this.repository.upsertBatch({ userId: context.userId, batch: context.batch });
    const insertedEvents = [];
    for (const item of context.processableItems) {
      const rawEvent = await this.repository.insertEvent({
        userId: context.userId,
        batchRowId: batchRow.id,
        batch: context.batch,
        item
      });
      if (rawEvent) {
        insertedEvents.push(rawEvent.event_id || item.event.eventId);
        await this.repository.insertProcessedEvent({
          userId: context.userId,
          batchRowId: batchRow.id,
          rawEventId: rawEvent.id || null,
          batch: context.batch,
          item,
          requestId: context.requestId
        });
      }
    }
    return {
      ...context,
      batchRow,
      insertedEvents,
      metrics: {
        ...context.metrics,
        eventsProcessed: insertedEvents.length
      }
    };
  }
}

module.exports = { PersistenceStage };
