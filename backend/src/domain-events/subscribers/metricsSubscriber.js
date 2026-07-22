const { DomainEventSubscriber } = require('../subscriber');

class DomainEventMetricsSubscriber extends DomainEventSubscriber {
  constructor({ repository, priority = 20 }) {
    super({ id: 'domain-event-metrics', eventTypes: [], priority, retry: { maxAttempts: 1 } });
    this.repository = repository;
  }

  async handle() {}

  async recordPublish({ event, subscriberResults, durationMs }) {
    await this.repository.insertDispatchMetric({
      event,
      subscriberResults,
      durationMs
    });
  }
}

module.exports = { DomainEventMetricsSubscriber };
