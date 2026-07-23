class BehaviorFeatureExtractor {
  constructor({ id, featureGroup, version }) {
    this.id = id;
    this.featureGroup = featureGroup;
    this.extractorVersion = version;
  }

  async initialize() {}

  supports() {
    return true;
  }

  extract() {
    throw new Error(`${this.id} must implement extract(session, context)`);
  }

  confidence(session) {
    const eventCount = session.events?.length || 0;
    return Math.max(0.1, Math.min(0.95, eventCount / 20));
  }

  version() {
    return this.extractorVersion;
  }

  async destroy() {}
}

module.exports = { BehaviorFeatureExtractor };
