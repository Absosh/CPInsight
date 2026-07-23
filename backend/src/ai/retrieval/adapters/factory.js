const pool = require('../../../database/pool');
const behaviorRepository = require('../../../repositories/behaviorRepository');
const knowledgeRepository = require('../../../repositories/knowledgeRepository');
const { AdapterRegistry } = require('./registry');
const {
  BehaviorProfilesAdapter,
  BehaviorFeaturesAdapter,
  KnowledgeGraphAdapter,
  BehaviorInsightsAdapter,
  EvidenceStoreAdapter,
  ContestHistoryAdapter,
  ContestSummariesAdapter,
  SessionSummariesAdapter,
  HistoricalAggregationsAdapter,
  TopicPerformanceAdapter,
  PlatformStatisticsAdapter,
  UserMetadataAdapter,
  FeatureVersionsAdapter,
  PatternEvolutionAdapter,
  FutureStubAdapter
} = require('./sqlAdapters');

function createDefaultAdapterRegistry({ db = pool, behaviorRepo = behaviorRepository, knowledgeRepo = knowledgeRepository } = {}) {
  const registry = new AdapterRegistry();
  [
    new BehaviorProfilesAdapter({ behaviorRepository: behaviorRepo }),
    new BehaviorFeaturesAdapter({ behaviorRepository: behaviorRepo }),
    new KnowledgeGraphAdapter({ knowledgeRepository: knowledgeRepo }),
    new BehaviorInsightsAdapter({ knowledgeRepository: knowledgeRepo }),
    new EvidenceStoreAdapter({ db }),
    new ContestHistoryAdapter({ db }),
    new ContestSummariesAdapter({ db }),
    new SessionSummariesAdapter({ behaviorRepository: behaviorRepo }),
    new HistoricalAggregationsAdapter({ behaviorRepository: behaviorRepo }),
    new TopicPerformanceAdapter({ db }),
    new PlatformStatisticsAdapter({ db }),
    new UserMetadataAdapter({ db }),
    new FeatureVersionsAdapter({ db }),
    new PatternEvolutionAdapter({ knowledgeRepository: knowledgeRepo }),
    new FutureStubAdapter('future_vector_store'),
    new FutureStubAdapter('future_conversation_memory')
  ].forEach((adapter) => registry.register(adapter));
  return registry;
}

module.exports = { createDefaultAdapterRegistry };
