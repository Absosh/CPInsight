const { FeatureExtractorRegistry } = require('./registry');
const { ReadingBehaviorExtractor } = require('./readingBehaviorExtractor');
const { DecisionMakingExtractor } = require('./decisionMakingExtractor');
const { ProblemSolvingExtractor } = require('./problemSolvingExtractor');
const { AttentionExtractor } = require('./attentionExtractor');
const { ContestStrategyExtractor } = require('./contestStrategyExtractor');
const { DifficultyManagementExtractor } = require('./difficultyManagementExtractor');
const { ProductivityExtractor } = require('./productivityExtractor');

function createDefaultExtractorRegistry() {
  const registry = new FeatureExtractorRegistry();
  registry.register(new ReadingBehaviorExtractor());
  registry.register(new DecisionMakingExtractor());
  registry.register(new ProblemSolvingExtractor());
  registry.register(new AttentionExtractor());
  registry.register(new ContestStrategyExtractor());
  registry.register(new DifficultyManagementExtractor());
  registry.register(new ProductivityExtractor());
  return registry;
}

module.exports = { createDefaultExtractorRegistry };
