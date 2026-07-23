const assert = require('assert/strict');
const { RetrievalPlanner } = require('../src/ai/planner/retrievalPlanner');
const { INTENTS } = require('../src/ai/planner/intents/intentTaxonomy');
const { PlannerRule } = require('../src/ai/planner/rules/plannerRule');
const { createDefaultPlannerRuleRegistry } = require('../src/ai/planner/rules/factory');

class SyntheticRule extends PlannerRule {
  constructor() {
    super({ id: 'synthetic-planner-rule', supportedIntents: [INTENTS.EXPLORATORY], basePriority: 99 });
  }

  plan() {
    return {
      ruleId: this.id,
      intent: INTENTS.EXPLORATORY,
      evidenceTypes: ['synthetic'],
      sources: [],
      strategies: [],
      confidencePlan: {
        requiredConfidence: 0.5,
        expectedEvidenceQuality: 0,
        minimumSupportingSessions: 1,
        minimumHistoricalCoverageDays: 0,
        evidenceSufficiency: 'insufficient'
      },
      tokenBudget: {
        estimatedContextTokens: 0,
        maximumContextTokens: 6000,
        retrievalLimit: 0,
        priorityPolicy: 'highest_priority_sources_first'
      },
      estimates: {
        estimatedCost: 0,
        estimatedLatencyMs: 0
      }
    };
  }
}

async function run() {
  const planner = new RetrievalPlanner();

  const diagnostic = planner.classify('Why did my rating drop?');
  assert.equal(diagnostic.primaryIntent, INTENTS.DIAGNOSTIC);
  assert.equal(diagnostic.secondaryIntents.includes(INTENTS.HISTORICAL_REVIEW), true);

  const compare = planner.classify('Compare my last five contests');
  assert.equal(compare.primaryIntent, INTENTS.COMPARATIVE);
  assert.equal(compare.secondaryIntents.includes(INTENTS.HISTORICAL_REVIEW), true);

  const improving = planner.classify('Am I improving?');
  assert.equal(improving.primaryIntent, INTENTS.TREND_ANALYSIS);

  const practice = planner.classify('What should I practice?');
  assert.equal(practice.primaryIntent, INTENTS.COACHING);
  assert.equal(practice.secondaryIntents.includes(INTENTS.PREDICTIVE), true);

  const evidence = planner.classify('Why do you think I panic?');
  assert.equal(evidence.primaryIntent, INTENTS.EVIDENCE_REQUEST);
  assert.equal(evidence.secondaryIntents.includes(INTENTS.DIAGNOSTIC), true);

  const goal = planner.classify('Make a plan to reach expert by next year');
  assert.equal(goal.primaryIntent, INTENTS.GOAL_PLANNING);

  const unknown = await planner.plan('quasar banana entropy');
  assert.equal(unknown.intents.primary, INTENTS.UNKNOWN);
  assert.equal(unknown.confidencePlan.evidenceSufficiency, 'insufficient');

  const ambiguous = planner.classify('Why should I practice dynamic programming compared to graphs?');
  assert.equal(ambiguous.ambiguous, true);

  const diagnosticPlan = await planner.plan('Why did my rating drop?');
  assert.equal(diagnosticPlan.retrievalSources[0].name, 'behavior_knowledge_graph');
  assert.equal(diagnosticPlan.retrievalStrategies.some((strategy) => strategy.name === 'knowledge_graph_traversal'), true);
  assert.equal(diagnosticPlan.confidencePlan.requiredConfidence >= 0.85, true);
  assert.equal(diagnosticPlan.tokenBudget.estimatedContextTokens <= diagnosticPlan.tokenBudget.maximumContextTokens, true);
  assert.equal(diagnosticPlan.estimates.expectedPlannerOnly, true);

  const evidencePlan = await planner.plan('Show me the evidence for late panic');
  assert.equal(evidencePlan.retrievalSources[0].name, 'evidence_store');
  assert.equal(evidencePlan.requiredEvidence.includes('insight_evidence'), true);

  const trendPlan = await planner.plan('Am I improving over time?');
  assert.equal(trendPlan.intents.primary, INTENTS.TREND_ANALYSIS);
  assert.equal(trendPlan.retrievalStrategies.some((strategy) => strategy.name === 'trend_aggregation'), true);

  const goalPlan = await planner.plan('Plan my path to expert');
  assert.equal(goalPlan.intents.primary, INTENTS.GOAL_PLANNING);
  assert.equal(goalPlan.confidencePlan.minimumHistoricalCoverageDays >= 21, true);

  const repeatA = await planner.plan('Compare my last five contests');
  const repeatB = await planner.plan('Compare my last five contests');
  assert.deepEqual(
    {
      intents: repeatA.intents,
      sources: repeatA.retrievalSources.map((source) => source.name),
      strategies: repeatA.retrievalStrategies.map((strategy) => strategy.name),
      evidence: repeatA.requiredEvidence,
      budget: repeatA.tokenBudget
    },
    {
      intents: repeatB.intents,
      sources: repeatB.retrievalSources.map((source) => source.name),
      strategies: repeatB.retrievalStrategies.map((strategy) => strategy.name),
      evidence: repeatB.requiredEvidence,
      budget: repeatB.tokenBudget
    }
  );

  const registry = createDefaultPlannerRuleRegistry();
  registry.register(new SyntheticRule());
  assert.throws(() => registry.register(new SyntheticRule()), /Duplicate planner rule/);

  const mixed = [
    'Why did I fail the last contest?',
    'Compare my last five contests',
    'Am I improving?',
    'What should I practice?',
    'Why do you think I panic?',
    'Make a goal plan',
    'Show me something interesting',
    'Review last month',
    'Can I solve harder problems?',
    'What is my style?'
  ];
  const startedAt = Date.now();
  for (let index = 0; index < 1000; index += 1) {
    const plan = await planner.plan(mixed[index % mixed.length]);
    assert.equal(Boolean(plan.planId), true);
    assert.equal(Array.isArray(plan.retrievalSources), true);
    assert.equal(plan.tokenBudget.estimatedContextTokens <= 6000, true);
  }
  const latencyMs = Date.now() - startedAt;
  assert.equal(latencyMs < 5000, true);

  console.log(JSON.stringify({
    verdict: 'PASS',
    singleIntent: diagnostic.primaryIntent,
    multiIntent: compare.secondaryIntents,
    unknownHandled: true,
    ambiguousHandled: ambiguous.ambiguous,
    evidenceRequestPrimary: evidence.primaryIntent,
    trendStrategy: trendPlan.retrievalStrategies.map((strategy) => strategy.name),
    goalPlanningCoverageDays: goalPlan.confidencePlan.minimumHistoricalCoverageDays,
    plannerRuleRegistration: true,
    deterministicPlanning: true,
    mixedQuestions: 1000,
    latencyMs,
    sourceCount: planner.sources().length,
    strategyCount: planner.strategies().length
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

