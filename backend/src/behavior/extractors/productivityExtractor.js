const { BehaviorFeatureExtractor } = require('./extractorContract');
const { confidenceFromCount, feature, clamp } = require('./helpers');

class ProductivityExtractor extends BehaviorFeatureExtractor {
  constructor() {
    super({ id: 'productivity', featureGroup: 'productivity', version: 1 });
  }

  extract(session) {
    const idleGaps = [];
    for (let index = 1; index < session.events.length; index += 1) {
      const gap = Date.parse(session.events[index].timestamp) - Date.parse(session.events[index - 1].timestamp);
      if (gap >= 5 * 60 * 1000) idleGaps.push(gap);
    }
    const idleMs = idleGaps.reduce((sum, gap) => sum + gap, 0);
    const activeRatio = clamp((session.durationMs - idleMs) / Math.max(1, session.durationMs));
    const confidence = confidenceFromCount(session.events.length);
    return [
      feature({ name: 'active_coding_ratio', group: this.featureGroup, value: clamp(session.submissionTimeline.length / Math.max(1, session.events.length)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'thinking_ratio', group: this.featureGroup, value: clamp(activeRatio - session.submissionTimeline.length / Math.max(1, session.events.length)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'idle_ratio', group: this.featureGroup, value: clamp(idleMs / Math.max(1, session.durationMs)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'momentum_score', group: this.featureGroup, value: clamp(session.events.length / Math.max(1, session.durationMs / 600000)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'flow_score', group: this.featureGroup, value: clamp(activeRatio * (1 - idleGaps.length / Math.max(1, session.events.length))), confidence, extractorId: this.id, version: this.version() })
    ];
  }
}

module.exports = { ProductivityExtractor };
