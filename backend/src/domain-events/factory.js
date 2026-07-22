const domainEventRepository = require('./repository');
const { DomainEventBus } = require('./eventBus');
const { validationMiddleware, loggingMiddleware, tracingMiddleware } = require('./middleware');
const { DomainEventPersistenceSubscriber } = require('./subscribers/persistenceSubscriber');
const { DomainEventMetricsSubscriber } = require('./subscribers/metricsSubscriber');
const { DomainEventAuditSubscriber } = require('./subscribers/auditSubscriber');
const { FutureWebSocketSubscriber } = require('./subscribers/futureWebSocketSubscriber');
const { FutureAnalyticsSubscriber } = require('./subscribers/futureAnalyticsSubscriber');
const { RedisPublisherSubscriber } = require('./subscribers/redisPublisherSubscriber');

function createDomainEventBus({ repository = domainEventRepository, logger = null, redisPublisher = null } = {}) {
  const metricsSubscriber = new DomainEventMetricsSubscriber({ repository });
  const bus = new DomainEventBus({
    logger,
    metricsSink: metricsSubscriber,
    deadLetterSink: {
      record: ({ event, failure }) => repository.insertSubscriberFailure({ event, failure })
    },
    middleware: [
      validationMiddleware,
      tracingMiddleware,
      loggingMiddleware({ logger })
    ]
  });

  bus.subscribe(new DomainEventPersistenceSubscriber({ repository }));
  bus.subscribe(metricsSubscriber);
  bus.subscribe(new DomainEventAuditSubscriber({ repository }));
  if (redisPublisher) {
    bus.subscribe(new RedisPublisherSubscriber({ publisher: redisPublisher }));
  }
  bus.subscribe(new FutureWebSocketSubscriber());
  bus.subscribe(new FutureAnalyticsSubscriber());
  return bus;
}

module.exports = { createDomainEventBus };
