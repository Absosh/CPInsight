import { createEnvelope, fail, isEnvelope, ok } from './envelope.js';
import { MessageSource } from '../constants/message-types.js';
import { normalizeError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const transportLogger = createLogger('Transport');

export class MessageBus {
  constructor({ source = MessageSource.BACKGROUND, logger, errorReporter } = {}) {
    this.source = source;
    this.logger = logger;
    this.errorReporter = errorReporter;
    this.handlers = new Map();
  }

  register(type, handler) {
    this.handlers.set(type, handler);
    return () => this.handlers.delete(type);
  }

  listenRuntime() {
    transportLogger.info('Background runtime onMessage listener registered');
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      transportLogger.info('Background onMessage entered');
      transportLogger.info('Background onMessage raw message', message);
      transportLogger.info('Background onMessage sender', {
        tabId: sender?.tab?.id || null,
        url: sender?.url || sender?.tab?.url || null,
        id: sender?.id || null
      });
      this.handleIncoming(message, sender)
        .then(sendResponse)
        .catch((error) => {
          transportLogger.error('Background onMessage handler rejected');
          transportLogger.error(`Exception message: ${error?.message || 'Unknown error'}`);
          transportLogger.error(`Complete stack trace: ${error?.stack || 'No stack trace available'}`);
          sendResponse(fail(normalizeError(error)));
        });
      return true;
    });
  }

  async handleIncoming(message, sender = null) {
    if (!isEnvelope(message)) {
      transportLogger.info('Background message rejected before handler: invalid envelope');
      transportLogger.info('Invalid envelope values', {
        hasMessage: Boolean(message),
        id: message?.id,
        type: message?.type,
        source: message?.source,
        target: message?.target,
        providerId: message?.providerId
      });
      return fail(new Error('Invalid message envelope'));
    }

    const handler = this.handlers.get(message.type);
    if (!handler) {
      transportLogger.info(`Background message returned early: no handler registered for type=${message.type}`);
      this.logger?.debug('No message handler registered', { type: message.type });
      return ok(null);
    }

    try {
      return ok(await handler(message, sender));
    } catch (error) {
      const normalized = this.errorReporter?.report(error, { message }) || normalizeError(error);
      return fail(normalized);
    }
  }

  sendRuntime({ type, target, providerId, payload }) {
    return chrome.runtime.sendMessage(createEnvelope({
      type,
      source: this.source,
      target,
      providerId,
      payload
    }));
  }

  sendTab(tabId, { type, target, providerId, payload }) {
    return chrome.tabs.sendMessage(tabId, createEnvelope({
      type,
      source: this.source,
      target,
      providerId,
      payload
    }));
  }
}
