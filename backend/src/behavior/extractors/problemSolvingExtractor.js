const { BehaviorFeatureExtractor } = require('./extractorContract');
const { confidenceFromCount, feature, clamp } = require('./helpers');

class ProblemSolvingExtractor extends BehaviorFeatureExtractor {
  constructor() {
    super({ id: 'problem-solving', featureGroup: 'problem_solving', version: 1 });
  }

  extract(session) {
    const retryCount = Math.max(0, session.submissionTimeline.length - new Set(session.submissionTimeline.map((item) => item.problemId)).size);
    const revisits = session.problemTimeline.length - new Set(session.problemTimeline.map((item) => item.problemId)).size;
    const confidence = confidenceFromCount(session.events.length);
    return [
      feature({ name: 'retry_count', group: this.featureGroup, value: retryCount, confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'recovery_rate', group: this.featureGroup, value: clamp(revisits / Math.max(1, retryCount + revisits)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'persistence_score', group: this.featureGroup, value: clamp(session.durationMs / (90 * 60 * 1000)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'exploration_score', group: this.featureGroup, value: clamp(new Set(session.problemTimeline.map((item) => item.problemId)).size / Math.max(1, session.problemTimeline.length)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'strategy_switching', group: this.featureGroup, value: clamp(revisits / Math.max(1, session.problemTimeline.length)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'submission_cadence_per_hour', group: this.featureGroup, value: session.submissionTimeline.length / Math.max(1, session.durationMs / 3600000), confidence, extractorId: this.id, version: this.version() })
    ];
  }
}

module.exports = { ProblemSolvingExtractor };
