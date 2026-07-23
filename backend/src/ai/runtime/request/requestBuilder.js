function buildProviderRequest({ provider, model, executionPlan, promptPackage, parameters = {} }) {
  const request = provider.buildRequest({
    model,
    promptPackage,
    executionPlan,
    parameters: {
      temperature: parameters.temperature ?? 0.2,
      topP: parameters.topP ?? 1,
      maxTokens: Math.min(parameters.maxTokens || model.maxOutputTokens, model.maxOutputTokens),
      seed: parameters.seed,
      stopSequences: parameters.stopSequences
    }
  });
  return {
    ...request,
    timeoutMs: parameters.timeoutMs || 30000,
    requestMetadata: {
      provider: provider.provider,
      model: model.name,
      executionPlanId: executionPlan.executionPlanId,
      promptPackageId: promptPackage.promptPackageId,
      responseFormat: model.supportsJSON ? 'json' : 'text'
    }
  };
}

module.exports = { buildProviderRequest };

