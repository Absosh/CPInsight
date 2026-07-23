const assert = require('assert/strict');
const crypto = require('crypto');
const { ValidationPipeline } = require('../src/ai/quality/pipeline/validationPipeline');
const { normalizeFeedback } = require('../src/ai/quality/feedback/feedbackEngine');

function evidence(id, confidence = 0.8, concept = 'panic') {
  return {
    evidenceId: id,
    source: 'behavior_insights',
    type: 'behavior_insights',
    identifier: id,
    confidence,
    timestamp: new Date().toISOString(),
    payload: { insight_key: concept, value: confidence },
    rankScore: confidence
  };
}

function fixture() {
  const e1 = evidence('e1', 0.86, 'repeated_late_panic');
  const e2 = evidence('e2', 0.82, 'difficulty_avoidance');
  const e3 = evidence('e3', 0.78, 'strong_recovery_ability');
  return {
    executionPlan: { executionPlanId: crypto.randomUUID(), routing: { primaryTask: 'diagnostic' } },
    reasoningContext: {
      contextId: crypto.randomUUID(),
      confidence: 0.81,
      primaryFindings: [
        { findingId: 'f1', conceptId: 'panic', findingType: 'weakness', confidence: 0.86, evidenceCount: 2, evidenceIds: ['e1'] },
        { findingId: 'f2', conceptId: 'recovery_strategy', findingType: 'strength', confidence: 0.78, evidenceCount: 1, evidenceIds: ['e3'] }
      ],
      evidenceSummary: { usedEvidence: [e1, e2, e3] },
      missingEvidence: []
    },
    evidencePackage: {
      packageId: crypto.randomUUID(),
      evidence: [e1, e2, e3],
      confidenceSummary: { averageConfidence: 0.82 },
      missingEvidence: []
    }
  };
}

function raw(overrides = {}) {
  return {
    runtimeRequestId: crypto.randomUUID(),
    provider: 'mock',
    model: 'mock-model',
    text: JSON.stringify({
      observations: [{ text: 'Late contest panic is visible.', evidenceIds: ['e1'] }],
      inferences: [{ text: 'Pressure likely contributes to mistakes.', evidenceIds: ['e1'] }],
      recommendations: [{ text: 'Practice timed virtual contests.', evidenceIds: ['e1', 'e2'] }],
      citations: ['e1', 'e2'],
      confidence: 0.78,
      uncertainty: ['Need more contest samples.'],
      summary: 'The evidence supports a panic-related weakness.',
      ...overrides
    })
  };
}

async function run() {
  const pipeline = new ValidationPipeline({ qualityThreshold: 0.65 });
  const base = fixture();
  const valid = pipeline.validate({ ...base, rawResponse: raw() });
  assert.equal(valid.validationReport.schema.valid, true);
  assert.equal(valid.validationReport.grounding.valid, true);
  assert.equal(valid.validationReport.citations.valid, true);
  assert.equal(valid.validationReport.recommendations.valid, true);
  assert.equal(valid.qualityReport.overallQualityScore >= 0.65, true);
  assert.equal(valid.behaviorReflections.length >= 1, true);
  assert.equal(valid.validatedResponse.confidence <= 1, true);

  const malformed = pipeline.validate({ ...base, rawResponse: { text: 'plain text without json', provider: 'mock' } });
  assert.equal(malformed.validationReport.schema.repairedDeterministically, true);

  const ungrounded = pipeline.validate({ ...base, rawResponse: raw({ observations: [{ text: 'Unsupported claim.', evidenceIds: [] }] }) });
  assert.equal(ungrounded.validationReport.grounding.valid, false);
  assert.equal(ungrounded.validationReport.regeneration.requested, true);

  const fabricatedCitation = pipeline.validate({ ...base, rawResponse: raw({ citations: ['fake-evidence'] }) });
  assert.equal(fabricatedCitation.validationReport.citations.valid, false);

  const unsupportedRecommendation = pipeline.validate({ ...base, rawResponse: raw({ recommendations: [{ text: 'Practice geometry.', evidenceIds: ['fake-evidence'] }] }) });
  assert.equal(unsupportedRecommendation.validationReport.recommendations.valid, false);

  const confidenceMismatch = pipeline.validate({ ...base, rawResponse: raw({ confidence: 1 }) });
  assert.equal(confidenceMismatch.validationReport.confidence.valid, true);
  assert.equal(confidenceMismatch.validatedResponse.confidence < 1, true);

  const duplicate = pipeline.validate({ ...base, rawResponse: raw({
    observations: [
      { text: 'Repeated.', evidenceIds: ['e1'] },
      { text: 'Repeated.', evidenceIds: ['e1'] }
    ]
  }) });
  assert.equal(duplicate.validationReport.consistency.valid, false);

  const feedback = normalizeFeedback({ responseId: valid.validationId, feedbackType: 'helpful', metadata: { source: 'verification' } });
  assert.equal(feedback.feedbackType, 'helpful');
  assert.throws(() => normalizeFeedback({ feedbackType: 'unknown' }), /Invalid feedback type/);

  const startedAt = Date.now();
  for (let index = 0; index < 1000; index += 1) {
    const local = fixture();
    const result = pipeline.validate({
      ...local,
      rawResponse: index % 10 === 0
        ? raw({ citations: ['missing'], confidence: 0.99 })
        : raw({ confidence: 0.6 + (index % 4) * 0.05 })
    });
    assert.equal(Boolean(result.validationId), true);
    assert.equal(result.validatedResponse.observations.length >= 1 || result.validationReport.schema.repairedDeterministically, true);
    assert.equal(result.qualityReport.overallQualityScore >= 0 && result.qualityReport.overallQualityScore <= 1, true);
  }
  const latencyMs = Date.now() - startedAt;
  assert.equal(latencyMs < 10000, true);

  const deterministicRaw = raw();
  const deterministicA = pipeline.validate({ ...base, rawResponse: deterministicRaw });
  const deterministicB = pipeline.validate({ ...base, rawResponse: deterministicRaw });
  assert.deepEqual(
    {
      response: deterministicA.validatedResponse,
      report: {
        grounding: deterministicA.validationReport.grounding.coverage,
        citation: deterministicA.validationReport.citations.quality,
        recommendation: deterministicA.validationReport.recommendations.supportRate,
        quality: deterministicA.qualityReport.overallQualityScore
      }
    },
    {
      response: deterministicB.validatedResponse,
      report: {
        grounding: deterministicB.validationReport.grounding.coverage,
        citation: deterministicB.validationReport.citations.quality,
        recommendation: deterministicB.validationReport.recommendations.supportRate,
        quality: deterministicB.qualityReport.overallQualityScore
      }
    }
  );

  console.log(JSON.stringify({
    verdict: 'PASS',
    validQuality: valid.qualityReport.overallQualityScore,
    malformedRepaired: malformed.validationReport.schema.repairedDeterministically,
    groundingFailure: !ungrounded.validationReport.grounding.valid,
    citationFailure: !fabricatedCitation.validationReport.citations.valid,
    recommendationFailure: !unsupportedRecommendation.validationReport.recommendations.valid,
    confidenceClamped: confidenceMismatch.validatedResponse.confidence,
    reflectionCount: valid.behaviorReflections.length,
    feedbackAccepted: feedback.feedbackType,
    regenerationRequested: ungrounded.validationReport.regeneration.requested,
    deterministicValidation: true,
    rawResponses: 1000,
    latencyMs
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
