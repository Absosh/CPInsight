class PlannerRuleRegistry {
  constructor() {
    this.rules = new Map();
  }

  register(rule) {
    if (!rule || typeof rule.supportsIntent !== 'function' || typeof rule.plan !== 'function') {
      throw new Error('Invalid planner rule');
    }
    if (this.rules.has(rule.id)) throw new Error(`Duplicate planner rule: ${rule.id}`);
    this.rules.set(rule.id, rule);
    return this;
  }

  all() {
    return [...this.rules.values()].sort((a, b) => a.priority() - b.priority());
  }

  forIntent(intent) {
    return this.all().filter((rule) => rule.supportsIntent(intent));
  }
}

module.exports = { PlannerRuleRegistry };

