class ProviderAdapter {
  constructor({ provider, apiKey = null, baseUrl = null, priority = 10 }) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.priorityValue = priority;
    this.failures = 0;
    this.circuitOpenUntil = 0;
  }

  async initialize() {}

  supportsModel(model) {
    return model && model.provider === this.provider;
  }

  listModels() {
    return [];
  }

  estimateTokens(payload) {
    return Math.ceil(JSON.stringify(payload || '').length / 4);
  }

  estimateCost(model, tokenEstimate) {
    const promptRate = model.pricing && model.pricing.promptPer1k ? model.pricing.promptPer1k : 0;
    const completionRate = model.pricing && model.pricing.completionPer1k ? model.pricing.completionPer1k : 0;
    return Number((((tokenEstimate.promptTokens || 0) / 1000) * promptRate + ((tokenEstimate.maxOutputTokens || 0) / 1000) * completionRate).toFixed(6));
  }

  buildRequest() {
    throw new Error('ProviderAdapter.buildRequest must be implemented');
  }

  async invoke() {
    throw new Error('ProviderAdapter.invoke must be implemented');
  }

  async *stream() {
    throw new Error('ProviderAdapter.stream must be implemented');
  }

  health() {
    return {
      provider: this.provider,
      healthy: Boolean(this.apiKey || this.provider === 'ollama' || this.provider === 'vllm'),
      configured: Boolean(this.apiKey || this.provider === 'ollama' || this.provider === 'vllm'),
      circuitOpen: Date.now() < this.circuitOpenUntil,
      failures: this.failures
    };
  }

  cancel(requestId) {
    return { requestId, cancelled: true };
  }

  recordFailure(cooldownMs = 30000) {
    this.failures += 1;
    if (this.failures >= 3) this.circuitOpenUntil = Date.now() + cooldownMs;
  }

  recordSuccess() {
    this.failures = 0;
    this.circuitOpenUntil = 0;
  }

  async destroy() {}
}

module.exports = { ProviderAdapter };

