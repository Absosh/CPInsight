const crypto = require('crypto');
const { createDefaultProviderRegistry } = require('./providers/factory');
const { ModelRegistry } = require('./models/modelRegistry');
const { ModelSelectionEngine } = require('./models/modelSelectionEngine');
const { buildProviderRequest } = require('./request/requestBuilder');
const { RetryEngine } = require('./retry/retryEngine');
const { FailoverEngine } = require('./failover/failoverEngine');
const { StreamingEngine } = require('./streaming/streamingEngine');
const { tokenAccounting } = require('./accounting/tokenAccounting');
const { costAccounting } = require('./accounting/costAccounting');
const { RuntimeRateLimiter } = require('./rateLimit/rateLimiter');

class LLMRuntimeEngine {
  constructor({
    providerRegistry = createDefaultProviderRegistry(),
    modelRegistry = new ModelRegistry(),
    retryEngine = new RetryEngine(),
    streamingEngine = new StreamingEngine(),
    rateLimiter = new RuntimeRateLimiter()
  } = {}) {
    this.providerRegistry = providerRegistry;
    this.modelRegistry = modelRegistry;
    this.selectionEngine = new ModelSelectionEngine({ modelRegistry, providerRegistry });
    this.retryEngine = retryEngine;
    this.streamingEngine = streamingEngine;
    this.failoverEngine = new FailoverEngine({ providerRegistry, modelRegistry });
    this.rateLimiter = rateLimiter;
    this.cancelled = new Set();
  }

  async execute({ userId, executionPlan, promptPackage, override = {}, stream = false, callbacks = {} }) {
    const runtimeRequestId = crypto.randomUUID();
    const startedAt = Date.now();
    const selection = this.selectionEngine.select({ executionPlan, promptPackage, override });
    const attempted = [];
    let activeModel = selection.model;
    let fallbacks = 0;
    const candidates = [activeModel, ...this.failoverEngine.candidates(activeModel)];

    for (const model of candidates) {
      activeModel = model;
      const provider = this.providerRegistry.get(model.provider);
      const limit = this.rateLimiter.check({ userId, provider: model.provider, model: model.name });
      if (!limit.allowed) {
        attempted.push({ provider: model.provider, model: model.name, status: 'rate_limited' });
        continue;
      }
      const request = buildProviderRequest({ provider, model, executionPlan, promptPackage, parameters: override.parameters || {} });
      request.requestMetadata.runtimeRequestId = runtimeRequestId;
      try {
        const invocation = await this.retryEngine.run(async () => {
          if (this.cancelled.has(runtimeRequestId)) throw new Error('Runtime request cancelled');
          await provider.initialize();
          return stream
            ? this.streamingEngine.collect({ provider, request, callbacks })
            : provider.invoke(request);
        });
        provider.recordSuccess();
        const response = invocation.result;
        const tokens = tokenAccounting({ provider, model, promptPackage, response });
        const cost = costAccounting({ provider, model, tokens });
        return Object.freeze({
          runtimeRequestId,
          executionPlanId: executionPlan.executionPlanId,
          promptPackageId: promptPackage.promptPackageId,
          provider: model.provider,
          model: model.name,
          modelSelectionReason: selection.reason,
          rawResponse: response.rawResponse,
          text: response.text,
          streaming: Boolean(stream),
          attempts: [...attempted, { provider: model.provider, model: model.name, status: 'succeeded', retries: invocation.retries }],
          retries: invocation.retries,
          fallbacks,
          latencyMs: Date.now() - startedAt,
          tokenAccounting: tokens,
          costAccounting: cost,
          cancelled: response.cancelled || false,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        provider.recordFailure();
        attempted.push({ provider: model.provider, model: model.name, status: 'failed', error: error.message });
        fallbacks += 1;
      } finally {
        await provider.destroy().catch(() => {});
      }
    }
    const error = new Error('All LLM providers failed or were rate limited');
    error.status = 503;
    error.code = 'LLM_PROVIDER_UNAVAILABLE';
    error.attempted = attempted;
    error.details = attempted.map((attempt) => ({
      provider: attempt.provider,
      model: attempt.model,
      status: attempt.status,
      error: attempt.error
    }));
    throw error;
  }

  cancel(runtimeRequestId) {
    this.cancelled.add(runtimeRequestId);
    return { runtimeRequestId, cancelled: true };
  }

  providers() {
    return this.providerRegistry.health();
  }

  models() {
    return this.modelRegistry.all();
  }

  health() {
    const providers = this.providers();
    return { healthy: providers.some((provider) => provider.healthy), providers };
  }
}

module.exports = { LLMRuntimeEngine };
