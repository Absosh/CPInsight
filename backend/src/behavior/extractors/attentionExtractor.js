const { BehaviorFeatureExtractor } = require('./extractorContract');
const { confidenceFromCount, feature, clamp } = require('./helpers');

class AttentionExtractor extends BehaviorFeatureExtractor {
  constructor() {
    super({ id: 'attention', featureGroup: 'attention', version: 1 });
  }

  extract(session) {
    const hidden = session.focusTimeline.filter((item) => item.type === 'TAB_HIDDEN').length;
    const visible = session.focusTimeline.filter((item) => item.type === 'TAB_VISIBLE').length;
    const switches = hidden + visible;
    const idleGaps = [];
    for (let index = 1; index < session.events.length; index += 1) {
      const gap = Date.parse(session.events[index].timestamp) - Date.parse(session.events[index - 1].timestamp);
      if (gap >= 5 * 60 * 1000) idleGaps.push(gap);
    }
    const idleMs = idleGaps.reduce((sum, gap) => sum + gap, 0);
    const confidence = confidenceFromCount(session.events.length);
    return [
      feature({ name: 'focus_duration_ms', group: this.featureGroup, value: Math.max(0, session.durationMs - idleMs), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'tab_switching_frequency', group: this.featureGroup, value: switches / Math.max(1, session.durationMs / 60000), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'context_switching', group: this.featureGroup, value: clamp(switches / Math.max(1, session.events.length)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'idle_ratio', group: this.featureGroup, value: clamp(idleMs / Math.max(1, session.durationMs)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'attention_stability', group: this.featureGroup, value: clamp(1 - switches / Math.max(1, session.events.length)), confidence, extractorId: this.id, version: this.version() })
    ];
  }
}

module.exports = { AttentionExtractor };
