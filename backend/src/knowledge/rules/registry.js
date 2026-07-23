class InsightRuleRegistry {
  constructor() {
    this.rules = new Map();
  }

  register(rule) {
    if (this.rules.has(rule.id)) throw new Error(`Duplicate insight rule: ${rule.id}`);
    this.rules.set(rule.id, rule);
  }

  all() {
    return [...this.rules.values()];
  }
}

module.exports = { InsightRuleRegistry };
