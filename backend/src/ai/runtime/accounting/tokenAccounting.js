function tokenAccounting({ provider, model, promptPackage, response }) {
  const estimatedPromptTokens = provider.estimateTokens(promptPackage);
  const actualPromptTokens = response.usage.prompt_tokens || response.usage.input_tokens || estimatedPromptTokens;
  const completionTokens = response.usage.completion_tokens || response.usage.output_tokens || provider.estimateTokens(response.text || response.rawResponse || '');
  return {
    estimatedPromptTokens,
    promptTokens: actualPromptTokens,
    completionTokens,
    cachedTokens: response.usage.cached_tokens || 0,
    totalTokens: actualPromptTokens + completionTokens,
    maxOutputTokens: model.maxOutputTokens,
    budgetUsage: Number(((actualPromptTokens + completionTokens) / Math.max(1, model.contextWindow)).toFixed(6))
  };
}

module.exports = { tokenAccounting };

