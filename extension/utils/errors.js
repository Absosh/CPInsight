export const ErrorKind = Object.freeze({
  RECOVERABLE: 'recoverable',
  FATAL: 'fatal',
  NETWORK: 'network',
  AUTHENTICATION: 'authentication',
  PROVIDER: 'provider',
  STORAGE: 'storage',
  VALIDATION: 'validation'
});

export class ExtensionError extends Error {
  constructor(message, { kind = ErrorKind.RECOVERABLE, cause, metadata = {} } = {}) {
    super(message);
    this.name = 'ExtensionError';
    this.kind = kind;
    this.cause = cause;
    this.metadata = metadata;
  }
}

export function normalizeError(error, fallbackKind = ErrorKind.RECOVERABLE) {
  if (error instanceof ExtensionError) return error;
  return new ExtensionError(error?.message || 'Unexpected extension error', {
    kind: fallbackKind,
    cause: error
  });
}

export class ErrorReporter {
  constructor(logger) {
    this.logger = logger;
  }

  report(error, context = {}) {
    const normalized = normalizeError(error);
    this.logger.error(normalized.message, {
      kind: normalized.kind,
      metadata: normalized.metadata,
      context
    });
    return normalized;
  }
}
