const { INTENTS } = require('../intents/intentTaxonomy');
const { RetrievalStrategy } = require('./retrievalStrategy');
const { StrategyRegistry } = require('./strategyRegistry');

function createDefaultStrategyRegistry() {
  const registry = new StrategyRegistry();
  [
    new RetrievalStrategy({
      name: 'knowledge_graph_traversal',
      supportedIntents: [INTENTS.DIAGNOSTIC, INTENTS.COACHING, INTENTS.REFLECTIVE, INTENTS.EXPLORATORY, INTENTS.EVIDENCE_REQUEST],
      description: 'Traverse persisted behavior knowledge relationships.',
      priority: 1,
      contextMultiplier: 0.8
    }),
    new RetrievalStrategy({
      name: 'evidence_chain_retrieval',
      supportedIntents: [INTENTS.EVIDENCE_REQUEST, INTENTS.DIAGNOSTIC, INTENTS.REFLECTIVE],
      description: 'Retrieve insight evidence records and source feature references.',
      priority: 2,
      contextMultiplier: 1
    }),
    new RetrievalStrategy({
      name: 'behavior_profile_lookup',
      supportedIntents: [INTENTS.COACHING, INTENTS.PREDICTIVE, INTENTS.REFLECTIVE, INTENTS.GOAL_PLANNING],
      description: 'Lookup aggregate behavior profile dimensions.',
      priority: 3,
      contextMultiplier: 0.6
    }),
    new RetrievalStrategy({
      name: 'historical_window_retrieval',
      supportedIntents: [INTENTS.COMPARATIVE, INTENTS.HISTORICAL_REVIEW, INTENTS.TREND_ANALYSIS, INTENTS.PREDICTIVE],
      description: 'Retrieve bounded historical windows for comparison.',
      priority: 4,
      contextMultiplier: 1.1
    }),
    new RetrievalStrategy({
      name: 'contest_timeline_retrieval',
      supportedIntents: [INTENTS.DIAGNOSTIC, INTENTS.COMPARATIVE, INTENTS.HISTORICAL_REVIEW],
      description: 'Retrieve contest-level timelines and summaries.',
      priority: 5,
      contextMultiplier: 1.2
    }),
    new RetrievalStrategy({
      name: 'session_reconstruction_retrieval',
      supportedIntents: [INTENTS.DIAGNOSTIC, INTENTS.EVIDENCE_REQUEST, INTENTS.HISTORICAL_REVIEW],
      description: 'Retrieve reconstructed session summaries and timelines.',
      priority: 6,
      contextMultiplier: 1.2
    }),
    new RetrievalStrategy({
      name: 'trend_aggregation',
      supportedIntents: [INTENTS.TREND_ANALYSIS, INTENTS.COMPARATIVE, INTENTS.GOAL_PLANNING],
      description: 'Retrieve precomputed historical aggregation windows.',
      priority: 7,
      contextMultiplier: 0.9
    }),
    new RetrievalStrategy({
      name: 'sql_retrieval',
      supportedIntents: [INTENTS.DIAGNOSTIC, INTENTS.COMPARATIVE, INTENTS.HISTORICAL_REVIEW, INTENTS.TREND_ANALYSIS, INTENTS.COACHING, INTENTS.GOAL_PLANNING],
      description: 'Use structured relational retrieval over canonical tables.',
      priority: 8,
      contextMultiplier: 1
    }),
    new RetrievalStrategy({
      name: 'hybrid_retrieval',
      supportedIntents: [INTENTS.DIAGNOSTIC, INTENTS.COACHING, INTENTS.PREDICTIVE, INTENTS.EXPLORATORY],
      description: 'Compose graph, feature, and historical retrieval sources.',
      priority: 9,
      contextMultiplier: 1.3
    }),
    new RetrievalStrategy({
      name: 'semantic_retrieval_future',
      supportedIntents: [INTENTS.EXPLORATORY, INTENTS.EVIDENCE_REQUEST, INTENTS.COACHING],
      description: 'Reserved strategy for future vector retrieval.',
      priority: 50,
      contextMultiplier: 0
    })
  ].forEach((strategy) => registry.register(strategy));

  return registry;
}

module.exports = { createDefaultStrategyRegistry };

