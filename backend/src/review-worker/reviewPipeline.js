const behaviorService = require('../services/behaviorService');
const knowledgeService = require('../services/knowledgeService');
const plannerService = require('../services/plannerService');
const retrievalService = require('../services/retrievalService');
const reasoningService = require('../services/reasoningService');
const taskService = require('../services/taskService');
const runtimeService = require('../services/runtimeService');
const qualityService = require('../services/qualityService');
const { REVIEW_JOB_STATES, REVIEW_JOB_PROGRESS } = require('./jobStates');

function reviewQuestion(session) {
  const contestName = session.contest_name || session.contest_id;
  return `Generate an evidence-backed contest review for my ${session.platform} contest "${contestName}". Explain what happened, what behaviors mattered, and what I should do next.`;
}

function recommendationTracking(validation) {
  return (validation.validatedResponse?.recommendations || []).map((recommendation, index) => ({
    recommendationId: `${validation.validationId}:recommendation:${index + 1}`,
    recommendation,
    status: 'open',
    sourceValidationId: validation.validationId,
    createdAt: new Date().toISOString()
  }));
}

function roadmapFromReview({ session, validation, reasoningContext }) {
  return {
    goal: `Improve after ${session.contest_name || session.contest_id}`,
    currentState: {
      platform: session.platform,
      contestId: session.contest_id,
      reviewConfidence: validation.validatedResponse?.confidence || 0,
      primaryFindings: reasoningContext.primaryFindings || []
    },
    milestones: (validation.validatedResponse?.recommendations || []).slice(0, 5).map((item, index) => ({
      milestoneId: `${validation.validationId}:milestone:${index + 1}`,
      title: typeof item === 'string' ? item : item.title || item.recommendation || `Recommendation ${index + 1}`,
      status: 'planned',
      priority: index + 1
    })),
    updatedAt: new Date().toISOString(),
    version: 1
  };
}

class ContestReviewPipeline {
  constructor({
    behavior = behaviorService,
    knowledge = knowledgeService,
    planner = plannerService,
    retrieval = retrievalService,
    reasoning = reasoningService,
    task = taskService,
    runtime = runtimeService,
    quality = qualityService
  } = {}) {
    this.behavior = behavior;
    this.knowledge = knowledge;
    this.planner = planner;
    this.retrieval = retrieval;
    this.reasoning = reasoning;
    this.task = task;
    this.runtime = runtime;
    this.quality = quality;
  }

  async run({ userId, session, updateStage, providerTimeoutMs }) {
    const question = reviewQuestion(session);

    const behavior = await this.timedStage(updateStage, REVIEW_JOB_STATES.BEHAVIOR_PROCESSING, async () =>
      this.behavior.runExtraction(userId, {
        platform: session.platform,
        liveSessionId: session.live_session_id,
        contestId: session.contest_id,
        windowKey: `contest:${session.contest_id}`
      })
    );

    const knowledge = await this.timedStage(updateStage, REVIEW_JOB_STATES.KNOWLEDGE_GRAPH_UPDATE, async () =>
      this.knowledge.infer(userId, {
        platform: session.platform,
        liveSessionId: session.live_session_id,
        contestId: session.contest_id,
        windowKey: `contest:${session.contest_id}`
      })
    );

    await updateStage({
      stage: REVIEW_JOB_STATES.REASONING,
      progressPercent: REVIEW_JOB_PROGRESS[REVIEW_JOB_STATES.REASONING],
      metadata: { question }
    });
    const retrievalPlan = await this.planner.plan(userId, question, {
      minimumHistoricalCoverage: 1,
      context: {
        platform: session.platform,
        contestId: session.contest_id,
        liveSessionId: session.live_session_id
      }
    });
    const evidencePackage = await this.retrieval.execute(userId, retrievalPlan, {
      contestId: session.contest_id,
      liveSessionId: session.live_session_id
    });
    const reasoningContext = await this.reasoning.createContext(userId, evidencePackage, { question });
    const promptPackage = await this.reasoning.createPrompt(userId, reasoningContext, {
      purpose: 'contest_review'
    });
    const executionPlan = await this.task.plan(userId, {
      question,
      intent: {
        primary: retrievalPlan.intents.primary,
        secondary: retrievalPlan.intents.secondary,
        all: retrievalPlan.intents.classified.map((item) => item.intent),
        confidence: retrievalPlan.intents.confidence
      },
      reasoningContext,
      promptPackage
    });

    const runtime = await this.timedStage(updateStage, REVIEW_JOB_STATES.AI_REVIEW, async () =>
      this.runtime.execute(userId, {
        executionPlan,
        promptPackage,
        override: {
          timeoutMs: providerTimeoutMs,
          parameters: {
            temperature: 0.2,
            maxOutputTokens: 1200
          }
        }
      }, false)
    );

    const validation = await this.timedStage(updateStage, REVIEW_JOB_STATES.REFLECTION, async () =>
      this.quality.validate(userId, {
        executionPlan,
        reasoningContext,
        evidencePackage,
        rawResponse: runtime
      })
    );

    const roadmap = await this.timedStage(updateStage, REVIEW_JOB_STATES.ROADMAP_UPDATE, async () =>
      roadmapFromReview({ session, validation, reasoningContext })
    );

    return {
      question,
      behavior,
      knowledge,
      retrievalPlan,
      evidencePackage,
      reasoningContext,
      promptPackage,
      executionPlan,
      runtime,
      validation,
      roadmap,
      recommendationTracking: recommendationTracking(validation),
      behaviorEvolution: {
        behaviorRunId: behavior.runId,
        knowledgeRunId: knowledge.runId,
        updatedAt: new Date().toISOString()
      }
    };
  }

  async timedStage(updateStage, stage, work) {
    const startedAt = Date.now();
    await updateStage({ stage, progressPercent: REVIEW_JOB_PROGRESS[stage], metadata: { startedAt: new Date().toISOString() } });
    const result = await work();
    await updateStage({
      stage,
      progressPercent: REVIEW_JOB_PROGRESS[stage],
      metadata: {
        durationMs: Date.now() - startedAt,
        completedAt: new Date().toISOString()
      }
    });
    return result;
  }
}

module.exports = {
  ContestReviewPipeline,
  reviewQuestion,
  roadmapFromReview,
  recommendationTracking
};
