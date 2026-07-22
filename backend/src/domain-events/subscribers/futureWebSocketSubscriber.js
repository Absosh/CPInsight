const { DomainEventSubscriber } = require('../subscriber');

class FutureWebSocketSubscriber extends DomainEventSubscriber {
  constructor({ priority = 1000 } = {}) {
    super({ id: 'future-websocket-gateway', eventTypes: [], priority, retry: { maxAttempts: 1 } });
  }

  async handle() {}
}

module.exports = { FutureWebSocketSubscriber };
