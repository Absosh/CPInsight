import { CollectorRegistry } from './collector-registry.js';
import { EventBus } from './event-bus.js';
import { LifecycleManager } from './lifecycle-manager.js';
import { SessionEngine } from './session-engine.js';
import { PersistentStore } from '../storage/persistent-store.js';
import { QueuedTransport } from '../transport/queued-transport.js';

export class ObservabilitySDK {
  constructor({ storage, logger, config } = {}) {
    this.logger = logger;
    this.registry = new CollectorRegistry({ logger });
    this.store = new PersistentStore({ storage, logger, config });
    this.transport = new QueuedTransport({ store: this.store, logger });
    this.eventBus = new EventBus({ store: this.store, transport: this.transport, logger });
    this.lifecycleManager = new LifecycleManager({ logger });
    this.sessionEngine = new SessionEngine({
      store: this.store,
      eventBus: this.eventBus,
      lifecycleManager: this.lifecycleManager,
      logger
    });
  }

  registerCollector(collector) {
    return this.registry.register(collector);
  }

  async initialize(context = {}) {
    await this.store.ensureReady();
    await this.initializeCollectors(context);
  }

  initializeCollectors(context = {}) {
    return this.registry.initializeAll(context);
  }

  handlePageSnapshot(snapshot) {
    return this.sessionEngine.handlePageSnapshot(snapshot);
  }

  handlePageExit({ tabId, url, reason }) {
    return this.sessionEngine.detachTab(tabId, url, reason);
  }

  handleTabClosed(tabId) {
    return this.sessionEngine.handleTabClosed(tabId);
  }

  recoverUnfinishedSessions(reason) {
    return this.sessionEngine.recoverUnfinishedSessions(reason);
  }
}
