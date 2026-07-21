import { createEnvelope, isEnvelope } from './envelope.js';
import { MessageSource } from '../constants/message-types.js';
import { createLogger } from '../utils/logger.js';

const stageLogger = createLogger('StageTrace');

export class PageBridge {
  constructor({ providerId, targetOrigin = window.location.origin } = {}) {
    this.providerId = providerId;
    this.targetOrigin = targetOrigin;
    this.handlers = new Map();
  }

  start() {
    window.addEventListener('message', this.handleWindowMessage);
  }

  stop() {
    window.removeEventListener('message', this.handleWindowMessage);
  }

  on(type, handler) {
    this.handlers.set(type, handler);
    return () => this.handlers.delete(type);
  }

  postToPage(type, payload, correlationId) {
    const envelope = createEnvelope({
      type,
      source: MessageSource.CONTENT,
      target: MessageSource.INJECTED,
      providerId: this.providerId,
      correlationId,
      payload
    });
    stageLogger.info('window.postMessage payload', envelope.payload);
    window.postMessage(envelope, this.targetOrigin);
  }

  handleWindowMessage = (event) => {
    if (event.source !== window || !isEnvelope(event.data)) return;
    const handler = this.handlers.get(event.data.type);
    if (handler) handler(event.data, event);
  };
}
