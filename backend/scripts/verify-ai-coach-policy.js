const assert = require('assert/strict');
const crypto = require('crypto');
const { RetrievalPlanner } = require('../src/ai/planner/retrievalPlanner');
const { fuse } = require('../src/ai/retrieval/fusion/evidenceFusion');
const { buildReasoningContext } = require('../src/ai/reasoning/context/contextBuilder');
const { buildPromptPackage } = require('../src/ai/reasoning/prompts/promptOrchestrator');
const { ValidationPipeline } = require('../src/ai/quality/pipeline/validationPipeline');

function emptyPackage(plan) {
  return fuse({ plan, retrievalResults: [], sourceHealth: [] });
}

function topicEvidence(plan) {
  return fuse({
    plan,
    retrievalResults: [{
      source: 'topic_performance',
      status: 'fulfilled',
      latencyMs: 1,
      evidence: [{
        evidenceId: 'topic_performance:binary search',
        source: 'topic_performance',
        type: 'topic_performance',
        identifier: 'binary search',
        confidence: 0.76,
        timestamp: new Date().toISOString(),
        version: 1,
        distance: 1,
        payload: {
          id: 'binary search',
          topic: 'binary search',
          requestedPlatform: 'codeforces',
          ratingGapPriorityScore: 0.79,
          submissions: 9,
          solvedProblems: 5,
          acceptanceRate: 0.5556,
          averageDifficulty: 1144
        }
      }]
    }],
    sourceHealth: [{ name: 'topic_performance', reliability: 0.75 }]
  });
}

function validateGeneralAnswer(context, evidencePackage) {
  const pipeline = new ValidationPipeline();
  return pipeline.validate({
    executionPlan: { executionPlanId: crypto.randomUUID() },
    reasoningContext: context,
    evidencePackage,
    rawResponse: {
      runtimeRequestId: crypto.randomUUID(),
      provider: 'gemini',
      model: 'gemini-flash-lite-latest',
      text: JSON.stringify({
        summary: 'A Fenwick Tree stores prefix aggregates with logarithmic updates and queries.',
        observations: [],
        inferences: [],
        recommendations: ['Practice point updates and prefix sums first.'],
        citations: [],
        confidence: 0.8,
        uncertainty: []
      })
    }
  });
}

async function run() {
  const planner = new RetrievalPlanner();

  const generalPlan = await planner.plan('Explain Fenwick Tree');
  assert.equal(generalPlan.retrievalMode, 'general');
  assert.equal(generalPlan.retrievalSources.length, 0);
  const generalPackage = emptyPackage(generalPlan);
  const generalContext = buildReasoningContext(generalPackage, {
    conversationHistory: [
      { role: 'user', content: 'Does CP help in coding interviews?', createdAt: new Date().toISOString() },
      { role: 'assistant', content: 'Yes, but it should be balanced with interview-specific practice.', createdAt: new Date().toISOString() }
    ]
  });
  const generalPrompt = buildPromptPackage(generalContext);
  assert.equal(generalContext.personalContextAvailable, false);
  assert.equal(generalContext.conversationHistory.length, 2);
  assert.equal(generalPrompt.responseConstraints.answerWithoutPersonalEvidence, true);
  assert.equal(generalPrompt.responseConstraints.usePreparedContextOnly, false);
  assert.equal(generalPrompt.systemPrompt.includes('Behave like Gemini first'), true);
  assert.equal(generalPrompt.developerInstructions.some((item) => item.includes('complete user-visible answer')), true);
  const validatedGeneral = validateGeneralAnswer(generalContext, generalPackage);
  assert.equal(validatedGeneral.validationReport.grounding.valid, true);
  assert.equal(validatedGeneral.validationReport.citations.valid, true);
  assert.equal(validatedGeneral.validationReport.recommendations.valid, true);

  const hybridPlan = await planner.plan('How should I study DP to reach 1400?');
  assert.equal(hybridPlan.retrievalMode, 'hybrid');
  assert.equal(hybridPlan.retrievalSources.length > 0, true);
  const hybridContext = buildReasoningContext(topicEvidence(hybridPlan));
  assert.equal(hybridContext.personalContextAvailable, true);
  assert.equal(hybridContext.questionRelevantEvidence.length > 0, true);

  const personalPlan = await planner.plan('What are my weakest topics?');
  assert.equal(personalPlan.retrievalMode, 'personal');
  assert.equal(personalPlan.confidencePlan.personalEvidenceRequired, true);
  assert.equal(personalPlan.retrievalSources.length > 0, true);
  assert.equal(personalPlan.retrievalSources.some((source) => source.name === 'topic_performance'), true);

  console.log(JSON.stringify({
    verdict: 'PASS',
    general: {
      mode: generalPlan.retrievalMode,
      sources: generalPlan.retrievalSources.length,
      answersWithoutPersonalEvidence: generalPrompt.responseConstraints.answerWithoutPersonalEvidence,
      validationAllowsNoEvidence: validatedGeneral.validationReport.grounding.skipped,
      conversationHistoryTurns: generalContext.conversationHistory.length,
      geminiStylePrompt: generalPrompt.systemPrompt.includes('Behave like Gemini first')
    },
    hybrid: {
      mode: hybridPlan.retrievalMode,
      sources: hybridPlan.retrievalSources.map((source) => source.name),
      questionRelevantEvidence: hybridContext.questionRelevantEvidence.length
    },
    personal: {
      mode: personalPlan.retrievalMode,
      personalEvidenceRequired: personalPlan.confidencePlan.personalEvidenceRequired,
      sources: personalPlan.retrievalSources.map((source) => source.name)
    }
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
