import { validateCollectorContract } from '../plugin-api/collector-contract.js';

export class CollectorRegistry {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.collectors = new Map();
  }

  register(collector) {
    validateCollectorContract(collector);
    if (this.collectors.has(collector.id)) {
      throw new Error(`Duplicate observability collector registered: ${collector.id}`);
    }
    this.collectors.set(collector.id, collector);
    this.logger?.info('Observability collector registered', { collectorId: collector.id });
    return collector;
  }

  async initializeAll(context = {}) {
    await Promise.all(Array.from(this.collectors.values()).map((collector) => collector.initialize(context)));
  }

  findForUrl(url) {
    return Array.from(this.collectors.values()).find((collector) => collector.supports(url)) || null;
  }

  list() {
    return Array.from(this.collectors.values());
  }
}
