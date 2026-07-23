const { PromptStrategy } = require('./promptStrategy');
const { PromptStrategyRegistry } = require('./strategyRegistry');

function createDefaultPromptStrategyRegistry() {
  const registry = new PromptStrategyRegistry();
  [
    ['diagnostic_strategy', ['diagnostic', 'behavior_explanation', 'weakness_analysis'], 'causal diagnosis', 'lead with supported causes and cite evidence'],
    ['comparative_strategy', ['comparative_analysis', 'trend_analysis', 'progress_evaluation'], 'comparison', 'contrast windows and explain differences'],
    ['reflection_strategy', ['contest_reflection', 'contest_review', 'session_review'], 'reflection', 'separate successes, mistakes, and lessons'],
    ['planning_strategy', ['learning_roadmap', 'goal_planning'], 'planning', 'organize milestones by feasibility and evidence'],
    ['recommendation_strategy', ['recommendation', 'coaching', 'motivational_coaching'], 'action selection', 'rank actions by confidence and usefulness'],
    ['prediction_strategy', ['prediction'], 'bounded forecast', 'state assumptions and uncertainty'],
    ['explanation_strategy', ['evidence_explanation', 'behavior_explanation'], 'evidence explanation', 'show observation-to-inference mapping'],
    ['evidence_strategy', ['evidence_explanation'], 'evidence audit', 'prioritize citations and missing evidence'],
    ['summary_strategy', ['historical_review', 'topic_analysis', 'strength_analysis', 'general_qa'], 'summary', 'compress high-signal findings'],
    ['meta_strategy', ['meta_analysis', 'unknown'], 'meta reasoning', 'explain limits and route uncertainty']
  ].forEach(([id, supportedTasks, focus, instructionProfile]) => registry.register(new PromptStrategy({ id, supportedTasks, focus, instructionProfile })));
  return registry;
}

module.exports = { createDefaultPromptStrategyRegistry };

