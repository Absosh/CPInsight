class ProviderAdapter {
  constructor({ name, supported = true }) {
    this.name = name;
    this.supported = supported;
  }

  metadata() {
    return { name: this.name, supported: this.supported, providerIndependent: true };
  }
}

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(adapter) {
    if (!adapter || !adapter.name || typeof adapter.metadata !== 'function') throw new Error('Invalid provider adapter');
    if (this.providers.has(adapter.name)) throw new Error(`Duplicate provider adapter: ${adapter.name}`);
    this.providers.set(adapter.name, adapter);
    return this;
  }

  all() {
    return [...this.providers.values()].map((adapter) => adapter.metadata());
  }
}

function createDefaultProviderRegistry() {
  const registry = new ProviderRegistry();
  ['openai', 'anthropic', 'gemini', 'local_models', 'ollama', 'vllm', 'azure_openai']
    .forEach((name) => registry.register(new ProviderAdapter({ name })));
  return registry;
}

module.exports = { ProviderAdapter, ProviderRegistry, createDefaultProviderRegistry };

