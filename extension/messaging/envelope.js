import { createId } from '../utils/id.js';
import { now } from '../utils/time.js';

export function createEnvelope({ type, source, target, providerId, correlationId, payload }) {
  return {
    id: createId('message'),
    type,
    source,
    target,
    providerId,
    correlationId,
    payload,
    createdAt: now()
  };
}

export function isEnvelope(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.source === 'string'
  );
}

export function ok(data = null) {
  return { ok: true, data };
}

export function fail(error) {
  return {
    ok: false,
    error: {
      message: error?.message || 'Unknown error',
      kind: error?.kind || 'unknown'
    }
  };
}
