const assert = require('assert/strict');
const crypto = require('crypto');
const { createDefaultInsightRuleRegistry } = require('../src/knowledge/rules/factory');
const { InsightRule } = require('../src/knowledge/rules/ruleContract');
const { insight, confidence } = require('../src/knowledge/rules/helpers');
const { KnowledgeGraphBuilder } = require('../src/knowledge/graph/graphBuilder');
const { PatternDetector } = require('../src/knowledge/patterns/patternDetector');

function feature(name, value, confidenceValue = 0.8, session = crypto.randomUUID(), createdAt = new Date().toISOString()) {
  return {
    id: crypto.randomUUID(),
    behavior_session_id: session,
    feature_name: name,
    feature_group: 'verification',
    value,
    confidence: confidenceValue,
    created_at: createdAt
  };
}

class SyntheticRule extends InsightRule {
  constructor() {
    super({ id: 'synthetic-rule', category: 'strength', version: 1 });
  }

  infer({ features }) {
    const item = features[0];
    return [insight({
      ruleId: this.id,
      insightKey: 'synthetic_knowledge',
      insightType: 'Strength',
      category: this.category,
      confidence: confidence([item]),
      features: [item],
      sessions: [item.behavior_session_id],
      relationshipType: 'HAS_STRENGTH',
      targetNode: { nodeType: 'Strength', nodeKey: 'synthetic', label: 'Synthetic Strength' },
      properties: { verification: true }
    })];
  }
}

async function infer(features, registry = createDefaultInsightRuleRegistry()) {
  const insights = [];
  for (const rule of registry.all()) {
    await rule.initialize();
    if (rule.supports({ features })) insights.push(...rule.infer({ features }));
    await rule.destroy();
  }
  return insights;
}

async function run() {
  const sessionA = crypto.randomUUID();
  const sessionB = crypto.randomUUID();
  const baseFeatures = [
    feature('average_reading_time_ms', 20 * 60 * 1000, 0.9, sessionA),
    feature('confidence_indicator', 0.2, 0.8, sessionA),
    feature('persistence_score', 0.84, 0.86, sessionA),
    feature('recovery_rate', 0.72, 0.82, sessionA),
    feature('risk_appetite', 0.82, 0.78, sessionA),
    feature('late_contest_panic', 0.48, 0.76, sessionA),
    feature('late_contest_panic', 0.52, 0.74, sessionB),
    feature('difficulty_avoidance', 0.85, 0.72, sessionA),
    feature('difficulty_avoidance', 0.9, 0.73, sessionB),
    feature('problem_scanning_speed', 0.55, 0.8, sessionA),
    feature('confidence_indicator', 0.76, 0.8, sessionB)
  ];

  const registry = createDefaultInsightRuleRegistry();
  registry.register(new SyntheticRule());
  assert.throws(() => registry.register(new SyntheticRule()), /Duplicate insight rule/);

  const insights = await infer(baseFeatures, registry);
  const keys = new Set(insights.map((item) => item.insightKey));
  for (const required of [
    'conceptual_weakness',
    'strong_recovery_ability',
    'risk_management_weakness',
    'repeated_late_panic',
    'difficulty_avoidance',
    'fast_recognition',
    'synthetic_knowledge'
  ]) {
    assert.equal(keys.has(required), true, `${required} missing`);
  }
  assert.equal(insights.every((item) => item.confidence >= 0 && item.confidence <= 1), true);

  const graph = new KnowledgeGraphBuilder().build({ userId: 'user-1', insights });
  assert.equal(graph.nodes.some((node) => node.nodeType === 'User'), true);
  assert.equal(graph.edges.length, insights.length);
  assert.equal(graph.edges.every((edge) => edge.source.nodeType === 'User'), true);

  const patterns = new PatternDetector().detect({ userId: 'user-1', insights, windowKey: 'all' });
  assert.equal(patterns.length >= 2, true);
  assert.equal(patterns.every((pattern) => pattern.confidence > 0), true);

  const contradictionFeatures = [
    feature('attention_stability', 0.9, 0.9),
    feature('late_contest_panic', 0.1, 0.9),
    feature('risk_appetite', 0.9, 0.8)
  ];
  const contradictionInsights = await infer(contradictionFeatures);
  assert.equal(contradictionInsights.some((item) => item.insightKey === 'strong_time_management'), true);
  assert.equal(contradictionInsights.some((item) => item.insightKey === 'risk_management_weakness'), false);

  const historical = [];
  for (let index = 0; index < 10; index += 1) {
    historical.push(feature('late_contest_panic', index < 5 ? 0.7 : 0.2, 0.8, crypto.randomUUID(), new Date(Date.now() + index).toISOString()));
  }
  const historicalInsights = await infer(historical);
  assert.equal(historicalInsights.some((item) => item.insightKey === 'repeated_late_panic'), true);

  const largeFeatures = [];
  for (let index = 0; index < 50000; index += 1) {
    largeFeatures.push(feature(index % 2 ? 'difficulty_avoidance' : 'late_contest_panic', index % 2 ? 0.8 : 0.4, 0.7));
  }
  const startedAt = Date.now();
  const largeInsights = await infer(largeFeatures);
  const largeLatencyMs = Date.now() - startedAt;
  assert.equal(largeInsights.length >= 2, true);
  assert.equal(largeLatencyMs < 10000, true);

  console.log(JSON.stringify({
    verdict: 'PASS',
    insightsGenerated: insights.length,
    graphNodes: graph.nodes.length,
    graphEdges: graph.edges.length,
    patternsDetected: patterns.length,
    contradictoryFeaturesHandled: true,
    historicalConsistency: true,
    largeFeatures: largeFeatures.length,
    largeLatencyMs,
    pluginRegistration: keys.has('synthetic_knowledge'),
    confidenceValid: true
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
