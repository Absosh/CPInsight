function validateConfidence(response, evidencePackage, reasoningContext) {
  const deterministic = Number((((evidencePackage.confidenceSummary?.averageConfidence || 0) * 0.45) + ((reasoningContext.confidence || 0) * 0.55)).toFixed(4));
  const model = Number(response.confidence || 0);
  const clamped = Number(Math.max(0, Math.min(1, Math.min(model, deterministic + 0.15))).toFixed(4));
  return {
    valid: Math.abs(model - deterministic) <= 0.3,
    modelConfidence: model,
    deterministicConfidence: deterministic,
    finalConfidence: clamped,
    mismatch: Number(Math.abs(model - deterministic).toFixed(4))
  };
}

module.exports = { validateConfidence };

