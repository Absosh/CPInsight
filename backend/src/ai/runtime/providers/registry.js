class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(provider) {
    if (!provider || !provider.provider || typeof provider.invoke !== 'function') throw new Error('Invalid LLM provider');
    if (this.providers.has(provider.provider)) throw new Error(`Duplicate LLM provider: ${provider.provider}`);
    this.providers.set(provider.provider, provider);
    return this;
  }

  get(provider) {
    return this.providers.get(provider) || null;
  }

  all() {
    return [...this.providers.values()].sort((a, b) => a.priorityValue - b.priorityValue);
  }

  health() {
    return this.all().map((provider) => provider.health());
  }
}

module.exports = { ProviderRegistry };

