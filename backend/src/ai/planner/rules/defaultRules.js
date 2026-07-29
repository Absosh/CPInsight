const { INTENTS } = require('../intents/intentTaxonomy');
const { PlannerRule } = require('./plannerRule');

function selectSources(sources, preferredNames) {
  const byName = new Map(sources.map((source) => [source.metadata().name, source]));
  return preferredNames.map((name) => byName.get(name)).filter(Boolean);
}

function sourcePlan(source, priority) {
  const metadata = source.metadata();
  return {
    name: metadata.name,
    priority,
    estimatedCost: metadata.estimatedCost,
    estimatedLatencyMs: metadata.estimatedLatencyMs,
    requiredConfidence: metadata.requiredConfidence,
    limit: metadata.defaultLimit,
    contextTokenEstimate: metadata.contextTokenEstimate
  };
}

function buildPlan({ rule, intent, sources, strategies, preferredSources, preferredStrategies, evidenceTypes }) {
  const selectedSources = selectSources(sources, preferredSources).map((source, index) => sourcePlan(source, index + 1));
  const strategyNames = new Set(preferredStrategies);
  const selectedStrategies = strategies
    .map((strategy) => strategy.metadata())
    .filter((strategy) => strategyNames.has(strategy.name))
    .sort((a, b) => a.priority - b.priority);
  const estimatedLatencyMs = selectedSources.reduce((sum, source) => sum + source.estimatedLatencyMs, 0);
  const estimatedCost = selectedSources.reduce((sum, source) => sum + source.estimatedCost, 0);
  const estimatedContextTokens = selectedSources.reduce((sum, source) => sum + source.contextTokenEstimate, 0);
  const requiredConfidence = Math.max(rule.requiredConfidence, ...selectedSources.map((source) => source.requiredConfidence));
  return {
    ruleId: rule.id,
    intent,
    evidenceTypes,
    sources: selectedSources,
    strategies: selectedStrategies,
    confidencePlan: {
      requiredConfidence,
      expectedEvidenceQuality: selectedSources.length ? Number((selectedSources.reduce((sum, source) => sum + source.requiredConfidence, 0) / selectedSources.length).toFixed(4)) : 0,
      minimumSupportingSessions: rule.minimumSupportingSessions,
      minimumHistoricalCoverageDays: rule.minimumHistoricalCoverageDays,
      evidenceSufficiency: selectedSources.length ? 'requires_retrieval' : 'insufficient'
    },
    tokenBudget: {
      estimatedContextTokens,
      maximumContextTokens: 6000,
      retrievalLimit: selectedSources.reduce((sum, source) => sum + source.limit, 0),
      priorityPolicy: 'highest_priority_sources_first'
    },
    estimates: {
      estimatedCost,
      estimatedLatencyMs
    }
  };
}

class DiagnosticRule extends PlannerRule {
  constructor() {
    super({ id: 'diagnostic-planning-rule', supportedIntents: [INTENTS.DIAGNOSTIC], basePriority: 1, requiredConfidence: 0.85, minimumSupportingSessions: 2, minimumHistoricalCoverageDays: 14 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.DIAGNOSTIC,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['behavior_knowledge_graph', 'behavior_insights', 'topic_performance', 'evidence_store', 'contest_history', 'session_summaries', 'feature_versions'],
      preferredStrategies: ['knowledge_graph_traversal', 'evidence_chain_retrieval', 'contest_timeline_retrieval', 'session_reconstruction_retrieval', 'sql_retrieval'],
      evidenceTypes: ['knowledge_edges', 'insight_evidence', 'contest_outcomes', 'session_timelines']
    });
  }
}

class ComparativeRule extends PlannerRule {
  constructor() {
    super({ id: 'comparative-planning-rule', supportedIntents: [INTENTS.COMPARATIVE], basePriority: 2, requiredConfidence: 0.78, minimumSupportingSessions: 2, minimumHistoricalCoverageDays: 7 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.COMPARATIVE,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['contest_summaries', 'contest_history', 'historical_aggregations', 'behavior_features', 'topic_performance', 'platform_statistics'],
      preferredStrategies: ['historical_window_retrieval', 'contest_timeline_retrieval', 'trend_aggregation', 'sql_retrieval'],
      evidenceTypes: ['historical_windows', 'contest_summaries', 'feature_comparisons']
    });
  }
}

class PredictiveRule extends PlannerRule {
  constructor() {
    super({ id: 'predictive-planning-rule', supportedIntents: [INTENTS.PREDICTIVE], basePriority: 3, requiredConfidence: 0.82, minimumSupportingSessions: 5, minimumHistoricalCoverageDays: 30 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.PREDICTIVE,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['behavior_profiles', 'historical_aggregations', 'topic_performance', 'behavior_features', 'user_metadata'],
      preferredStrategies: ['behavior_profile_lookup', 'historical_window_retrieval', 'trend_aggregation', 'hybrid_retrieval'],
      evidenceTypes: ['profile_dimensions', 'historical_trends', 'topic_performance']
    });
  }
}

class CoachingRule extends PlannerRule {
  constructor() {
    super({ id: 'coaching-planning-rule', supportedIntents: [INTENTS.COACHING], basePriority: 4, requiredConfidence: 0.8, minimumSupportingSessions: 3, minimumHistoricalCoverageDays: 21 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.COACHING,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['behavior_knowledge_graph', 'behavior_profiles', 'behavior_insights', 'topic_performance', 'historical_aggregations', 'user_metadata'],
      preferredStrategies: ['knowledge_graph_traversal', 'behavior_profile_lookup', 'trend_aggregation', 'hybrid_retrieval'],
      evidenceTypes: ['strengths', 'weaknesses', 'patterns', 'topic_gaps']
    });
  }
}

class ReflectiveRule extends PlannerRule {
  constructor() {
    super({ id: 'reflective-planning-rule', supportedIntents: [INTENTS.REFLECTIVE], basePriority: 5, requiredConfidence: 0.75, minimumSupportingSessions: 2, minimumHistoricalCoverageDays: 14 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.REFLECTIVE,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['behavior_knowledge_graph', 'behavior_profiles', 'behavior_insights', 'topic_performance', 'pattern_evolution', 'evidence_store'],
      preferredStrategies: ['knowledge_graph_traversal', 'behavior_profile_lookup', 'evidence_chain_retrieval'],
      evidenceTypes: ['profile_dimensions', 'patterns', 'evidence_chains']
    });
  }
}

class EvidenceRequestRule extends PlannerRule {
  constructor() {
    super({ id: 'evidence-request-planning-rule', supportedIntents: [INTENTS.EVIDENCE_REQUEST], basePriority: 1, requiredConfidence: 0.88, minimumSupportingSessions: 1, minimumHistoricalCoverageDays: 0 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.EVIDENCE_REQUEST,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['evidence_store', 'behavior_knowledge_graph', 'behavior_insights', 'behavior_features', 'session_summaries', 'feature_versions'],
      preferredStrategies: ['evidence_chain_retrieval', 'knowledge_graph_traversal', 'session_reconstruction_retrieval'],
      evidenceTypes: ['insight_evidence', 'supporting_features', 'source_sessions']
    });
  }
}

class HistoricalReviewRule extends PlannerRule {
  constructor() {
    super({ id: 'historical-review-planning-rule', supportedIntents: [INTENTS.HISTORICAL_REVIEW], basePriority: 6, requiredConfidence: 0.72, minimumSupportingSessions: 2, minimumHistoricalCoverageDays: 14 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.HISTORICAL_REVIEW,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['contest_history', 'contest_summaries', 'session_summaries', 'historical_aggregations', 'pattern_evolution', 'platform_statistics'],
      preferredStrategies: ['historical_window_retrieval', 'contest_timeline_retrieval', 'session_reconstruction_retrieval', 'trend_aggregation'],
      evidenceTypes: ['contest_windows', 'session_windows', 'pattern_history']
    });
  }
}

class TrendAnalysisRule extends PlannerRule {
  constructor() {
    super({ id: 'trend-analysis-planning-rule', supportedIntents: [INTENTS.TREND_ANALYSIS], basePriority: 3, requiredConfidence: 0.8, minimumSupportingSessions: 4, minimumHistoricalCoverageDays: 28 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.TREND_ANALYSIS,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['historical_aggregations', 'pattern_evolution', 'behavior_features', 'contest_summaries', 'platform_statistics'],
      preferredStrategies: ['trend_aggregation', 'historical_window_retrieval', 'sql_retrieval'],
      evidenceTypes: ['time_series', 'windowed_features', 'pattern_evolution']
    });
  }
}

class GoalPlanningRule extends PlannerRule {
  constructor() {
    super({ id: 'goal-planning-rule', supportedIntents: [INTENTS.GOAL_PLANNING], basePriority: 4, requiredConfidence: 0.78, minimumSupportingSessions: 3, minimumHistoricalCoverageDays: 21 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.GOAL_PLANNING,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['behavior_profiles', 'behavior_insights', 'topic_performance', 'historical_aggregations', 'user_metadata'],
      preferredStrategies: ['behavior_profile_lookup', 'trend_aggregation', 'sql_retrieval'],
      evidenceTypes: ['current_profile', 'topic_gaps', 'historical_velocity']
    });
  }
}

class ExploratoryRule extends PlannerRule {
  constructor() {
    super({ id: 'exploratory-planning-rule', supportedIntents: [INTENTS.EXPLORATORY], basePriority: 9, requiredConfidence: 0.65, minimumSupportingSessions: 1, minimumHistoricalCoverageDays: 0 });
  }

  plan(context) {
    return buildPlan({
      rule: this,
      intent: INTENTS.EXPLORATORY,
      sources: context.sources,
      strategies: context.strategies,
      preferredSources: ['behavior_knowledge_graph', 'behavior_insights', 'pattern_evolution', 'behavior_profiles'],
      preferredStrategies: ['knowledge_graph_traversal', 'hybrid_retrieval'],
      evidenceTypes: ['salient_patterns', 'strengths', 'weaknesses']
    });
  }
}

module.exports = {
  DiagnosticRule,
  ComparativeRule,
  PredictiveRule,
  CoachingRule,
  ReflectiveRule,
  EvidenceRequestRule,
  HistoricalReviewRule,
  TrendAnalysisRule,
  GoalPlanningRule,
  ExploratoryRule
};
