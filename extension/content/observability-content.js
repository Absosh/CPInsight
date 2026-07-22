import { MessageSource, MessageType } from '../constants/message-types.js';
import { createEnvelope } from '../messaging/envelope.js';
import { CollectorRegistry } from '../observability/core/collector-registry.js';
import { ObservabilityRuntimeConfig } from '../observability/config/runtime-config.js';
import { observabilityCollectors } from '../observability/platforms/index.js';
import { navigationType } from '../observability/platforms/shared/dom-utils.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ObservabilityContent');
const registry = new CollectorRegistry({ logger });
let activeCollector = null;
let destroyed = false;
const disposers = [];

observabilityCollectors.forEach((collector) => registry.register(collector));
await registry.initializeAll({ runtime: 'content' });

function resolveCollector() {
  activeCollector = registry.findForUrl(window.location.href);
  return activeCollector;
}

function sendSnapshot(trigger) {
  if (destroyed) return Promise.resolve(null);
  const collector = resolveCollector();
  if (!collector) {
    return sendPageExit(trigger, 'unsupported_url');
  }
  let pageContext;
  try {
    pageContext = collector.collect({
      url: window.location.href,
      documentRef: document,
      performanceRef: performance,
      visibilityState: document.visibilityState
    });
  } catch (error) {
    pageContext = {
      platform: collector.platform,
      kind: 'unsupported',
      metadata: {
        collectorError: error?.message || 'Collector failed'
      }
    };
  }
  return chrome.runtime.sendMessage(createEnvelope({
    type: MessageType.OBSERVABILITY_PAGE_SNAPSHOT,
    source: MessageSource.CONTENT,
    target: MessageSource.BACKGROUND,
    providerId: collector.id,
    payload: {
      collectorId: collector.id,
      schemaVersion: ObservabilityRuntimeConfig.schemaVersion,
      source: 'content_script',
      trigger,
      url: window.location.href,
      pageUrl: window.location.href,
      visibilityState: document.visibilityState,
      navigationType: navigationType(performance),
      pageContext
    }
  })).catch((error) => {
    logger.warn('Observability snapshot send failed', { reason: error?.message || 'unknown' });
    return null;
  });
}

function sendPageExit(trigger, reason) {
  return chrome.runtime.sendMessage(createEnvelope({
    type: MessageType.OBSERVABILITY_PAGE_EXIT,
    source: MessageSource.CONTENT,
    target: MessageSource.BACKGROUND,
    providerId: activeCollector?.id || 'observability',
    payload: {
      trigger,
      reason,
      url: window.location.href
    }
  })).catch(() => null);
}

function observeHistory() {
  const notify = () => queueMicrotask(() => sendSnapshot('history_navigation'));
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    notify();
    return result;
  };
  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    notify();
    return result;
  };
  window.addEventListener('popstate', notify);
  disposers.push(() => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', notify);
  });
}

function destroyCollectors() {
  registry.list().forEach((collector) => collector.destroy());
}

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    activeCollector?.pause();
  } else {
    activeCollector?.resume();
  }
  sendSnapshot('visibilitychange');
};
const handlePageHide = () => {
  destroyed = true;
  disposers.splice(0).forEach((dispose) => dispose());
  destroyCollectors();
  sendPageExit('pagehide', 'page_unloaded');
};
const handlePageShow = (event) => sendSnapshot(event.persisted ? 'bfcache_restore' : 'pageshow');

document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('pagehide', handlePageHide);
window.addEventListener('pageshow', handlePageShow);
disposers.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange));
disposers.push(() => window.removeEventListener('pagehide', handlePageHide));
disposers.push(() => window.removeEventListener('pageshow', handlePageShow));
observeHistory();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => sendSnapshot('dom_content_loaded'), { once: true });
} else {
  sendSnapshot('document_ready');
}
