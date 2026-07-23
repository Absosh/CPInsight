class PlannerRule {
  constructor({ id, supportedIntents, ruleVersion = 1, basePriority = 10, requiredConfidence = 0.7, minimumSupportingSessions = 1, minimumHistoricalCoverageDays = 0 }) {
    this.id = id;
    this.supportedIntents = new Set(supportedIntents);
    this.ruleVersion = ruleVersion;
    this.basePriority = basePriority;
    this.requiredConfidence = requiredConfidence;
    this.minimumSupportingSessions = minimumSupportingSessions;
    this.minimumHistoricalCoverageDays = minimumHistoricalCoverageDays;
  }

  async initialize() {}

  supportsIntent(intent) {
    return this.supportedIntents.has(intent);
  }

  priority() {
    return this.basePriority;
  }

  version() {
    return this.ruleVersion;
  }

  plan() {
    throw new Error('PlannerRule.plan must be implemented');
  }

  async destroy() {}
}

module.exports = { PlannerRule };

