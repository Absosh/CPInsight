class DomainEventSubscriber {
  constructor({ id, eventTypes = ['*'], priority = 100, retry = {} }) {
    if (!id) throw new Error('Domain event subscriber id is required');
    this.id = id;
    this.eventTypes = eventTypes;
    this.priority = priority;
    this.retry = {
      maxAttempts: retry.maxAttempts || 1,
      baseDelayMs: retry.baseDelayMs || 0
    };
  }

  supports(event) {
    return this.eventTypes.includes('*') || this.eventTypes.includes(event.eventType);
  }

  async initialize() {}

  async handle() {
    throw new Error(`${this.id} must implement handle(event, context)`);
  }

  async shutdown() {}
}

module.exports = { DomainEventSubscriber };
