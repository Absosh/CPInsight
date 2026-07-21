import { MessageSource, MessageType } from '../constants/message-types.js';
import { createEnvelope } from '../messaging/envelope.js';
import { createLogger } from '../utils/logger.js';

const bootstrapLogger = createLogger('Bootstrap');
bootstrapLogger.info('Injected script loaded');

function emitSpaNavigation(kind) {
  bootstrapLogger.info(`SPA trigger fired: ${kind}`);
  window.postMessage(createEnvelope({
    type: MessageType.SPA_NAVIGATION,
    source: MessageSource.INJECTED,
    target: MessageSource.CONTENT,
    payload: {
      kind,
      href: window.location.href,
      pathname: window.location.pathname
    }
  }), window.location.origin);
}

function observeSpaNavigation() {
  bootstrapLogger.info('SPA observers registered');
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function cpinsightPushState() {
    const result = originalPushState.apply(this, arguments);
    emitSpaNavigation('pushState');
    return result;
  };

  window.history.replaceState = function cpinsightReplaceState() {
    const result = originalReplaceState.apply(this, arguments);
    emitSpaNavigation('replaceState');
    return result;
  };

  window.addEventListener('popstate', () => emitSpaNavigation('popstate'));
}

window.postMessage(createEnvelope({
  type: MessageType.PAGE_BRIDGE_READY,
  source: MessageSource.INJECTED,
  target: MessageSource.CONTENT,
  payload: {
    href: window.location.href,
    hasFetch: typeof window.fetch === 'function',
    hasXMLHttpRequest: typeof window.XMLHttpRequest === 'function'
  }
}), window.location.origin);
bootstrapLogger.info('Injected bridge loaded');

observeSpaNavigation();
bootstrapLogger.info('Importing page hook');
try {
  await import('../providers/leetcode/injected/page-hook.js');
  bootstrapLogger.info('Page hook loaded');
  window.postMessage(createEnvelope({
    type: MessageType.PAGE_BRIDGE_READY,
    source: MessageSource.INJECTED,
    target: MessageSource.CONTENT,
    payload: {
      href: window.location.href,
      pageHookLoaded: true
    }
  }), window.location.origin);
} catch (error) {
  bootstrapLogger.error('Module not loaded: page hook');
  bootstrapLogger.error('Stage name: Page hook import');
  bootstrapLogger.error(`Exception message: ${error?.message || 'Unknown error'}`);
  bootstrapLogger.error(`Complete stack trace: ${error?.stack || 'No stack trace available'}`);
  throw error;
}
