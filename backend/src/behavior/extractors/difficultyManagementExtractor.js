const { BehaviorFeatureExtractor } = require('./extractorContract');
const { confidenceFromCount, feature, clamp } = require('./helpers');

function problemIndex(problemId) {
  const match = String(problemId || '').match(/[A-Z]/i);
  if (!match) return 0;
  return match[0].toUpperCase().charCodeAt(0) - 64;
}

class DifficultyManagementExtractor extends BehaviorFeatureExtractor {
  constructor() {
    super({ id: 'difficulty-management', featureGroup: 'difficulty_management', version: 1 });
  }

  extract(session) {
    const indexes = session.problemTimeline.map((item) => problemIndex(item.problemId));
    const confidence = confidenceFromCount(session.events.length);
    const escalation = indexes.filter((value, index) => index > 0 && value > indexes[index - 1]).length;
    const avoidance = indexes.filter((value) => value <= 2).length / Math.max(1, indexes.length);
    return [
      feature({ name: 'difficulty_escalation', group: this.featureGroup, value: clamp(escalation / Math.max(1, indexes.length - 1)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'difficulty_avoidance', group: this.featureGroup, value: clamp(avoidance), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'overcommitment', group: this.featureGroup, value: clamp(session.problemTimeline.filter((item) => item.durationMs > 25 * 60 * 1000).length / Math.max(1, indexes.length)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'challenge_preference', group: this.featureGroup, value: clamp(indexes.filter((value) => value >= 3).length / Math.max(1, indexes.length)), confidence, extractorId: this.id, version: this.version() })
    ];
  }
}

module.exports = { DifficultyManagementExtractor };
