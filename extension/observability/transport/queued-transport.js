export class QueuedTransport {
  constructor({ store, logger } = {}) {
    this.store = store;
    this.logger = logger;
  }

  async publish(event) {
    await this.store.enqueue(event);
    this.logger?.debug('Telemetry event queued for future transport', {
      eventId: event.eventId,
      eventType: event.eventType
    });
    return { queued: true };
  }
}
