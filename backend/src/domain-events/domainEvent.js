const crypto = require('crypto');

const DOMAIN_EVENT_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function freezeJson(value) {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const child of Object.values(value)) {
    freezeJson(child);
  }
  return value;
}

function createDomainEvent({
  eventType,
  eventVersion = DOMAIN_EVENT_VERSION,
  occurredAt,
  aggregateType,
  aggregateId,
  source,
  payload = {},
  metadata = {},
  correlationId = null,
  causationId = null,
  eventId = crypto.randomUUID(),
  publishedAt = nowIso()
}) {
  const event = {
    eventId,
    eventType,
    eventVersion,
    occurredAt: occurredAt || publishedAt,
    publishedAt,
    aggregateType,
    aggregateId,
    source,
    payload,
    metadata,
    correlationId,
    causationId
  };
  return freezeJson(event);
}

function isIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateDomainEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object') errors.push('event must be an object');
  if (event && !isUuid(event.eventId)) errors.push('eventId must be a UUID');
  if (event && typeof event.eventType !== 'string') errors.push('eventType must be a string');
  if (event && !Number.isInteger(event.eventVersion)) errors.push('eventVersion must be an integer');
  if (event && !isIsoDate(event.occurredAt)) errors.push('occurredAt must be an ISO timestamp');
  if (event && !isIsoDate(event.publishedAt)) errors.push('publishedAt must be an ISO timestamp');
  if (event && typeof event.aggregateType !== 'string') errors.push('aggregateType must be a string');
  if (event && typeof event.aggregateId !== 'string') errors.push('aggregateId must be a string');
  if (event && typeof event.source !== 'string') errors.push('source must be a string');
  if (event && (event.payload === null || typeof event.payload !== 'object')) errors.push('payload must be an object');
  if (event && (event.metadata === null || typeof event.metadata !== 'object')) errors.push('metadata must be an object');
  if (event && event.correlationId !== null && !isUuid(event.correlationId)) {
    errors.push('correlationId must be a UUID when provided');
  }
  if (event && event.causationId !== null && !isUuid(event.causationId)) {
    errors.push('causationId must be a UUID when provided');
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  DOMAIN_EVENT_VERSION,
  createDomainEvent,
  validateDomainEvent
};
