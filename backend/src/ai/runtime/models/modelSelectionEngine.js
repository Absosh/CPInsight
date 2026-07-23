class ModelSelectionEngine {
  constructor({ modelRegistry, providerRegistry }) {
    this.modelRegistry = modelRegistry;
    this.providerRegistry = providerRegistry;
  }

  select({ executionPlan, promptPackage, override = {} }) {
    if (override.provider && override.model) {
      const manual = this.modelRegistry.find(override.provider, override.model);
      if (!manual) throw new Error(`Manual model override is unavailable: ${override.provider}/${override.model}`);
      return { model: manual, reason: 'manual_override' };
    }

    const promptTokens = promptPackage.audit ? promptPackage.audit.promptSizeTokens || 0 : 0;
    const needsJSON = (executionPlan.outputSchemas || []).length > 0;
    const preferredModes = new Set(executionPlan.reasoningModes || []);
    const providerHealth = new Map(this.providerRegistry.health().map((item) => [item.provider, item]));
    const candidates = this.modelRegistry.all()
      .filter((model) => model.contextWindow >= promptTokens + Math.min(model.maxOutputTokens, 4096))
      .filter((model) => !needsJSON || model.supportsJSON || ['anthropic', 'ollama', 'vllm'].includes(model.provider))
      .filter((model) => {
        const health = providerHealth.get(model.provider);
        return health && health.healthy && !health.circuitOpen;
      })
      .map((model) => {
        const cost = ((promptTokens / 1000) * model.pricing.promptPer1k) + ((model.maxOutputTokens / 1000) * model.pricing.completionPer1k);
        const providerRank = ['openai', 'anthropic', 'gemini', 'azure_openai', 'openrouter', 'ollama', 'vllm'].indexOf(model.provider);
        const providerPriorityScore = 1 / (1 + (providerRank < 0 ? 99 : providerRank));
        const jsonBoost = needsJSON && model.supportsJSON ? 0.5 : 0;
        const localBoost = model.pricing.promptPer1k === 0 ? 0.05 : 0;
        const reasoningBoost = preferredModes.has('analytical') && model.contextWindow >= 128000 ? 0.1 : 0;
        const costScore = 1 / (1 + cost * 1000);
        const score = providerPriorityScore * 0.5 + jsonBoost + costScore * 0.1 + (model.contextWindow / 1000000) * 0.25 + localBoost + reasoningBoost;
        return { model, score };
      })
      .sort((a, b) => b.score - a.score || a.model.provider.localeCompare(b.model.provider));

    if (!candidates.length) throw new Error('No healthy model can satisfy the execution plan');
    return { model: candidates[0].model, reason: 'automatic_selection' };
  }
}

module.exports = { ModelSelectionEngine };
