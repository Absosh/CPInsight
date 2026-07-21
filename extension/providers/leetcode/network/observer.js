import { MessageSource, MessageType } from '../../../constants/message-types.js';
import { createEnvelope } from '../../../messaging/envelope.js';
import { LeetCodeConfig } from '../config.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('LeetCode');

function isGraphQLUrl(url) {
  try {
    const parsed = new URL(String(url), window.location.origin);
    return LeetCodeConfig.network.graphqlPaths.some((path) => parsed.pathname === path);
  } catch {
    return false;
  }
}

async function cloneResponseBody(response) {
  try {
    const text = await response.clone().text();
    return text.slice(0, LeetCodeConfig.network.maxBodyPreviewLength);
  } catch {
    return null;
  }
}

function emitNetworkEvent(payload) {
  logger.debug(`Observed GraphQL operation name: ${payload.operationName || 'unknown'}`);
  window.postMessage(createEnvelope({
    type: MessageType.NETWORK_EVENT,
    source: MessageSource.INJECTED,
    target: MessageSource.CONTENT,
    payload
  }), window.location.origin);
}

function readTextXhrResponse(xhr) {
  if (xhr.responseType !== '' && xhr.responseType !== 'text') {
    return null;
  }

  return xhr.responseText.slice(0, LeetCodeConfig.network.maxBodyPreviewLength);
}

export class LeetCodeNetworkObserver {
  constructor({ config = LeetCodeConfig.network } = {}) {
    this.config = config;
    this.originalFetch = null;
    this.originalOpen = null;
    this.originalSend = null;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    if (this.config.observeFetch) this.observeFetch();
    if (this.config.observeXHR) this.observeXHR();
  }

  stop() {
    if (this.originalFetch) window.fetch = this.originalFetch;
    if (this.originalOpen) window.XMLHttpRequest.prototype.open = this.originalOpen;
    if (this.originalSend) window.XMLHttpRequest.prototype.send = this.originalSend;
    this.started = false;
  }

  observeFetch() {
    this.originalFetch = window.fetch;
    const observer = this;
    window.fetch = async function observedFetch(input, init = {}) {
      const response = await observer.originalFetch.apply(this, arguments);
      const url = typeof input === 'string' ? input : input?.url;
      if (isGraphQLUrl(url)) {
        cloneResponseBody(response).then((body) => emitNetworkEvent({
          transport: 'fetch',
          kind: 'graphql',
          url: new URL(String(url), window.location.origin).pathname,
          status: response.status,
          operationName: tryReadOperationName(init?.body),
          responseBody: body,
          observedAt: new Date().toISOString()
        }));
      }
      return response;
    };
  }

  observeXHR() {
    const observer = this;
    this.originalOpen = window.XMLHttpRequest.prototype.open;
    this.originalSend = window.XMLHttpRequest.prototype.send;

    window.XMLHttpRequest.prototype.open = function observedOpen(method, url) {
      this.__cpinsight = { method, url };
      return observer.originalOpen.apply(this, arguments);
    };

    window.XMLHttpRequest.prototype.send = function observedSend(body) {
      const xhr = this;
      const meta = xhr.__cpinsight || {};
      xhr.addEventListener('loadend', () => {
        if (!isGraphQLUrl(meta.url)) return;
        emitNetworkEvent({
          transport: 'xhr',
          kind: 'graphql',
          url: new URL(String(meta.url), window.location.origin).pathname,
          status: xhr.status,
          operationName: tryReadOperationName(body),
          responseBody: readTextXhrResponse(xhr),
          observedAt: new Date().toISOString()
        });
      });
      return observer.originalSend.apply(this, arguments);
    };
  }
}

function tryReadOperationName(body) {
  if (!body || typeof body !== 'string') return null;
  try {
    return JSON.parse(body)?.operationName || null;
  } catch {
    return null;
  }
}
