const { INTENTS } = require('../ai/planner/intents/intentTaxonomy');
const { RetrievalPlanner } = require('../ai/planner/retrievalPlanner');
const repository = require('../repositories/plannerRepository');

function sourceFrequency(plan) {
  return plan.retrievalSources.reduce((acc, source) => {
    acc[source.name] = (acc[source.name] || 0) + 1;
    return acc;
  }, {});
}

function intentDistribution(classification) {
  return classification.intents.reduce((acc, item) => {
    acc[item.intent] = item.confidence;
    return acc;
  }, {});
}

class PlannerService {
  constructor({ planner = new RetrievalPlanner(), repo = repository } = {}) {
    this.planner = planner;
    this.repo = repo;
  }

  async classify(userId, question) {
    const startedAt = Date.now();
    const classification = this.planner.classify(question);
    await this.repo.insertClassification(userId, classification);
    await this.repo.insertMetrics({
      userId,
      questionHash: classification.questionHash,
      plannerLatencyMs: Date.now() - startedAt,
      primaryIntent: classification.primaryIntent,
      intentDistribution: intentDistribution(classification),
      averageConfidenceEstimate: classification.confidence,
      unknownIntent: classification.primaryIntent === INTENTS.UNKNOWN
    });
    return classification;
  }

  async plan(userId, question, options = {}) {
    const startedAt = Date.now();
    try {
      const plan = await this.planner.plan(question, options);
      await this.repo.insertClassification(userId, {
        questionHash: plan.questionHash,
        primaryIntent: plan.intents.primary,
        secondaryIntents: plan.intents.secondary,
        confidence: plan.intents.confidence,
        ambiguous: plan.intents.ambiguous,
        intents: plan.intents.classified
      });
      await this.repo.insertPlan(userId, plan);
      await this.repo.insertMetrics({
        userId,
        questionHash: plan.questionHash,
        plannerLatencyMs: Date.now() - startedAt,
        primaryIntent: plan.intents.primary,
        intentDistribution: intentDistribution({ intents: plan.intents.classified }),
        selectedSourceCount: plan.retrievalSources.length,
        sourceSelectionFrequency: sourceFrequency(plan),
        averageRetrievalCostEstimate: plan.estimates.estimatedCost,
        averageConfidenceEstimate: plan.confidencePlan.expectedEvidenceQuality,
        unknownIntent: plan.intents.primary === INTENTS.UNKNOWN
      });
      return plan;
    } catch (error) {
      await this.repo.insertMetrics({
        userId,
        plannerLatencyMs: Date.now() - startedAt,
        planningFailure: true,
        errorMessage: error.message
      }).catch(() => {});
      throw error;
    }
  }

  intents() {
    return this.planner.intents();
  }

  sources() {
    return this.planner.sources();
  }

  strategies() {
    return this.planner.strategies();
  }
}

module.exports = new PlannerService();
module.exports.PlannerService = PlannerService;

