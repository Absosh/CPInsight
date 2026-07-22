const { DomainEventSubscriber } = require('../subscriber');

class DomainEventPersistenceSubscriber extends DomainEventSubscriber {
  constructor({ repository, priority = 10 }) {
    super({ id: 'domain-event-persistence', eventTypes: ['*'], priority, retry: { maxAttempts: 1 } });
    this.repository = repository;
  }

  async handle(event) {
    await this.repository.insertDomainEvent(event);
  }
}

module.exports = { DomainEventPersistenceSubscriber };
