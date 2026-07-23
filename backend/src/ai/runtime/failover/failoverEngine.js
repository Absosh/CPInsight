class FailoverEngine {
  constructor({ providerRegistry, modelRegistry }) {
    this.providerRegistry = providerRegistry;
    this.modelRegistry = modelRegistry;
  }

  candidates(primaryModel) {
    const health = new Map(this.providerRegistry.health().map((item) => [item.provider, item]));
    const fallbackOrder = ['openai', 'anthropic', 'gemini', 'azure_openai', 'openrouter', 'ollama', 'vllm'];
    return this.modelRegistry.all()
      .filter((model) => model.name !== primaryModel.name || model.provider !== primaryModel.provider)
      .filter((model) => model.contextWindow >= primaryModel.contextWindow * 0.5)
      .filter((model) => {
        const status = health.get(model.provider);
        return status && status.healthy && !status.circuitOpen;
      })
      .sort((a, b) => fallbackOrder.indexOf(a.provider) - fallbackOrder.indexOf(b.provider));
  }
}

module.exports = { FailoverEngine };

