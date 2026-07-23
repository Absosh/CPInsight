const { PlannerRuleRegistry } = require('./registry');
const {
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
} = require('./defaultRules');

function createDefaultPlannerRuleRegistry() {
  const registry = new PlannerRuleRegistry();
  [
    new EvidenceRequestRule(),
    new DiagnosticRule(),
    new ComparativeRule(),
    new TrendAnalysisRule(),
    new PredictiveRule(),
    new CoachingRule(),
    new GoalPlanningRule(),
    new ReflectiveRule(),
    new HistoricalReviewRule(),
    new ExploratoryRule()
  ].forEach((rule) => registry.register(rule));
  return registry;
}

module.exports = { createDefaultPlannerRuleRegistry };

