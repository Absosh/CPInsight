const { InsightRule } = require('./ruleContract');
const { byName, numericValue, confidence, insight } = require('./helpers');

function recurring(features, name, threshold, direction = 'gte') {
  return byName(features, name).filter((feature) => {
    const value = numericValue(feature);
    return direction === 'gte' ? value >= threshold : value <= threshold;
  });
}

class RecurringLatePanicRule extends InsightRule {
  constructor() {
    super({ id: 'recurring-late-panic', category: 'pattern', version: 1 });
  }

  infer({ features }) {
    const matches = recurring(features, 'late_contest_panic', 0.35);
    if (matches.length < 2) return [];
    return [insight({
      ruleId: this.id,
      insightKey: 'repeated_late_panic',
      insightType: 'BehaviorPattern',
      category: this.category,
      confidence: confidence(matches),
      features: matches,
      sessions: matches.map((feature) => feature.behavior_session_id),
      relationshipType: 'HAS_PATTERN',
      targetNode: { nodeType: 'BehaviorPattern', nodeKey: 'late_panic', label: 'Repeated Late Contest Panic' },
      properties: { recurrenceCount: matches.length }
    })];
  }
}

class DifficultyAvoidanceRule extends InsightRule {
  constructor() {
    super({ id: 'difficulty-avoidance-pattern', category: 'pattern', version: 1 });
  }

  infer({ features }) {
    const matches = recurring(features, 'difficulty_avoidance', 0.7);
    if (matches.length < 2) return [];
    return [insight({
      ruleId: this.id,
      insightKey: 'difficulty_avoidance',
      insightType: 'BehaviorPattern',
      category: this.category,
      confidence: confidence(matches),
      features: matches,
      sessions: matches.map((feature) => feature.behavior_session_id),
      relationshipType: 'HAS_PATTERN',
      targetNode: { nodeType: 'BehaviorPattern', nodeKey: 'difficulty_avoidance', label: 'Difficulty Avoidance' },
      properties: { recurrenceCount: matches.length }
    })];
  }
}

class FastRecognitionRule extends InsightRule {
  constructor() {
    super({ id: 'fast-recognition', category: 'strength', version: 1 });
  }

  infer({ features }) {
    const scanning = recurring(features, 'problem_scanning_speed', 0.4);
    const confidenceIndicators = recurring(features, 'confidence_indicator', 0.65);
    if (!scanning.length || !confidenceIndicators.length) return [];
    return [insight({
      ruleId: this.id,
      insightKey: 'fast_recognition',
      insightType: 'Strength',
      category: this.category,
      confidence: confidence([...scanning, ...confidenceIndicators]),
      features: [...scanning, ...confidenceIndicators],
      sessions: [...scanning, ...confidenceIndicators].map((feature) => feature.behavior_session_id),
      relationshipType: 'HAS_STRENGTH',
      targetNode: { nodeType: 'Strength', nodeKey: 'fast_recognition', label: 'Fast Recognition' },
      properties: { scanningEvidence: scanning.length, confidenceEvidence: confidenceIndicators.length }
    })];
  }
}

module.exports = { RecurringLatePanicRule, DifficultyAvoidanceRule, FastRecognitionRule };
