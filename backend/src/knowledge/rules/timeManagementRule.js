const { InsightRule } = require('./ruleContract');
const { latest, numericValue, confidence, insight } = require('./helpers');

class TimeManagementRule extends InsightRule {
  constructor() {
    super({ id: 'time-management-strength', category: 'strength', version: 1 });
  }

  infer({ features }) {
    const focus = latest(features, 'attention_stability');
    const panic = latest(features, 'late_contest_panic');
    if (!focus || !panic) return [];
    if (numericValue(focus) < 0.7 || numericValue(panic) > 0.25) return [];
    return [
      insight({
        ruleId: this.id,
        insightKey: 'strong_time_management',
        insightType: 'Strength',
        category: this.category,
        confidence: confidence([focus, panic]),
        features: [focus, panic],
        sessions: [focus.behavior_session_id, panic.behavior_session_id],
        relationshipType: 'HAS_STRENGTH',
        targetNode: { nodeType: 'Strength', nodeKey: 'time_management', label: 'Strong Time Management' },
        properties: { attentionStability: numericValue(focus), latePanic: numericValue(panic) }
      })
    ];
  }
}

module.exports = { TimeManagementRule };
