class RetrievalSource {
  constructor({ name, supportedIntents, estimatedCost, estimatedLatencyMs, requiredConfidence, defaultLimit, contextTokenEstimate }) {
    this.name = name;
    this.supportedIntents = new Set(supportedIntents);
    this.estimatedCost = estimatedCost;
    this.estimatedLatencyMs = estimatedLatencyMs;
    this.requiredConfidence = requiredConfidence;
    this.defaultLimit = defaultLimit;
    this.contextTokenEstimate = contextTokenEstimate;
  }

  supportsIntent(intent) {
    return this.supportedIntents.has(intent);
  }

  metadata() {
    return Object.freeze({
      name: this.name,
      supportedIntents: [...this.supportedIntents],
      estimatedCost: this.estimatedCost,
      estimatedLatencyMs: this.estimatedLatencyMs,
      requiredConfidence: this.requiredConfidence,
      defaultLimit: this.defaultLimit,
      contextTokenEstimate: this.contextTokenEstimate
    });
  }
}

module.exports = { RetrievalSource };

