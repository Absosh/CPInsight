const { BehaviorFeatureExtractor } = require('./extractorContract');
const { confidenceFromCount, feature, clamp } = require('./helpers');

class ContestStrategyExtractor extends BehaviorFeatureExtractor {
  constructor() {
    super({ id: 'contest-strategy', featureGroup: 'contest_strategy', version: 1 });
  }

  supports(session) {
    return session.sessionType === 'contest';
  }

  extract(session, context = {}) {
    const contest = context.contest;
    const sequence = contest?.problemSequence || [];
    const allocations = contest?.timeAllocation || [];
    const lateEvents = session.events.filter((event) => Date.parse(event.timestamp) - Date.parse(session.startedAt) > session.durationMs * 0.75).length;
    const confidence = confidenceFromCount(session.events.length);
    const sortedProblems = sequence.every((item, index, list) => index === 0 || String(list[index - 1].problemId) <= String(item.problemId));
    const maxAllocation = Math.max(0, ...allocations.map((item) => item.ratio));
    return [
      feature({ name: 'problem_ordering', group: this.featureGroup, value: sortedProblems ? 'ascending' : 'adaptive', confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'time_allocation_balance', group: this.featureGroup, value: clamp(1 - maxAllocation), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'risk_appetite', group: this.featureGroup, value: clamp(sequence.length / Math.max(1, session.durationMs / 1800000)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'greedy_solving_tendency', group: this.featureGroup, value: sortedProblems ? 0.8 : 0.35, confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'late_contest_panic', group: this.featureGroup, value: clamp(lateEvents / Math.max(1, session.events.length)), confidence, extractorId: this.id, version: this.version() }),
      feature({ name: 'comeback_behavior', group: this.featureGroup, value: clamp((contest?.recoveryPeriods?.length || 0) / Math.max(1, contest?.idlePeriods?.length || 1)), confidence, extractorId: this.id, version: this.version() })
    ];
  }
}

module.exports = { ContestStrategyExtractor };
