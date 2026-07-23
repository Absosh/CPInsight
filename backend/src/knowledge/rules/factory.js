const { InsightRuleRegistry } = require('./registry');
const { ConceptualWeaknessRule } = require('./conceptualWeaknessRule');
const { RecoveryStrengthRule } = require('./recoveryStrengthRule');
const { RiskManagementRule } = require('./riskManagementRule');
const { TimeManagementRule } = require('./timeManagementRule');
const { RecurringLatePanicRule, DifficultyAvoidanceRule, FastRecognitionRule } = require('./patternRules');

function createDefaultInsightRuleRegistry() {
  const registry = new InsightRuleRegistry();
  registry.register(new ConceptualWeaknessRule());
  registry.register(new RecoveryStrengthRule());
  registry.register(new RiskManagementRule());
  registry.register(new TimeManagementRule());
  registry.register(new RecurringLatePanicRule());
  registry.register(new DifficultyAvoidanceRule());
  registry.register(new FastRecognitionRule());
  return registry;
}

module.exports = { createDefaultInsightRuleRegistry };
