class InsightRule {
  constructor({ id, category, version }) {
    this.id = id;
    this.category = category;
    this.ruleVersion = version;
  }

  async initialize() {}

  supports() {
    return true;
  }

  infer() {
    throw new Error(`${this.id} must implement infer(context)`);
  }

  confidence(features) {
    if (!features.length) return 0;
    return features.reduce((sum, feature) => sum + Number(feature.confidence || 0), 0) / features.length;
  }

  version() {
    return this.ruleVersion;
  }

  async destroy() {}
}

module.exports = { InsightRule };
