const { DomainEventSubscriber } = require('../subscriber');

class DomainEventAuditSubscriber extends DomainEventSubscriber {
  constructor({ repository, priority = 30 }) {
    super({ id: 'domain-event-audit', eventTypes: ['*'], priority, retry: { maxAttempts: 1 } });
    this.repository = repository;
  }

  async handle(event) {
    await this.repository.insertAuditLog({
      event,
      subscriberId: this.id,
      action: 'event_observed',
      status: 'accepted',
      metadata: {
        source: event.source,
        eventVersion: event.eventVersion
      }
    });
  }
}

module.exports = { DomainEventAuditSubscriber };
