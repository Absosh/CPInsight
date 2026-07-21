import { ExtensionError, ErrorKind } from '../../../utils/errors.js';

export function asObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ExtensionError(`Expected ${name} to be an object`, {
      kind: ErrorKind.VALIDATION,
      metadata: { name }
    });
  }
  return value;
}

export function optionalArray(value) {
  return Array.isArray(value) ? value : [];
}

export function optionalObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function optionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseJsonObject(value, fallback = null) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}
