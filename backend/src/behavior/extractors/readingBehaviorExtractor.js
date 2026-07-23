const { BehaviorFeatureExtractor } = require('./extractorContract');
const { avg, confidenceFromCount, feature } = require('./helpers');

class ReadingBehaviorExtractor extends BehaviorFeatureExtractor {
  constructor() {
    super({ id: 'reading-behavior', featureGroup: 'reading_behavior', version: 1 });
  }

  extract(session) {
    const problemDurations = session.problemTimeline.map((item) => item.durationMs);
    const switches = session.events.filter((event) => event.eventType === 'PROBLEM_SWITCHED').length;
    const rereads = session.problemTimeline.length - new Set(session.problemTimeline.map((item) => item.problemId)).size;
    const confidence = confidenceFromCount(session.events.length);
    const averageReadingMs = avg(problemDurations.slice(0, Math.min(3, problemDurations.length)));
    const consistency = problemDurations.length > 1
      ? 1 - Math.min(1, Math.abs(Math.max(...problemDurations) - Math.min(...problemDurations)) / Math.max(1, avg(problemDurations)))
      : 0.5;
    return [
      feature({ name: 'average_reading_time_ms', group: this.featureGroup, value: averageReadingMs, confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'reading_consistency', group: this.featureGroup, value: consistency, confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'reread_frequency', group: this.featureGroup, value: rereads / Math.max(1, session.problemTimeline.length), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'problem_scanning_speed', group: this.featureGroup, value: switches / Math.max(1, session.durationMs / 60000), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'reading_depth', group: this.featureGroup, value: Math.min(1, averageReadingMs / (8 * 60 * 1000)), confidence, extractorId: this.id, version: this.version() })
    ];
  }
}

module.exports = { ReadingBehaviorExtractor };
