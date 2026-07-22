import { TelemetryEventType } from '../models/event-types.js';

const validEventTypes = new Set(Object.values(TelemetryEventType));

export class SchemaValidator {
  validateEvent(event) {
    const required = ['eventId', 'sessionId', 'platform', 'contestId', 'eventType', 'timestamp', 'pageUrl', 'metadata'];
    const missing = required.filter((field) => event?.[field] === undefined || event?.[field] === null);
    if (missing.length > 0) {
      throw new Error(`Invalid telemetry event: missing ${missing.join(', ')}`);
    }
    if (!validEventTypes.has(event.eventType)) {
      throw new Error(`Invalid telemetry event type: ${event.eventType}`);
    }
    if (event.userId !== null && typeof event.userId !== 'string') {
      throw new Error('Invalid telemetry event: userId must be a string or null');
    }
    return event;
  }

  normalizeEvent(event) {
    return {
      eventId: event.eventId,
      sessionId: event.sessionId,
      userId: event.userId || null,
      platform: event.platform,
      contestId: String(event.contestId),
      contestName: event.contestName || null,
      problemId: event.problemId || null,
      eventType: event.eventType,
      timestamp: event.timestamp,
      pageUrl: event.pageUrl,
      metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {}
    };
  }
}
