const crypto = require('crypto');
const { classify, INTENT_DEFINITIONS } = require('./intents/intentClassifier');
const { INTENTS } = require('./intents/intentTaxonomy');
const { createDefaultSourceRegistry } = require('./sources/factory');
const { createDefaultStrategyRegistry } = require('./strategies/factory');
const { createDefaultPlannerRuleRegistry } = require('./rules/factory');

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function mergePlans(classification, rulePlans) {
  const sources = new Map();
  const strategies = new Map();
  const evidenceTypes = new Set();
  let estimatedCost = 0;
  let estimatedLatencyMs = 0;
  let estimatedContextTokens = 0;
  let requiredConfidence = 0;
  let minimumSupportingSessions = 0;
  let minimumHistoricalCoverageDays = 0;

  for (const plan of rulePlans) {
    for (const source of plan.sources) {
      const existing = sources.get(source.name);
      if (!existing || source.priority < existing.priority) sources.set(source.name, source);
    }
    for (const strategy of plan.strategies) strategies.set(strategy.name, strategy);
    for (const evidenceType of plan.evidenceTypes) evidenceTypes.add(evidenceType);
    estimatedCost += plan.estimates.estimatedCost;
    estimatedLatencyMs += plan.estimates.estimatedLatencyMs;
    estimatedContextTokens += plan.tokenBudget.estimatedContextTokens;
    requiredConfidence = Math.max(requiredConfidence, plan.confidencePlan.requiredConfidence);
    minimumSupportingSessions = Math.max(minimumSupportingSessions, plan.confidencePlan.minimumSupportingSessions);
    minimumHistoricalCoverageDays = Math.max(minimumHistoricalCoverageDays, plan.confidencePlan.minimumHistoricalCoverageDays);
  }

  const selectedSources = [...sources.values()].sort((a, b) => a.priority - b.priority);
  const selectedStrategies = [...strategies.values()].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  const cappedTokens = Math.min(6000, Math.max(0, estimatedContextTokens));
  const evidenceSufficiency = classification.primaryIntent === INTENTS.UNKNOWN || !selectedSources.length
    ? 'insufficient'
    : 'requires_retrieval';

  return {
    planId: crypto.randomUUID(),
    question: classification.question,
    questionHash: classification.questionHash,
    intents: {
      primary: classification.primaryIntent,
      secondary: classification.secondaryIntents,
      all: unique([classification.primaryIntent, ...classification.secondaryIntents]).filter((intent) => intent !== INTENTS.UNKNOWN),
      confidence: classification.confidence,
      ambiguous: classification.ambiguous,
      classified: classification.intents
    },
    requiredEvidence: [...evidenceTypes],
    retrievalSources: selectedSources,
    retrievalStrategies: selectedStrategies,
    confidencePlan: {
      requiredConfidence,
      expectedEvidenceQuality: selectedSources.length
        ? Number((selectedSources.reduce((sum, source) => sum + source.requiredConfidence, 0) / selectedSources.length).toFixed(4))
        : 0,
      minimumSupportingSessions,
      minimumHistoricalCoverageDays,
      evidenceSufficiency,
      insufficientReason: evidenceSufficiency === 'insufficient' ? 'No confident known intent or supported source was identified.' : null
    },
    tokenBudget: {
      estimatedContextTokens: cappedTokens,
      maximumContextTokens: 6000,
      retrievalLimit: selectedSources.reduce((sum, source) => sum + source.limit, 0),
      priorityOrdering: selectedSources.map((source) => source.name)
    },
    estimates: {
      estimatedCost,
      estimatedLatencyMs,
      expectedPlannerOnly: true
    },
    executionPriority: selectedSources.map((source, index) => ({
      order: index + 1,
      source: source.name,
      strategies: selectedStrategies.map((strategy) => strategy.name)
    })),
    createdAt: new Date().toISOString()
  };
}

class RetrievalPlanner {
  constructor({
    sourceRegistry = createDefaultSourceRegistry(),
    strategyRegistry = createDefaultStrategyRegistry(),
    ruleRegistry = createDefaultPlannerRuleRegistry()
  } = {}) {
    this.sourceRegistry = sourceRegistry;
    this.strategyRegistry = strategyRegistry;
    this.ruleRegistry = ruleRegistry;
  }

  classify(question) {
    return classify(question);
  }

  async plan(question, options = {}) {
    const classification = this.classify(question);
    const intents = unique([classification.primaryIntent, ...classification.secondaryIntents]).filter((intent) => intent !== INTENTS.UNKNOWN);
    const sources = this.sourceRegistry.forIntents(intents);
    const strategies = this.strategyRegistry.forIntents(intents);
    const rulePlans = [];

    for (const intent of intents) {
      for (const rule of this.ruleRegistry.forIntent(intent)) {
        await rule.initialize();
        rulePlans.push(rule.plan({ classification, intent, sources, strategies, options }));
        await rule.destroy();
      }
    }

    return mergePlans(classification, rulePlans);
  }

  intents() {
    return INTENT_DEFINITIONS;
  }

  sources() {
    return this.sourceRegistry.all().map((source) => source.metadata());
  }

  strategies() {
    return this.strategyRegistry.all().map((strategy) => strategy.metadata());
  }
}

module.exports = { RetrievalPlanner };
