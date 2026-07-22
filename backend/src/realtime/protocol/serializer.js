const crypto = require('crypto');

const REALTIME_MESSAGE_VERSION = 1;

function freezeJson(value) {
  if (!value || typeof value !== 'object') return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeJson(child);
  return value;
}

function serializeMessage({
  messageType,
  occurredAt,
  publishedAt = new Date().toISOString(),
  payload = {},
  metadata = {},
  sequenceNumber = 0,
  messageId = crypto.randomUUID(),
  eventVersion = REALTIME_MESSAGE_VERSION
}) {
  return JSON.stringify(freezeJson({
    messageId,
    messageType,
    eventVersion,
    occurredAt: occurredAt || publishedAt,
    publishedAt,
    payload,
    metadata,
    sequenceNumber
  }));
}

function domainEventToMessage(event, sequenceNumber) {
  return serializeMessage({
    messageType: 'EVENT',
    eventVersion: event.eventVersion,
    occurredAt: event.occurredAt,
    publishedAt: new Date().toISOString(),
    payload: event.payload,
    metadata: {
      ...event.metadata,
      domainEventId: event.eventId,
      domainEventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      source: event.source
    },
    sequenceNumber
  });
}

module.exports = {
  REALTIME_MESSAGE_VERSION,
  serializeMessage,
  domainEventToMessage
};
