const { RetrievalCache } = require('./cache/retrievalCache');
const { createDefaultAdapterRegistry } = require('./adapters/factory');
const { fuse } = require('./fusion/evidenceFusion');

function timeoutPromise(ms, source) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Retrieval source timed out: ${source}`)), ms);
  });
}

class RetrievalExecutionEngine {
  constructor({
    adapterRegistry = createDefaultAdapterRegistry(),
    cache = new RetrievalCache(),
    defaultTimeoutMs = 750,
    maxRetries = 1
  } = {}) {
    this.adapterRegistry = adapterRegistry;
    this.cache = cache;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.maxRetries = maxRetries;
  }

  async retrieveSource({ userId, plan, source, options = {}, signal = null }) {
    const adapter = this.adapterRegistry.resolve(source);
    const startedAt = Date.now();
    if (!adapter) {
      return { source: source.name, status: 'missing_adapter', evidence: [], latencyMs: 0, error: 'No adapter registered' };
    }
    if (signal && signal.aborted) return { source: source.name, status: 'cancelled', evidence: [], latencyMs: 0 };
    const cacheable = ['behavior_profiles', 'behavior_knowledge_graph', 'behavior_insights', 'contest_summaries', 'historical_aggregations', 'pattern_evolution'].includes(source.name);
    const cached = cacheable ? this.cache.get({ userId, source }) : null;
    if (cached) return { source: source.name, status: 'fulfilled', evidence: cached, latencyMs: 0, cacheHit: true };

    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        await adapter.initialize();
        const evidence = await Promise.race([
          adapter.retrieve({ userId, plan, source, options, signal }),
          timeoutPromise(adapter.timeoutMs || this.defaultTimeoutMs, source.name)
        ]);
        await adapter.destroy();
        if (cacheable) this.cache.set({ userId, source }, evidence);
        return { source: source.name, status: 'fulfilled', evidence, latencyMs: Date.now() - startedAt, attempts: attempt + 1 };
      } catch (error) {
        lastError = error;
        await adapter.destroy().catch(() => {});
      }
    }
    return {
      source: source.name,
      status: 'failed',
      evidence: [],
      latencyMs: Date.now() - startedAt,
      attempts: this.maxRetries + 1,
      error: lastError ? lastError.message : 'Unknown retrieval failure'
    };
  }

  async execute({ userId, plan, options = {}, signal = null }) {
    const startedAt = Date.now();
    const limitedSources = (plan.retrievalSources || [])
      .filter((source) => source.limit !== 0)
      .slice(0, options.maxSources || plan.retrievalSources.length);
    const retrievalResults = await Promise.all(limitedSources.map((source) => this.retrieveSource({ userId, plan, source, options, signal })));
    const packageResult = fuse({
      plan,
      retrievalResults,
      sourceHealth: this.adapterRegistry.health()
    });
    return Object.freeze({
      ...packageResult,
      statistics: {
        ...packageResult.statistics,
        retrievalLatencyMs: Date.now() - startedAt,
        cache: this.cache.stats(),
        sourceFailures: retrievalResults.filter((result) => result.status === 'failed').length,
        partialFailure: retrievalResults.some((result) => result.status !== 'fulfilled')
      }
    });
  }

  sources() {
    return this.adapterRegistry.health();
  }

  cacheStats() {
    return this.cache.stats();
  }
}

module.exports = { RetrievalExecutionEngine };

