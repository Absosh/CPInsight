const MODELS = Object.freeze([
  { name: 'gpt-4.1-mini', provider: 'openai', contextWindow: 128000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 8192, pricing: { promptPer1k: 0.0004, completionPer1k: 0.0016 }, status: 'available' },
  { name: 'gpt-4.1', provider: 'openai', contextWindow: 128000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 16384, pricing: { promptPer1k: 0.002, completionPer1k: 0.008 }, status: 'available' },
  { name: 'claude-3-5-sonnet-latest', provider: 'anthropic', contextWindow: 200000, supportsStreaming: true, supportsJSON: false, supportsTools: false, supportsVision: false, maxOutputTokens: 8192, pricing: { promptPer1k: 0.003, completionPer1k: 0.015 }, status: 'available' },
  { name: 'gemini-flash-latest', provider: 'gemini', contextWindow: 1000000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 8192, pricing: { promptPer1k: 0.0003, completionPer1k: 0.0025 }, status: 'available' },
  { name: 'gemini-flash-lite-latest', provider: 'gemini', contextWindow: 1000000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 8192, pricing: { promptPer1k: 0.000075, completionPer1k: 0.0003 }, status: 'available' },
  { name: 'gemini-pro-latest', provider: 'gemini', contextWindow: 1000000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 8192, pricing: { promptPer1k: 0.00125, completionPer1k: 0.005 }, status: 'available' },
  { name: 'gpt-4.1-mini', provider: 'azure_openai', contextWindow: 128000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 8192, pricing: { promptPer1k: 0.0004, completionPer1k: 0.0016 }, status: 'available' },
  { name: 'openrouter/auto', provider: 'openrouter', contextWindow: 128000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 8192, pricing: { promptPer1k: 0.001, completionPer1k: 0.003 }, status: 'available' },
  { name: 'llama3.1', provider: 'ollama', contextWindow: 32768, supportsStreaming: true, supportsJSON: false, supportsTools: false, supportsVision: false, maxOutputTokens: 4096, pricing: { promptPer1k: 0, completionPer1k: 0 }, status: 'local' },
  { name: 'local-default', provider: 'vllm', contextWindow: 32768, supportsStreaming: true, supportsJSON: false, supportsTools: false, supportsVision: false, maxOutputTokens: 4096, pricing: { promptPer1k: 0, completionPer1k: 0 }, status: 'local' }
]);

class ModelRegistry {
  constructor(models = MODELS) {
    this.models = models;
  }

  all() {
    return this.models;
  }

  forProvider(provider) {
    return this.models.filter((model) => model.provider === provider);
  }

  find(provider, name) {
    return this.models.find((model) => model.provider === provider && model.name === name) || null;
  }

  preferredFromEnv() {
    const provider = process.env.LLM_PROVIDER || 'gemini';
    const model = process.env.LLM_MODEL || 'gemini-flash-latest';
    return this.find(provider, model);
  }
}

module.exports = { ModelRegistry, MODELS };
