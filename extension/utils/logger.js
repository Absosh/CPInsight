import { AppConfig } from '../config/defaults.js';

export const LogLevel = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
});

export class Logger {
  constructor(scope) {
    this.scope = scope;
  }

  debug(message, meta) {
    if (AppConfig.logging.verbose) this.write(LogLevel.DEBUG, message, meta);
  }

  info(message, meta) {
    this.write(LogLevel.INFO, message, meta);
  }

  warn(message, meta) {
    this.write(LogLevel.WARN, message, meta);
  }

  error(message, meta) {
    this.write(LogLevel.ERROR, message, meta);
  }

  write(level, message, meta) {
    const verboseScopes = new Set(['Bootstrap', 'Chain', 'StageTrace', 'Guard', 'GraphQL']);
    if (!AppConfig.debug?.verbose && verboseScopes.has(this.scope) && level !== LogLevel.ERROR && level !== LogLevel.WARN) {
      return;
    }
    const payload = [`[CPInsight:${this.scope}] ${message}`];
    if (meta !== undefined) payload.push(meta);
    const writer = level === LogLevel.ERROR ? console.error : level === LogLevel.WARN ? console.warn : console.log;
    writer(...payload);
  }
}

export function createLogger(scope) {
  return new Logger(scope);
}
