const { BehaviorFeatureExtractor } = require('./extractorContract');
const { confidenceFromCount, feature, clamp } = require('./helpers');

class DecisionMakingExtractor extends BehaviorFeatureExtractor {
  constructor() {
    super({ id: 'decision-making', featureGroup: 'decision_making', version: 1 });
  }

  extract(session) {
    const firstProblem = session.problemTimeline[0];
    const firstAttempt = session.submissionTimeline[0];
    const timeBeforeFirstAttempt = firstAttempt
      ? Date.parse(firstAttempt.at) - Date.parse(session.startedAt)
      : session.durationMs;
    const shortVisits = session.problemTimeline.filter((item) => item.durationMs < 2 * 60 * 1000).length;
    const confidence = confidenceFromCount(session.events.length);
    const decisionLatency = firstProblem ? Date.parse(firstProblem.startedAt) - Date.parse(session.startedAt) : 0;
    return [
      feature({ name: 'time_before_first_attempt_ms', group: this.featureGroup, value: Math.max(0, timeBeforeFirstAttempt), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'decision_latency_ms', group: this.featureGroup, value: Math.max(0, decisionLatency), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'hesitation_score', group: this.featureGroup, value: clamp(shortVisits / Math.max(1, session.problemTimeline.length)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'early_abandonment', group: this.featureGroup, value: session.status === 'abandoned' && session.durationMs < 10 * 60 * 1000 ? 1 : 0, confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'confidence_indicator', group: this.featureGroup, value: clamp(1 - (timeBeforeFirstAttempt / Math.max(1, session.durationMs))), confidence, extractorId: this.id, version: this.version() })
    ];
  }
}

module.exports = { DecisionMakingExtractor };
