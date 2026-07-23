function costAccounting({ provider, model, tokens }) {
  const estimatedCost = provider.estimateCost(model, { promptTokens: tokens.estimatedPromptTokens, maxOutputTokens: model.maxOutputTokens });
  const actualCost = Number((((tokens.promptTokens / 1000) * model.pricing.promptPer1k) + ((tokens.completionTokens / 1000) * model.pricing.completionPer1k)).toFixed(6));
  return {
    estimatedCost,
    actualCost,
    provider: provider.provider,
    model: model.name
  };
}

module.exports = { costAccounting };

