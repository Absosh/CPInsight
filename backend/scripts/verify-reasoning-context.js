const assert = require('assert/strict');
const crypto = require('crypto');
const { buildReasoningContext } = require('../src/ai/reasoning/context/contextBuilder');
const { buildPromptPackage } = require('../src/ai/reasoning/prompts/promptOrchestrator');
const { ontologyDocument } = require('../src/ai/reasoning/ontology/behaviorOntology');

function evidence(source, index, payload, confidence = 0.8) {
  return Object.freeze({
    evidenceId: `${source}:${index}`,
    source,
    type: payload.insight_key ? 'behavior_insights' : 'behavior_features',
    identifier: `${source}-${index}`,
    confidence,
    timestamp: new Date(Date.now() - index * 1000).toISOString(),
    version: 1,
    relationshipDistance: 1 + (index % 3),
    payload,
    references: { verification: true },
    rankScore: Number((0.9 - index * 0.001).toFixed(4))
  });
}

function packageFixture(size = 40) {
  const rows = [
    evidence('behavior_insights', 1, { id: 'panic', insight_key: 'repeated_late_panic', category: 'weakness', value: 0.86 }, 0.86),
    evidence('behavior_features', 2, { id: 'time', feature_name: 'late_contest_panic', value: 0.91 }, 0.84),
    evidence('behavior_features', 3, { id: 'time-low', feature_name: 'late_contest_panic', value: 0.1 }, 0.82),
    evidence('behavior_insights', 4, { id: 'recovery', insight_key: 'strong_recovery_ability', category: 'strength', value: 0.81 }, 0.83),
    evidence('behavior_features', 5, { id: 'persist', feature_name: 'persistence_score', value: 0.88 }, 0.85),
    evidence('behavior_features', 6, { id: 'risk', feature_name: 'risk_appetite', value: 0.82 }, 0.79),
    evidence('behavior_insights', 7, { id: 'difficulty', insight_key: 'difficulty_avoidance', category: 'pattern', value: 0.76 }, 0.77),
    evidence('behavior_insights', 8, { id: 'fast', insight_key: 'fast_recognition', category: 'strength', value: 0.74 }, 0.74)
  ];
  for (let index = rows.length; index < size; index += 1) {
    rows.push(evidence('historical_aggregations', index, {
      id: `hist-${index}`,
      feature_name: index % 2 ? 'attention_stability' : 'topic_performance',
      value: index % 2 ? 0.72 : 0.64
    }, 0.65 + (index % 4) * 0.05));
  }
  return Object.freeze({
    packageId: crypto.randomUUID(),
    planId: crypto.randomUUID(),
    questionHash: crypto.createHash('sha256').update('Why did I panic?').digest('hex'),
    retrievalMetadata: {
      plannerIntent: { primary: 'diagnostic', secondary: ['evidence_request'] },
      requiredEvidence: ['insight_evidence', 'supporting_features'],
      sourceCount: 5
    },
    retrievedSources: [],
    evidence: rows,
    ignoredEvidence: [],
    contradictions: [{
      contradictionId: crypto.randomUUID(),
      type: 'conflicting_feature_values',
      key: 'late_contest_panic',
      evidenceIds: ['behavior_features:2', 'behavior_features:3'],
      severity: 'needs_review',
      values: [0.91, 0.1]
    }],
    confidenceSummary: {
      averageConfidence: 0.78,
      requiredConfidence: 0.85,
      meetsRequirement: false
    },
    missingEvidence: ['session_summaries'],
    statistics: {
      retrievalLatencyMs: 22,
      resolvedEvidenceCount: rows.length
    }
  });
}

function stablePrompt(promptPackage) {
  return {
    providerIndependent: promptPackage.providerIndependent,
    systemPrompt: promptPackage.systemPrompt,
    developerInstructions: promptPackage.developerInstructions,
    outputSchema: promptPackage.outputSchema,
    groundingRules: promptPackage.groundingRules,
    citationRules: promptPackage.citationRules,
    safetyRules: promptPackage.safetyRules,
    responseConstraints: promptPackage.responseConstraints,
    evidenceIds: promptPackage.evidenceBlock.map((item) => item.evidenceId)
  };
}

async function run() {
  const ontology = ontologyDocument();
  assert.equal(ontology.concepts.some((concept) => concept.id === 'panic'), true);
  assert.equal(ontology.concepts.some((concept) => concept.id === 'difficulty_avoidance'), true);

  const context = buildReasoningContext(packageFixture(60), { budget: '8k' });
  assert.equal(Object.isFrozen(context), true);
  assert.equal(context.primaryFindings.length > 0, true);
  assert.equal(context.primaryFindings.every((finding) => finding.conceptId !== undefined), true);
  assert.equal(context.causalChains.length >= 1, true);
  assert.equal(context.contradictions.length, 1);
  assert.equal(context.findingClasses.conflictingFindings.length >= 1, true);
  assert.equal(context.evidenceSummary.clusters.length > 0, true);
  assert.equal(context.tokenBudget.estimatedContextTokens <= context.tokenBudget.availableContextTokens, true);
  assert.equal(context.confidence > 0 && context.confidence <= 1, true);

  const tinyContext = buildReasoningContext(packageFixture(500), { budget: '4k' });
  assert.equal(tinyContext.evidenceSummary.discardedEvidenceIds.length > 0, true);
  assert.equal(tinyContext.tokenBudget.estimatedContextTokens <= tinyContext.tokenBudget.availableContextTokens, true);

  const prompt = buildPromptPackage(context);
  assert.equal(Object.isFrozen(prompt), true);
  assert.equal(prompt.providerIndependent, true);
  assert.equal(prompt.supportedProviders.length >= 7, true);
  assert.equal(prompt.groundingRules.neverInventEvidence, true);
  assert.equal(prompt.citationRules.required, true);
  assert.equal(prompt.responseConstraints.noLLMInvocationInThisPhase, true);
  assert.equal(prompt.evidenceBlock.every((item) => item.evidenceId), true);

  const promptA = stablePrompt(buildPromptPackage(context));
  const promptB = stablePrompt(buildPromptPackage(context));
  assert.deepEqual(promptA, promptB);

  const startedAt = Date.now();
  for (let index = 0; index < 1000; index += 1) {
    const pkg = packageFixture(20 + (index % 80));
    const generated = buildReasoningContext(pkg, { budget: index % 2 ? '4k' : '16k' });
    const generatedPrompt = buildPromptPackage(generated);
    assert.equal(generated.primaryFindings.length > 0, true);
    assert.equal(generatedPrompt.providerIndependent, true);
    assert.equal(generated.tokenBudget.budgetExceeded, false);
  }
  const latencyMs = Date.now() - startedAt;
  assert.equal(latencyMs < 10000, true);

  console.log(JSON.stringify({
    verdict: 'PASS',
    ontologyConcepts: ontology.concepts.length,
    primaryFindings: context.primaryFindings.length,
    secondaryFindings: context.secondaryFindings.length,
    causalChains: context.causalChains.length,
    contradictions: context.contradictions.length,
    compressedClusters: context.evidenceSummary.clusters.length,
    discardedUnder4k: tinyContext.evidenceSummary.discardedEvidenceIds.length,
    providerCount: prompt.supportedProviders.length,
    promptDeterministic: true,
    mixedEvidencePackages: 1000,
    latencyMs,
    promptSizeTokens: prompt.audit.promptSizeTokens,
    contextSizeTokens: context.tokenBudget.estimatedContextTokens
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

