const { InsightRule } = require('./ruleContract');
const { latest, numericValue, confidence, insight } = require('./helpers');

class ConceptualWeaknessRule extends InsightRule {
  constructor() {
    super({ id: 'conceptual-weakness', category: 'weakness', version: 1 });
  }

  infer({ features }) {
    const reading = latest(features, 'average_reading_time_ms');
    const confidenceIndicator = latest(features, 'confidence_indicator');
    if (!reading || !confidenceIndicator) return [];
    const readingMs = numericValue(reading);
    const confidenceValue = numericValue(confidenceIndicator);
    if (readingMs < 8 * 60 * 1000 || confidenceValue > 0.45) return [];
    return [
      insight({
        ruleId: this.id,
        insightKey: 'conceptual_weakness',
        insightType: 'BehaviorPattern',
        category: this.category,
        confidence: confidence([reading, confidenceIndicator], 0.95),
        features: [reading, confidenceIndicator],
        sessions: [reading.behavior_session_id, confidenceIndicator.behavior_session_id],
        relationshipType: 'HAS_WEAKNESS',
        targetNode: { nodeType: 'Weakness', nodeKey: 'conceptual_weakness', label: 'Conceptual Weakness' },
        properties: { readingMs, confidenceIndicator: confidenceValue }
      })
    ];
  }
}

module.exports = { ConceptualWeaknessRule };
