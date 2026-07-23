const { InsightRule } = require('./ruleContract');
const { latest, numericValue, confidence, insight } = require('./helpers');

class RiskManagementRule extends InsightRule {
  constructor() {
    super({ id: 'risk-management', category: 'weakness', version: 1 });
  }

  infer({ features }) {
    const risk = latest(features, 'risk_appetite');
    const panic = latest(features, 'late_contest_panic');
    if (!risk || !panic) return [];
    if (numericValue(risk) < 0.65 || numericValue(panic) < 0.35) return [];
    return [
      insight({
        ruleId: this.id,
        insightKey: 'risk_management_weakness',
        insightType: 'Weakness',
        category: this.category,
        confidence: confidence([risk, panic]),
        features: [risk, panic],
        sessions: [risk.behavior_session_id, panic.behavior_session_id],
        relationshipType: 'HAS_WEAKNESS',
        targetNode: { nodeType: 'Weakness', nodeKey: 'risk_management', label: 'Risk Management Weakness' },
        properties: { riskAppetite: numericValue(risk), latePanic: numericValue(panic) }
      })
    ];
  }
}

module.exports = { RiskManagementRule };
