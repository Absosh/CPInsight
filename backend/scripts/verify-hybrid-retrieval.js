const assert = require('assert/strict');
const crypto = require('crypto');
const { RetrievalPlanner } = require('../src/ai/planner/retrievalPlanner');
const { RetrievalExecutionEngine } = require('../src/ai/retrieval/executionEngine');
const { AdapterRegistry } = require('../src/ai/retrieval/adapters/registry');
const { SourceAdapter } = require('../src/ai/retrieval/adapters/sourceAdapter');
const { RetrievalCache } = require('../src/ai/retrieval/cache/retrievalCache');

function evidence(source, index, overrides = {}) {
  const created = new Date(Date.now() - index * 1000).toISOString();
  return {
    evidenceId: `${source}:${overrides.identifier || index}`,
    source,
    type: overrides.type || source,
    identifier: String(overrides.identifier || index),
    confidence: overrides.confidence ?? 0.75,
    timestamp: overrides.timestamp || created,
    version: overrides.version || 1,
    distance: overrides.distance || 1,
    payload: overrides.payload || { id: `${source}-${index}`, value: index / 100 },
    references: { verification: true }
  };
}

class MockAdapter extends SourceAdapter {
  constructor({ name, count = 3, delayMs = 0, fail = false, reliability = 0.8 }) {
    super({ name, reliability, timeoutMs: 80 });
    this.count = count;
    this.delayMs = delayMs;
    this.fail = fail;
    this.calls = 0;
  }

  async retrieve() {
    this.calls += 1;
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    if (this.fail) throw new Error(`Synthetic failure from ${this.name}`);
    const rows = [];
    for (let index = 0; index < this.count; index += 1) {
      rows.push(evidence(this.name, index, {
        confidence: 0.65 + (index % 3) * 0.1,
        payload: { id: `${this.name}-${index}`, feature_name: index % 2 ? 'risk_appetite' : 'focus_stability', value: index % 2 ? 0.9 : 0.85 }
      }));
    }
    return rows;
  }
}

class ContradictingAdapter extends SourceAdapter {
  constructor(name) {
    super({ name, reliability: 0.7, timeoutMs: 80 });
  }

  async retrieve() {
    return [
      evidence(this.name, 1, { identifier: 'conflict-high', confidence: 0.84, payload: { id: 'high', feature_name: 'late_panic', value: 0.91 } }),
      evidence(this.name, 2, { identifier: 'conflict-low', confidence: 0.82, payload: { id: 'low', feature_name: 'late_panic', value: 0.1 } })
    ];
  }
}

function registryWithMocks({ includeFailure = false, includeTimeout = false } = {}) {
  const registry = new AdapterRegistry();
  [
    new MockAdapter({ name: 'behavior_knowledge_graph', count: 4, reliability: 0.92 }),
    new MockAdapter({ name: 'behavior_insights', count: 4, reliability: 0.88 }),
    new ContradictingAdapter('evidence_store'),
    new MockAdapter({ name: 'contest_history', count: 3, reliability: 0.76 }),
    new MockAdapter({ name: 'session_summaries', count: 3, reliability: 0.82 }),
    new MockAdapter({ name: 'feature_versions', count: 1, reliability: 0.8 }),
    new MockAdapter({ name: 'contest_summaries', count: 5, reliability: 0.76 }),
    new MockAdapter({ name: 'historical_aggregations', count: 6, reliability: 0.81 }),
    new MockAdapter({ name: 'behavior_features', count: 30, reliability: 0.82 }),
    new MockAdapter({ name: 'topic_performance', count: 8, reliability: 0.75 }),
    new MockAdapter({ name: 'platform_statistics', count: 3, reliability: 0.74 }),
    new MockAdapter({ name: 'behavior_profiles', count: 1, reliability: 0.86 }),
    new MockAdapter({ name: 'user_metadata', count: 1, reliability: 0.72 }),
    new MockAdapter({ name: 'pattern_evolution', count: 3, reliability: 0.84 }),
    new MockAdapter({ name: 'future_vector_store', count: 0, reliability: 0 }),
    new MockAdapter({ name: 'future_conversation_memory', count: 0, reliability: 0 })
  ].forEach((adapter) => registry.register(adapter));
  if (includeFailure) registry.adapters.set('behavior_insights', new MockAdapter({ name: 'behavior_insights', fail: true }));
  if (includeTimeout) registry.adapters.set('contest_history', new MockAdapter({ name: 'contest_history', delayMs: 200 }));
  return registry;
}

function stableView(pkg) {
  return {
    planId: pkg.planId,
    questionHash: pkg.questionHash,
    sources: pkg.retrievedSources.map((source) => ({ source: source.source, status: source.status, evidenceCount: source.evidenceCount })),
    evidence: pkg.evidence.map((item) => ({ source: item.source, type: item.type, identifier: item.identifier, rankScore: item.rankScore })),
    contradictions: pkg.contradictions.map((item) => ({ type: item.type, key: item.key, severity: item.severity })),
    missing: pkg.missingEvidence,
    confidence: pkg.confidenceSummary
  };
}

async function run() {
  const planner = new RetrievalPlanner();
  const plan = await planner.plan('Why do you think I panic?');
  const cache = new RetrievalCache({ ttlMs: 60000 });
  const engine = new RetrievalExecutionEngine({ adapterRegistry: registryWithMocks(), cache, maxRetries: 1 });
  const userId = crypto.randomUUID();

  const firstPackage = await engine.execute({ userId, plan });
  assert.equal(firstPackage.retrievedSources.length > 0, true);
  assert.equal(firstPackage.evidence.length > 0, true);
  assert.equal(firstPackage.contradictions.length >= 1, true);
  assert.equal(firstPackage.evidence.every((item, index, rows) => index === 0 || rows[index - 1].rankScore >= item.rankScore), true);
  assert.equal(Object.isFrozen(firstPackage), true);
  assert.equal(firstPackage.statistics.partialFailure, false);

  const secondPackage = await engine.execute({ userId, plan });
  assert.equal(secondPackage.statistics.cache.hits > 0, true);

  const failingEngine = new RetrievalExecutionEngine({ adapterRegistry: registryWithMocks({ includeFailure: true }), cache: new RetrievalCache(), maxRetries: 1 });
  const partial = await failingEngine.execute({ userId, plan });
  assert.equal(partial.statistics.partialFailure, true);
  assert.equal(partial.retrievedSources.some((source) => source.status === 'failed'), true);
  assert.equal(partial.evidence.length > 0, true);

  const timeoutEngine = new RetrievalExecutionEngine({ adapterRegistry: registryWithMocks({ includeTimeout: true }), cache: new RetrievalCache(), maxRetries: 0 });
  const timeoutPackage = await timeoutEngine.execute({ userId, plan });
  assert.equal(timeoutPackage.retrievedSources.some((source) => source.status === 'failed' && /timed out/.test(source.error)), true);

  const largePlan = await planner.plan('Compare my last five contests');
  const largeEngine = new RetrievalExecutionEngine({ adapterRegistry: registryWithMocks(), cache: new RetrievalCache() });
  const largeStartedAt = Date.now();
  for (let index = 0; index < 1000; index += 1) {
    const pkg = await largeEngine.execute({ userId, plan: index % 2 ? plan : largePlan });
    assert.equal(Boolean(pkg.packageId), true);
    assert.equal(pkg.statistics.retrievalLatencyMs < 1000, true);
  }
  const largeLatencyMs = Date.now() - largeStartedAt;
  assert.equal(largeLatencyMs < 10000, true);

  const deterministicA = stableView(await engine.execute({ userId, plan }));
  const deterministicB = stableView(await engine.execute({ userId, plan }));
  assert.deepEqual(deterministicA.sources, deterministicB.sources);
  assert.deepEqual(deterministicA.evidence, deterministicB.evidence);
  assert.deepEqual(deterministicA.contradictions, deterministicB.contradictions);

  console.log(JSON.stringify({
    verdict: 'PASS',
    retrievedSources: firstPackage.retrievedSources.length,
    evidenceCount: firstPackage.evidence.length,
    contradictionCount: firstPackage.contradictions.length,
    cacheHitRate: secondPackage.statistics.cache.hitRate,
    partialFailureHandled: partial.statistics.partialFailure,
    timeoutHandled: true,
    deterministicPackages: true,
    mixedRetrievalPlans: 1000,
    largeLatencyMs,
    packageImmutable: Object.isFrozen(firstPackage),
    sourceHealthCount: engine.sources().length
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

