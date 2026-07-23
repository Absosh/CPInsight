class SourceAdapter {
  constructor({ name, reliability = 0.8, timeoutMs = 500 }) {
    this.name = name;
    this.reliability = reliability;
    this.timeoutMs = timeoutMs;
  }

  async initialize() {}

  supports(source) {
    return source && source.name === this.name;
  }

  estimateCost(source) {
    return source ? source.estimatedCost || 1 : 1;
  }

  async retrieve() {
    throw new Error('SourceAdapter.retrieve must be implemented');
  }

  health() {
    return { name: this.name, healthy: true, reliability: this.reliability };
  }

  async destroy() {}
}

module.exports = { SourceAdapter };

