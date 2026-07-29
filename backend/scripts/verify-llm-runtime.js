const assert = require('assert/strict');
const crypto = require('crypto');
const { LLMRuntimeEngine } = require('../src/ai/runtime/runtimeEngine');
const { ProviderRegistry } = require('../src/ai/runtime/providers/registry');
const { ProviderAdapter } = require('../src/ai/runtime/providers/providerAdapter');
const { ModelRegistry } = require('../src/ai/runtime/models/modelRegistry');
const { RetryEngine } = require('../src/ai/runtime/retry/retryEngine');
const { RuntimeRateLimiter } = require('../src/ai/runtime/rateLimit/rateLimiter');

class MockProvider extends ProviderAdapter {
  constructor({ provider, failTimes = 0, alwaysFail = false, chunks = ['a', 'b'], priority = 1 }) {
    super({ provider, apiKey: 'test-key', baseUrl: 'mock://provider', priority });
    this.remainingFailures = failTimes;
    this.alwaysFail = alwaysFail;
    this.chunks = chunks;
  }

  buildRequest({ model, promptPackage }) {
    return { body: { model: model.name, promptPackageId: promptPackage.promptPackageId }, headers: {}, url: 'mock://invoke' };
  }

  async invoke(request) {
    if (this.alwaysFail || this.remainingFailures > 0) {
      this.remainingFailures -= 1;
      const error = new Error(`Mock failure: ${this.provider}`);
      error.response = { status: 500 };
      throw error;
    }
    return {
      rawResponse: { id: crypto.randomUUID(), provider: this.provider, request },
      text: `raw response from ${this.provider}`,
      usage: { prompt_tokens: 120, completion_tokens: 45, cached_tokens: 5 }
    };
  }

  async *stream() {
    for (const chunk of this.chunks) yield { text: chunk };
  }
}

function registry({ primaryFail = false, retryFailures = 0 } = {}) {
  const providers = new ProviderRegistry();
  providers.register(new MockProvider({ provider: 'openai', alwaysFail: primaryFail, failTimes: retryFailures, priority: 1 }));
  providers.register(new MockProvider({ provider: 'anthropic', priority: 2 }));
  providers.register(new MockProvider({ provider: 'gemini', priority: 3 }));
  providers.register(new MockProvider({ provider: 'ollama', priority: 4 }));
  return providers;
}

function models() {
  return new ModelRegistry([
    { name: 'fast-json', provider: 'openai', contextWindow: 128000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 4096, pricing: { promptPer1k: 0.001, completionPer1k: 0.002 }, status: 'available' },
    { name: 'fallback-json', provider: 'anthropic', contextWindow: 200000, supportsStreaming: true, supportsJSON: false, supportsTools: false, supportsVision: false, maxOutputTokens: 4096, pricing: { promptPer1k: 0.002, completionPer1k: 0.004 }, status: 'available' },
    { name: 'gemini-wide', provider: 'gemini', contextWindow: 1000000, supportsStreaming: true, supportsJSON: true, supportsTools: false, supportsVision: false, maxOutputTokens: 8192, pricing: { promptPer1k: 0.001, completionPer1k: 0.003 }, status: 'available' },
    { name: 'local', provider: 'ollama', contextWindow: 32768, supportsStreaming: true, supportsJSON: false, supportsTools: false, supportsVision: false, maxOutputTokens: 2048, pricing: { promptPer1k: 0, completionPer1k: 0 }, status: 'local' }
  ]);
}

function executionPlan() {
  return {
    executionPlanId: crypto.randomUUID(),
    promptPackageId: crypto.randomUUID(),
    reasoningModes: ['evidence_based'],
    outputSchemas: [{ name: 'diagnostic' }],
    tasks: [{ taskType: 'diagnostic' }],
    executionMetadata: { noLLMInvocation: false }
  };
}

function promptPackage(size = 200) {
  return {
    promptPackageId: crypto.randomUUID(),
    systemPrompt: 'System',
    developerInstructions: ['Use evidence.'],
    evidenceBlock: Array.from({ length: 4 }, (_, index) => ({ evidenceId: `e${index}` })),
    reasoningContext: { text: 'x'.repeat(size) },
    outputSchema: { type: 'object' },
    groundingRules: {},
    citationRules: {},
    safetyRules: {},
    responseConstraints: {},
    audit: { promptSizeTokens: Math.ceil(size / 4), contextSizeTokens: Math.ceil(size / 4) }
  };
}

async function run() {
  const userId = crypto.randomUUID();
  const engine = new LLMRuntimeEngine({
    providerRegistry: registry(),
    modelRegistry: models(),
    retryEngine: new RetryEngine({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 }),
    rateLimiter: new RuntimeRateLimiter({ perUser: 10000, perProvider: 10000, perModel: 10000 })
  });
  const normal = await engine.execute({ userId, executionPlan: executionPlan(), promptPackage: promptPackage() });
  assert.equal(normal.provider, 'gemini');
  assert.equal(normal.streaming, false);
  assert.equal(normal.tokenAccounting.promptTokens, 120);
  assert.equal(normal.costAccounting.actualCost > 0, true);

  const streaming = await engine.execute({
    userId,
    executionPlan: executionPlan(),
    promptPackage: promptPackage(),
    override: { provider: 'openai', model: 'fast-json' },
    stream: true
  });
  assert.equal(streaming.streaming, true);
  assert.equal(streaming.text, 'ab');

  const retryEngine = new LLMRuntimeEngine({ providerRegistry: registry({ retryFailures: 2 }), modelRegistry: models(), retryEngine: new RetryEngine({ maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 }) });
  const retried = await retryEngine.execute({
    userId,
    executionPlan: executionPlan(),
    promptPackage: promptPackage(),
    override: { provider: 'openai', model: 'fast-json' }
  });
  assert.equal(retried.retries, 2);

  const failoverEngine = new LLMRuntimeEngine({ providerRegistry: registry({ primaryFail: true }), modelRegistry: models(), retryEngine: new RetryEngine({ maxAttempts: 1 }) });
  const fallback = await failoverEngine.execute({
    userId,
    executionPlan: executionPlan(),
    promptPackage: promptPackage(),
    override: { provider: 'openai', model: 'fast-json' }
  });
  assert.equal(fallback.provider, 'anthropic');
  assert.equal(fallback.fallbacks >= 1, true);

  const manual = await engine.execute({
    userId,
    executionPlan: executionPlan(),
    promptPackage: promptPackage(),
    override: { provider: 'gemini', model: 'gemini-wide' }
  });
  assert.equal(manual.provider, 'gemini');
  assert.equal(manual.modelSelectionReason, 'manual_override');

  const limited = new LLMRuntimeEngine({
    providerRegistry: registry(),
    modelRegistry: models(),
    rateLimiter: new RuntimeRateLimiter({ perUser: 1, perProvider: 100, perModel: 100, windowMs: 60000 })
  });
  await limited.execute({ userId: 'limited-user', executionPlan: executionPlan(), promptPackage: promptPackage() });
  await assert.rejects(
    () => limited.execute({ userId: 'limited-user', executionPlan: executionPlan(), promptPackage: promptPackage() }),
    /All LLM providers failed or were rate limited/
  );

  const cancel = engine.cancel('runtime-id');
  assert.equal(cancel.cancelled, true);

  const startedAt = Date.now();
  for (let index = 0; index < 1000; index += 1) {
    const result = await engine.execute({
      userId: `user-${index % 20}`,
      executionPlan: executionPlan(),
      promptPackage: promptPackage(100 + index),
      override: index % 5 === 0 ? { provider: 'ollama', model: 'local' } : {}
    });
    assert.equal(Boolean(result.rawResponse), true);
    assert.equal(result.tokenAccounting.totalTokens > 0, true);
  }
  const latencyMs = Date.now() - startedAt;
  assert.equal(latencyMs < 10000, true);

  console.log(JSON.stringify({
    verdict: 'PASS',
    normalProvider: normal.provider,
    streamingText: streaming.text,
    retryCount: retried.retries,
    fallbackProvider: fallback.provider,
    manualProvider: manual.provider,
    rateLimitRejected: true,
    cancellation: cancel.cancelled,
    mixedExecutionPlans: 1000,
    latencyMs,
    providerCount: engine.providers().length,
    modelCount: engine.models().length,
    tokenAccounting: normal.tokenAccounting.totalTokens,
    costAccounting: normal.costAccounting.actualCost
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
