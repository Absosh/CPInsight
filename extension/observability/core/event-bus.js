import { EventPipeline } from './event-pipeline.js';

export class EventBus {
  constructor({ store, transport, logger, pipeline = new EventPipeline({ store }) } = {}) {
    this.store = store;
    this.transport = transport;
    this.logger = logger;
    this.pipeline = pipeline;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async emit(event) {
    const { event: normalized, dropped } = await this.pipeline.process(event);
    if (!normalized || dropped) return normalized;
    await this.store.appendEvent(normalized);
    await this.transport.publish(normalized);
    this.listeners.forEach((listener) => listener(normalized));
    this.logger?.info('Telemetry event emitted', {
      eventId: normalized.eventId,
      eventType: normalized.eventType,
      sessionId: normalized.sessionId
    });
    return normalized;
  }
}
