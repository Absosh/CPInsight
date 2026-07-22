const { validateDomainEvent } = require('./domainEvent');

function validationMiddleware(event) {
  const validation = validateDomainEvent(event);
  if (!validation.valid) {
    const error = new Error(`Invalid domain event: ${validation.errors.join(', ')}`);
    error.code = 'INVALID_DOMAIN_EVENT';
    throw error;
  }
  return event;
}

function loggingMiddleware({ logger } = {}) {
  return (event) => {
    logger?.debug?.('Domain event published', {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId
    });
    return event;
  };
}

function tracingMiddleware(event, context) {
  context.trace = {
    correlationId: event.correlationId,
    causationId: event.causationId,
    source: event.source
  };
  return event;
}

module.exports = {
  validationMiddleware,
  loggingMiddleware,
  tracingMiddleware
};
