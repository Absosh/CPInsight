const { RetrievalSource } = require('./retrievalSource');
const { SourceRegistry } = require('./sourceRegistry');
const { INTENTS } = require('../intents/intentTaxonomy');

function createDefaultSourceRegistry() {
  const registry = new SourceRegistry();
  const allBehavior = [
    INTENTS.DIAGNOSTIC,
    INTENTS.COMPARATIVE,
    INTENTS.PREDICTIVE,
    INTENTS.COACHING,
    INTENTS.REFLECTIVE,
    INTENTS.EXPLORATORY,
    INTENTS.EVIDENCE_REQUEST,
    INTENTS.HISTORICAL_REVIEW,
    INTENTS.TREND_ANALYSIS,
    INTENTS.GOAL_PLANNING
  ];

  [
    new RetrievalSource({ name: 'behavior_profiles', supportedIntents: [INTENTS.COACHING, INTENTS.REFLECTIVE, INTENTS.PREDICTIVE, INTENTS.GOAL_PLANNING], estimatedCost: 1, estimatedLatencyMs: 15, requiredConfidence: 0.65, defaultLimit: 1, contextTokenEstimate: 800 }),
    new RetrievalSource({ name: 'behavior_features', supportedIntents: allBehavior, estimatedCost: 2, estimatedLatencyMs: 35, requiredConfidence: 0.7, defaultLimit: 100, contextTokenEstimate: 1600 }),
    new RetrievalSource({ name: 'behavior_knowledge_graph', supportedIntents: [INTENTS.DIAGNOSTIC, INTENTS.COACHING, INTENTS.REFLECTIVE, INTENTS.EXPLORATORY, INTENTS.EVIDENCE_REQUEST], estimatedCost: 2, estimatedLatencyMs: 30, requiredConfidence: 0.75, defaultLimit: 50, contextTokenEstimate: 1200 }),
    new RetrievalSource({ name: 'behavior_insights', supportedIntents: allBehavior, estimatedCost: 1, estimatedLatencyMs: 20, requiredConfidence: 0.72, defaultLimit: 30, contextTokenEstimate: 900 }),
    new RetrievalSource({ name: 'evidence_store', supportedIntents: [INTENTS.EVIDENCE_REQUEST, INTENTS.DIAGNOSTIC, INTENTS.REFLECTIVE], estimatedCost: 2, estimatedLatencyMs: 40, requiredConfidence: 0.8, defaultLimit: 80, contextTokenEstimate: 1600 }),
    new RetrievalSource({ name: 'contest_history', supportedIntents: [INTENTS.DIAGNOSTIC, INTENTS.COMPARATIVE, INTENTS.HISTORICAL_REVIEW, INTENTS.TREND_ANALYSIS], estimatedCost: 2, estimatedLatencyMs: 45, requiredConfidence: 0.68, defaultLimit: 20, contextTokenEstimate: 1000 }),
    new RetrievalSource({ name: 'contest_summaries', supportedIntents: [INTENTS.COMPARATIVE, INTENTS.HISTORICAL_REVIEW, INTENTS.TREND_ANALYSIS], estimatedCost: 1, estimatedLatencyMs: 25, requiredConfidence: 0.68, defaultLimit: 10, contextTokenEstimate: 900 }),
    new RetrievalSource({ name: 'session_summaries', supportedIntents: [INTENTS.DIAGNOSTIC, INTENTS.HISTORICAL_REVIEW, INTENTS.EVIDENCE_REQUEST], estimatedCost: 2, estimatedLatencyMs: 45, requiredConfidence: 0.7, defaultLimit: 20, contextTokenEstimate: 1200 }),
    new RetrievalSource({ name: 'historical_aggregations', supportedIntents: [INTENTS.COMPARATIVE, INTENTS.TREND_ANALYSIS, INTENTS.PREDICTIVE, INTENTS.GOAL_PLANNING], estimatedCost: 2, estimatedLatencyMs: 50, requiredConfidence: 0.72, defaultLimit: 12, contextTokenEstimate: 1100 }),
    new RetrievalSource({ name: 'user_metadata', supportedIntents: [INTENTS.COACHING, INTENTS.GOAL_PLANNING, INTENTS.PREDICTIVE], estimatedCost: 1, estimatedLatencyMs: 10, requiredConfidence: 0.6, defaultLimit: 1, contextTokenEstimate: 300 }),
    new RetrievalSource({ name: 'topic_performance', supportedIntents: [INTENTS.COACHING, INTENTS.COMPARATIVE, INTENTS.PREDICTIVE, INTENTS.GOAL_PLANNING], estimatedCost: 2, estimatedLatencyMs: 35, requiredConfidence: 0.7, defaultLimit: 50, contextTokenEstimate: 1000 }),
    new RetrievalSource({ name: 'platform_statistics', supportedIntents: [INTENTS.COMPARATIVE, INTENTS.HISTORICAL_REVIEW, INTENTS.TREND_ANALYSIS], estimatedCost: 1, estimatedLatencyMs: 20, requiredConfidence: 0.65, defaultLimit: 20, contextTokenEstimate: 700 }),
    new RetrievalSource({ name: 'feature_versions', supportedIntents: [INTENTS.EVIDENCE_REQUEST, INTENTS.DIAGNOSTIC], estimatedCost: 1, estimatedLatencyMs: 10, requiredConfidence: 0.75, defaultLimit: 10, contextTokenEstimate: 300 }),
    new RetrievalSource({ name: 'pattern_evolution', supportedIntents: [INTENTS.TREND_ANALYSIS, INTENTS.REFLECTIVE, INTENTS.HISTORICAL_REVIEW, INTENTS.EVIDENCE_REQUEST], estimatedCost: 2, estimatedLatencyMs: 40, requiredConfidence: 0.75, defaultLimit: 30, contextTokenEstimate: 900 }),
    new RetrievalSource({ name: 'future_vector_store', supportedIntents: [INTENTS.EXPLORATORY, INTENTS.EVIDENCE_REQUEST, INTENTS.COACHING], estimatedCost: 4, estimatedLatencyMs: 90, requiredConfidence: 0.8, defaultLimit: 0, contextTokenEstimate: 0 }),
    new RetrievalSource({ name: 'future_conversation_memory', supportedIntents: [INTENTS.COACHING, INTENTS.REFLECTIVE, INTENTS.GOAL_PLANNING], estimatedCost: 3, estimatedLatencyMs: 60, requiredConfidence: 0.75, defaultLimit: 0, contextTokenEstimate: 0 })
  ].forEach((source) => registry.register(source));

  return registry;
}

module.exports = { createDefaultSourceRegistry };

