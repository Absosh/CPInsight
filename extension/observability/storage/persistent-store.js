import { StorageKey } from '../../constants/storage-keys.js';
import { ObservabilityRuntimeConfig } from '../config/runtime-config.js';

export class PersistentStore {
  constructor({ storage, logger, config = ObservabilityRuntimeConfig } = {}) {
    this.storage = storage;
    this.logger = logger;
    this.config = config;
    this.writeLock = Promise.resolve();
  }

  async withWriteLock(operation) {
    const previous = this.writeLock;
    let release;
    this.writeLock = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  async recoverShape(key, fallback, validator) {
    const value = await this.storage.get(key, fallback);
    if (validator(value)) return value;
    this.logger?.warn('Recovering corrupted observability storage shape', { key });
    await this.storage.set(key, fallback);
    return fallback;
  }

  async ensureReady() {
    const metadata = await this.recoverShape(StorageKey.OBSERVABILITY_METADATA, {}, (value) => this.isPlainObject(value));
    if (metadata.schemaVersion === this.config.schemaVersion) return metadata;
    const nextMetadata = {
      ...metadata,
      schemaVersion: this.config.schemaVersion,
      migratedAt: new Date().toISOString()
    };
    await this.storage.set(StorageKey.OBSERVABILITY_METADATA, nextMetadata);
    return nextMetadata;
  }

  async getSessions() {
    return this.recoverShape(StorageKey.OBSERVABILITY_SESSIONS, {}, (value) => this.isPlainObject(value));
  }

  async saveSessions(sessions) {
    return this.storage.set(StorageKey.OBSERVABILITY_SESSIONS, sessions);
  }

  async getSession(sessionKey) {
    const sessions = await this.getSessions();
    return sessions[sessionKey] || null;
  }

  async upsertSession(session) {
    return this.withWriteLock(async () => {
      const sessions = await this.getSessions();
      const existing = sessions[session.sessionKey];
      if (existing?.sessionId === session.sessionId) {
        session = {
          ...session,
          tabIds: Array.from(new Set([...(existing.tabIds || []), ...(session.tabIds || [])])),
          stateHistory: session.stateHistory?.length >= (existing.stateHistory?.length || 0)
            ? session.stateHistory
            : existing.stateHistory
        };
      }
      sessions[session.sessionKey] = session;
      await this.saveSessions(sessions);
      return session;
    });
  }

  async replaceSession(session) {
    return this.withWriteLock(async () => {
      const sessions = await this.getSessions();
      sessions[session.sessionKey] = session;
      await this.saveSessions(sessions);
      return session;
    });
  }

  async getTabIndex() {
    return this.recoverShape(StorageKey.OBSERVABILITY_TAB_INDEX, {}, (value) => this.isPlainObject(value));
  }

  async saveTabIndex(tabIndex) {
    return this.storage.set(StorageKey.OBSERVABILITY_TAB_INDEX, tabIndex);
  }

  async assignTab(tabId, value) {
    return this.withWriteLock(async () => {
      const tabIndex = await this.getTabIndex();
      tabIndex[String(tabId)] = value;
      await this.saveTabIndex(tabIndex);
      return value;
    });
  }

  async removeTab(tabId) {
    return this.withWriteLock(async () => {
      const tabKey = String(tabId);
      const tabIndex = await this.getTabIndex();
      const linked = tabIndex[tabKey] || null;
      delete tabIndex[tabKey];
      await this.saveTabIndex(tabIndex);
      return linked;
    });
  }

  async getEvents() {
    return this.recoverShape(StorageKey.OBSERVABILITY_EVENTS, [], Array.isArray);
  }

  async appendEvent(event) {
    return this.withWriteLock(async () => {
      const events = await this.getEvents();
      if (this.containsEvent(events, event)) return event;
      const nextEvents = [...events, event].slice(-this.config.maxStoredEvents);
      await this.storage.set(StorageKey.OBSERVABILITY_EVENTS, nextEvents);
      return event;
    });
  }

  async getQueue() {
    return this.recoverShape(StorageKey.OBSERVABILITY_QUEUE, [], Array.isArray);
  }

  async saveQueue(queue) {
    return this.storage.set(StorageKey.OBSERVABILITY_QUEUE, queue);
  }

  async enqueue(event) {
    return this.withWriteLock(async () => {
      const queue = await this.getQueue();
      if (this.containsEvent(queue, event)) return event;
      const nextQueue = [...queue, event].slice(-this.config.maxQueuedEvents);
      await this.storage.set(StorageKey.OBSERVABILITY_QUEUE, nextQueue);
      return event;
    });
  }

  async replaceQueue(queue) {
    return this.withWriteLock(async () => this.saveQueue(queue));
  }

  async updateQueue(mutator) {
    return this.withWriteLock(async () => {
      const queue = await this.getQueue();
      const nextQueue = await mutator(queue);
      await this.saveQueue(nextQueue);
      return nextQueue;
    });
  }

  async removeAcknowledgedEvents(eventIds) {
    const acknowledged = new Set(eventIds || []);
    if (acknowledged.size === 0) return this.getQueue();
    return this.withWriteLock(async () => {
      const queue = await this.getQueue();
      const nextQueue = queue.filter((entry) => !acknowledged.has(entry.eventId || entry.event?.eventId));
      await this.saveQueue(nextQueue);
      return nextQueue;
    });
  }

  async hasEvent(event) {
    return this.containsEvent(await this.getEvents(), event);
  }

  containsEvent(events, event) {
    const dedupeKey = event?.metadata?.dedupeKey || null;
    return events.some((stored) =>
      stored.eventId === event.eventId ||
      (dedupeKey && stored.metadata?.dedupeKey === dedupeKey)
    );
  }
}
