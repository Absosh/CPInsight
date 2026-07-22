import { createId } from '../../utils/id.js';
import { SchemaValidator } from './schema-validator.js';

function createEventId() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : createId('telemetry_event');
}

function freezeEvent(event) {
  return Object.freeze({
    ...event,
    metadata: Object.freeze({ ...(event.metadata || {}) })
  });
}

export class EventPipeline {
  constructor({ store, validator = new SchemaValidator(), middlewares = [] } = {}) {
    this.store = store;
    this.validator = validator;
    this.middlewares = middlewares;
  }

  use(middleware) {
    if (typeof middleware !== 'function') {
      throw new Error('Event pipeline middleware must be a function');
    }
    this.middlewares.push(middleware);
    return () => {
      this.middlewares = this.middlewares.filter((registered) => registered !== middleware);
    };
  }

  async process(event) {
    const baseEvent = this.validator.normalizeEvent({
      eventId: event.eventId || createEventId(),
      timestamp: event.timestamp || new Date().toISOString(),
      metadata: {},
      ...event
    });
    this.validator.validateEvent(baseEvent);

    let nextEvent = baseEvent;
    for (const middleware of this.middlewares) {
      const result = await middleware(nextEvent);
      if (result === null) return { event: null, dropped: true };
      if (result !== undefined) nextEvent = result;
    }

    if (await this.store.hasEvent(nextEvent)) {
      return { event: freezeEvent(nextEvent), dropped: true };
    }

    return { event: freezeEvent(nextEvent), dropped: false };
  }
}
