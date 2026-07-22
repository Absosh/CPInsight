const { DomainEventSubscriber } = require('../subscriber');

class RedisPublisherSubscriber extends DomainEventSubscriber {
  constructor({ publisher, priority = 200 }) {
    super({
      id: 'redis-event-publisher',
      eventTypes: ['*'],
      priority,
      retry: { maxAttempts: 2, baseDelayMs: 25 }
    });
    this.publisher = publisher;
  }

  async handle(event) {
    await this.publisher.publish(event);
  }
}

module.exports = { RedisPublisherSubscriber };
