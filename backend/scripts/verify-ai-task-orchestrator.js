const assert = require('assert/strict');
const crypto = require('crypto');
const { AITaskOrchestrator } = require('../src/ai/tasks/taskOrchestrator');
const { AITask } = require('../src/ai/tasks/registry/aiTask');
const { createDefaultAITaskRegistry } = require('../src/ai/tasks/registry/factory');

function reasoningContext(overrides = {}) {
  return {
    contextId: crypto.randomUUID(),
    questionHash: crypto.createHash('sha256').update('question').digest('hex'),
    confidence: overrides.confidence ?? 0.82,
    primaryFindings: [{ findingId: 'f1', conceptId: 'panic', confidence: 0.85, evidenceIds: ['e1'] }],
    secondaryFindings: [{ findingId: 'f2', conceptId: 'time_allocation', confidence: 0.78, evidenceIds: ['e2'] }],
    contradictions: overrides.contradictions || [],
    missingEvidence: overrides.missingEvidence || [],
    historicalComparison: { available: Boolean(overrides.historical) }
  };
}

function promptPackage(context) {
  return {
    promptPackageId: crypto.randomUUID(),
    reasoningContext: context,
    supportedProviders: [{ name: 'openai' }],
    providerIndependent: true,
    groundingRules: { neverInventEvidence: true },
    citationRules: { required: true }
  };
}

function stablePlan(plan) {
  return {
    primaryTask: plan.routing.primaryTask,
    taskChain: plan.routing.taskChain,
    reasoningModes: plan.reasoningModes,
    strategies: plan.promptStrategies.map((strategy) => strategy.strategyId),
    schemas: plan.outputSchemas.map((schema) => schema.name),
    evaluation: plan.evaluationRules.map((policy) => policy.taskType),
    safetyCount: plan.safetyConstraints.length
  };
}

async function run() {
  const orchestrator = new AITaskOrchestrator();
  const context = reasoningContext({ historical: true });
  const prompt = promptPackage(context);

  const diagnostic = await orchestrator.plan({
    question: 'Why did my rating drop?',
    intent: { primary: 'diagnostic', secondary: ['historical_review'], confidence: 0.8 },
    reasoningContext: context,
    promptPackage: prompt
  });
  assert.equal(diagnostic.routing.primaryTask, 'diagnostic');
  assert.equal(diagnostic.routing.taskChain.includes('historical_review'), true);
  assert.equal(diagnostic.tasks[0].responseSchema.schema.problem, 'string');
  assert.equal(diagnostic.safetyConstraints.some((policy) => policy.rules.includes('Never fabricate evidence.')), true);
  assert.equal(diagnostic.evaluationRules.some((rule) => rule.checks.includes('evidence_coverage')), true);
  assert.equal(diagnostic.executionMetadata.noLLMInvocation, true);

  const coaching = await orchestrator.plan({
    question: 'What should I practice next?',
    intent: { primary: 'coaching', secondary: ['predictive'], confidence: 0.76 },
    reasoningContext: context,
    promptPackage: prompt
  });
  assert.equal(coaching.routing.primaryTask, 'coaching');
  assert.equal(coaching.routing.taskChain.includes('recommendation'), true);
  assert.equal(coaching.promptStrategies.some((strategy) => strategy.strategyId === 'recommendation_strategy'), true);
  assert.equal(coaching.outputSchemas.some((schema) => schema.name === 'roadmap'), true);

  const comparison = await orchestrator.plan({
    question: 'Compare my last five contests',
    intent: { primary: 'comparative', secondary: ['historical_review'], confidence: 0.82 },
    reasoningContext: context,
    promptPackage: prompt
  });
  assert.equal(comparison.routing.primaryTask, 'comparative_analysis');
  assert.equal(comparison.reasoningModes.includes('comparative'), true);

  const evidence = await orchestrator.plan({
    question: 'Why do you think I panic?',
    intent: { primary: 'evidence_request', secondary: ['diagnostic'], confidence: 0.88 },
    reasoningContext: context,
    promptPackage: prompt
  });
  assert.equal(evidence.routing.primaryTask, 'evidence_explanation');
  assert.equal(evidence.promptStrategies[0].strategyId, 'evidence_strategy');

  const unknown = await orchestrator.plan({
    question: 'quasar banana entropy',
    intent: { primary: 'unknown', secondary: [], confidence: 0.1 },
    reasoningContext: reasoningContext({ confidence: 0.2 }),
    promptPackage: prompt
  });
  assert.equal(unknown.routing.primaryTask, 'unknown');

  const registry = createDefaultAITaskRegistry();
  registry.register(new AITask({
    taskType: 'synthetic_task',
    supportedIntents: ['exploratory'],
    reasoningMode: 'analytical',
    schemaName: 'summary',
    strategyName: 'summary_strategy'
  }));
  assert.throws(() => registry.register(new AITask({
    taskType: 'synthetic_task',
    supportedIntents: ['exploratory'],
    reasoningMode: 'analytical',
    schemaName: 'summary',
    strategyName: 'summary_strategy'
  })), /Duplicate AI task/);

  const questions = [
    ['Why did I panic?', { primary: 'diagnostic', secondary: ['evidence_request'], confidence: 0.8 }],
    ['Compare my contests', { primary: 'comparative', secondary: ['historical_review'], confidence: 0.82 }],
    ['Reflect on my last contest', { primary: 'reflective', secondary: ['historical_review'], confidence: 0.74 }],
    ['Plan my path to expert', { primary: 'goal_planning', secondary: [], confidence: 0.78 }],
    ['Am I improving?', { primary: 'trend_analysis', secondary: ['comparative'], confidence: 0.8 }],
    ['Can I solve harder problems?', { primary: 'predictive', secondary: [], confidence: 0.71 }],
    ['Show evidence for my weakness', { primary: 'evidence_request', secondary: ['diagnostic'], confidence: 0.86 }],
    ['Analyze DP topic', { primary: 'coaching', secondary: ['comparative'], confidence: 0.72 }],
    ['Give me motivation', { primary: 'coaching', secondary: ['reflective'], confidence: 0.65 }],
    ['What is this?', { primary: 'exploratory', secondary: [], confidence: 0.35 }]
  ];
  const startedAt = Date.now();
  for (let index = 0; index < 1000; index += 1) {
    const [question, intent] = questions[index % questions.length];
    const localContext = reasoningContext({ historical: index % 2 === 0, contradictions: index % 5 === 0 ? [{ id: 'c' }] : [] });
    const plan = await orchestrator.plan({
      question,
      intent,
      reasoningContext: localContext,
      promptPackage: promptPackage(localContext)
    });
    assert.equal(Boolean(plan.executionPlanId), true);
    assert.equal(plan.tasks.length >= 1, true);
    assert.equal(plan.promptStrategies.length, plan.tasks.length);
    assert.equal(plan.outputSchemas.length, plan.tasks.length);
    assert.equal(plan.safetyConstraints.length >= plan.tasks.length, true);
    assert.equal(plan.executionMetadata.noLLMInvocation, true);
  }
  const latencyMs = Date.now() - startedAt;
  assert.equal(latencyMs < 5000, true);

  const deterministicContext = reasoningContext({ historical: true });
  const deterministicPrompt = promptPackage(deterministicContext);
  const planA = await orchestrator.plan({
    question: 'Why did my rating drop?',
    intent: { primary: 'diagnostic', secondary: ['historical_review'], confidence: 0.8 },
    reasoningContext: deterministicContext,
    promptPackage: deterministicPrompt
  });
  const planB = await orchestrator.plan({
    question: 'Why did my rating drop?',
    intent: { primary: 'diagnostic', secondary: ['historical_review'], confidence: 0.8 },
    reasoningContext: deterministicContext,
    promptPackage: deterministicPrompt
  });
  assert.deepEqual(stablePlan(planA), stablePlan(planB));

  console.log(JSON.stringify({
    verdict: 'PASS',
    taskCount: orchestrator.tasks().length,
    strategyCount: orchestrator.strategies().length,
    schemaCount: orchestrator.schemas().length,
    diagnosticChain: diagnostic.routing.taskChain,
    coachingChain: coaching.routing.taskChain,
    unknownTask: unknown.routing.primaryTask,
    policyAttachment: diagnostic.safetyConstraints.length,
    deterministicRouting: true,
    mixedQuestions: 1000,
    latencyMs,
    noLLMInvocation: true
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

