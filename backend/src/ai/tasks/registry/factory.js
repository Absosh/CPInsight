const { AITask } = require('./aiTask');
const { AITaskRegistry } = require('./taskRegistry');
const { REASONING_MODES } = require('../modes/reasoningModes');

const TASKS = [
  ['diagnostic', ['diagnostic'], ['why', 'cause', 'drop'], 1, REASONING_MODES.EVIDENCE_BASED, 'diagnostic', 'diagnostic_strategy', 'diagnostic', 'general', ['historical_review']],
  ['comparative_analysis', ['comparative'], ['compare', 'versus'], 2, REASONING_MODES.COMPARATIVE, 'comparison', 'comparative_strategy', 'general', 'general', []],
  ['contest_reflection', ['reflective'], ['reflect'], 6, REASONING_MODES.REFLECTIVE, 'reflection', 'reflection_strategy', 'general', 'general', []],
  ['contest_review', ['historical_review'], ['contest review'], 5, REASONING_MODES.HISTORICAL, 'reflection', 'reflection_strategy', 'general', 'general', []],
  ['coaching', ['coaching'], ['practice', 'coach', 'improve'], 3, REASONING_MODES.COACHING, 'roadmap', 'recommendation_strategy', 'coaching', 'coaching', ['recommendation']],
  ['learning_roadmap', ['goal_planning'], ['roadmap', 'learn'], 4, REASONING_MODES.PLANNING, 'roadmap', 'planning_strategy', 'planning', 'coaching', []],
  ['goal_planning', ['goal_planning'], ['goal', 'target', 'reach'], 3, REASONING_MODES.PLANNING, 'roadmap', 'planning_strategy', 'planning', 'coaching', []],
  ['trend_analysis', ['trend_analysis'], ['improving', 'trend', 'progress'], 2, REASONING_MODES.HISTORICAL, 'comparison', 'comparative_strategy', 'diagnostic', 'general', []],
  ['prediction', ['predictive'], ['predict', 'likely', 'can i'], 4, REASONING_MODES.PREDICTIVE, 'diagnostic', 'prediction_strategy', 'diagnostic', 'prediction', []],
  ['recommendation', ['coaching', 'predictive'], ['recommend', 'should'], 7, REASONING_MODES.COACHING, 'roadmap', 'recommendation_strategy', 'coaching', 'coaching', []],
  ['evidence_explanation', ['evidence_request'], ['evidence', 'prove', 'why do you think'], 0, REASONING_MODES.EXPLAINABLE, 'explanation', 'evidence_strategy', 'explanation', 'general', []],
  ['behavior_explanation', ['diagnostic', 'reflective'], ['behavior', 'pattern'], 4, REASONING_MODES.EXPLAINABLE, 'explanation', 'explanation_strategy', 'explanation', 'general', []],
  ['topic_analysis', ['comparative', 'coaching'], ['topic', 'dp', 'graph'], 8, REASONING_MODES.ANALYTICAL, 'summary', 'summary_strategy', 'general', 'general', []],
  ['strength_analysis', ['reflective'], ['strength'], 5, REASONING_MODES.ANALYTICAL, 'summary', 'summary_strategy', 'general', 'general', []],
  ['weakness_analysis', ['diagnostic', 'reflective'], ['weakness', 'mistake'], 5, REASONING_MODES.ANALYTICAL, 'diagnostic', 'diagnostic_strategy', 'diagnostic', 'general', []],
  ['session_review', ['historical_review'], ['session'], 7, REASONING_MODES.HISTORICAL, 'reflection', 'reflection_strategy', 'general', 'general', []],
  ['historical_review', ['historical_review'], ['last', 'past', 'review'], 4, REASONING_MODES.HISTORICAL, 'summary', 'summary_strategy', 'general', 'general', []],
  ['progress_evaluation', ['trend_analysis'], ['progress', 'improving'], 3, REASONING_MODES.COMPARATIVE, 'comparison', 'comparative_strategy', 'diagnostic', 'general', []],
  ['motivational_coaching', ['coaching', 'reflective'], ['motivate', 'confidence'], 9, REASONING_MODES.COACHING, 'summary', 'recommendation_strategy', 'coaching', 'coaching', []],
  ['meta_analysis', ['exploratory'], ['interesting', 'meta'], 10, REASONING_MODES.ANALYTICAL, 'summary', 'meta_strategy', 'general', 'general', []],
  ['general_qa', ['exploratory'], ['what', 'how'], 12, REASONING_MODES.EVIDENCE_BASED, 'summary', 'summary_strategy', 'general', 'general', []],
  ['unknown', ['unknown'], [], 99, REASONING_MODES.EVIDENCE_BASED, 'summary', 'meta_strategy', 'general', 'general', []]
];

function createDefaultAITaskRegistry() {
  const registry = new AITaskRegistry();
  TASKS.forEach(([taskType, supportedIntents, keywords, basePriority, reasoningMode, schemaName, strategyName, evaluationGroup, policyGroup, chainedTasks]) => {
    registry.register(new AITask({ taskType, supportedIntents, keywords, basePriority, reasoningMode, schemaName, strategyName, evaluationGroup, policyGroup, chainedTasks }));
  });
  return registry;
}

module.exports = { createDefaultAITaskRegistry, TASKS };
