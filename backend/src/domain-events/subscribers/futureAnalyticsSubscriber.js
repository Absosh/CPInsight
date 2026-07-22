const { DomainEventSubscriber } = require('../subscriber');

class FutureAnalyticsSubscriber extends DomainEventSubscriber {
  constructor({ priority = 1001 } = {}) {
    super({ id: 'future-analytics', eventTypes: [], priority, retry: { maxAttempts: 1 } });
  }

  async handle() {}
}

module.exports = { FutureAnalyticsSubscriber };
