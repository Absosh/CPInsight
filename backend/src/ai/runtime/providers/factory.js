const { ProviderRegistry } = require('./registry');
const { OpenAIProvider, AnthropicProvider, GeminiProvider, OpenAICompatibleProvider } = require('./httpProviders');

function createDefaultProviderRegistry() {
  const registry = new ProviderRegistry();
  [
    new OpenAIProvider(),
    new AnthropicProvider(),
    new GeminiProvider(),
    new OpenAICompatibleProvider({ provider: 'azure_openai', apiKey: process.env.AZURE_OPENAI_API_KEY, baseUrl: process.env.AZURE_OPENAI_BASE_URL, priority: 4 }),
    new OpenAICompatibleProvider({ provider: 'openrouter', apiKey: process.env.OPENROUTER_API_KEY, baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1', priority: 5 }),
    new OpenAICompatibleProvider({ provider: 'ollama', apiKey: null, baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1', priority: 6 }),
    new OpenAICompatibleProvider({ provider: 'vllm', apiKey: null, baseUrl: process.env.VLLM_BASE_URL || 'http://localhost:8000/v1', priority: 7 })
  ].forEach((provider) => registry.register(provider));
  return registry;
}

module.exports = { createDefaultProviderRegistry };

