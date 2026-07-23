const { InsightRule } = require('./ruleContract');
const { latest, numericValue, confidence, insight } = require('./helpers');

class RecoveryStrengthRule extends InsightRule {
  constructor() {
    super({ id: 'recovery-strength', category: 'strength', version: 1 });
  }

  infer({ features }) {
    const persistence = latest(features, 'persistence_score');
    const recovery = latest(features, 'recovery_rate');
    if (!persistence || !recovery) return [];
    if (numericValue(persistence) < 0.65 || numericValue(recovery) < 0.55) return [];
    return [
      insight({
        ruleId: this.id,
        insightKey: 'strong_recovery_ability',
        insightType: 'Strength',
        category: this.category,
        confidence: confidence([persistence, recovery], 1.05),
        features: [persistence, recovery],
        sessions: [persistence.behavior_session_id, recovery.behavior_session_id],
        relationshipType: 'HAS_STRENGTH',
        targetNode: { nodeType: 'Strength', nodeKey: 'recovery_ability', label: 'Strong Recovery Ability' },
        properties: { persistence: numericValue(persistence), recoveryRate: numericValue(recovery) }
      })
    ];
  }
}

module.exports = { RecoveryStrengthRule };
