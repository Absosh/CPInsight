const axios = require('axios');
const { ProviderAdapter } = require('./providerAdapter');

function commonMessages(promptPackage) {
  return [
    { role: 'system', content: promptPackage.systemPrompt },
    { role: 'developer', content: promptPackage.developerInstructions.join('\n') },
    { role: 'user', content: JSON.stringify({
      evidenceBlock: promptPackage.evidenceBlock,
      reasoningContext: promptPackage.reasoningContext,
      outputSchema: promptPackage.outputSchema,
      groundingRules: promptPackage.groundingRules,
      citationRules: promptPackage.citationRules,
      safetyRules: promptPackage.safetyRules,
      responseConstraints: promptPackage.responseConstraints
    }) }
  ];
}

class OpenAIProvider extends ProviderAdapter {
  constructor(config = {}) {
    super({ provider: 'openai', apiKey: config.apiKey || process.env.OPENAI_API_KEY, baseUrl: config.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', priority: 1 });
  }

  buildRequest({ model, promptPackage, parameters = {} }) {
    return {
      url: `${this.baseUrl}/chat/completions`,
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: {
        model: model.name,
        messages: commonMessages(promptPackage),
        temperature: parameters.temperature ?? 0.2,
        top_p: parameters.topP ?? 1,
        max_tokens: parameters.maxTokens || model.maxOutputTokens,
        seed: parameters.seed,
        stop: parameters.stopSequences,
        response_format: model.supportsJSON ? { type: 'json_object' } : undefined
      }
    };
  }

  async invoke(request) {
    if (!this.apiKey) throw new Error('OpenAI API key is not configured');
    const response = await axios.post(request.url, request.body, { headers: request.headers, timeout: request.timeoutMs || 30000 });
    return { rawResponse: response.data, text: response.data.choices && response.data.choices[0] ? response.data.choices[0].message.content : '', usage: response.data.usage || {} };
  }
}

class AnthropicProvider extends ProviderAdapter {
  constructor(config = {}) {
    super({ provider: 'anthropic', apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY, baseUrl: config.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1', priority: 2 });
  }

  buildRequest({ model, promptPackage, parameters = {} }) {
    return {
      url: `${this.baseUrl}/messages`,
      headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: {
        model: model.name,
        system: `${promptPackage.systemPrompt}\n${promptPackage.developerInstructions.join('\n')}`,
        messages: [{ role: 'user', content: JSON.stringify(promptPackage.reasoningContext) }],
        max_tokens: parameters.maxTokens || model.maxOutputTokens,
        temperature: parameters.temperature ?? 0.2,
        top_p: parameters.topP ?? 1
      }
    };
  }

  async invoke(request) {
    if (!this.apiKey) throw new Error('Anthropic API key is not configured');
    const response = await axios.post(request.url, request.body, { headers: request.headers, timeout: request.timeoutMs || 30000 });
    return { rawResponse: response.data, text: response.data.content ? response.data.content.map((item) => item.text || '').join('') : '', usage: response.data.usage || {} };
  }
}

class GeminiProvider extends ProviderAdapter {
  constructor(config = {}) {
    super({ provider: 'gemini', apiKey: config.apiKey || process.env.GEMINI_API_KEY, baseUrl: config.baseUrl || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta', priority: 3 });
  }

  buildRequest({ model, promptPackage, parameters = {} }) {
    return {
      url: `${this.baseUrl}/models/${model.name}:generateContent?key=${this.apiKey}`,
      headers: {},
      body: {
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(promptPackage) }] }],
        generationConfig: {
          temperature: parameters.temperature ?? 0.2,
          topP: parameters.topP ?? 1,
          maxOutputTokens: parameters.maxTokens || model.maxOutputTokens
        }
      }
    };
  }

  async invoke(request) {
    if (!this.apiKey) throw new Error('Gemini API key is not configured');
    const response = await axios.post(request.url, request.body, { headers: request.headers, timeout: request.timeoutMs || 30000 });
    return { rawResponse: response.data, text: JSON.stringify(response.data.candidates || []), usage: response.data.usageMetadata || {} };
  }
}

class OpenAICompatibleProvider extends OpenAIProvider {
  constructor({ provider, apiKey, baseUrl, priority }) {
    super({ apiKey, baseUrl });
    this.provider = provider;
    this.priorityValue = priority;
  }
}

module.exports = { OpenAIProvider, AnthropicProvider, GeminiProvider, OpenAICompatibleProvider, commonMessages };

