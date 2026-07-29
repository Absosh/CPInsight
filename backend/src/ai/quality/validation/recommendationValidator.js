const { attachedEvidence, textOf } = require('./groundingValidator');

function validateRecommendations(response, evidencePackage, reasoningContext, { minConfidence = 0.55 } = {}) {
  const evidenceById = new Map([...(evidencePackage.evidence || []), ...(reasoningContext.evidenceSummary?.usedEvidence || [])].map((item) => [item.evidenceId, item]));
  if (reasoningContext.retrievalMode === 'general' || evidenceById.size === 0) {
    return {
      valid: true,
      accepted: [],
      rejected: [],
      supportRate: 1,
      skipped: true,
      reason: 'personal_context_unavailable_or_not_required'
    };
  }
  const accepted = [];
  const rejected = [];
  for (const recommendation of response.recommendations) {
    const refs = attachedEvidence(recommendation);
    const supporting = refs.map((id) => evidenceById.get(id)).filter(Boolean);
    const confidence = supporting.length
      ? supporting.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / supporting.length
      : 0;
    if (supporting.length && confidence >= minConfidence) accepted.push({ recommendation: textOf(recommendation), evidenceIds: refs, confidence: Number(confidence.toFixed(4)) });
    else rejected.push({ recommendation: textOf(recommendation), evidenceIds: refs, confidence: Number(confidence.toFixed(4)), reason: 'insufficient_support' });
  }
  return {
    valid: rejected.length === 0,
    accepted,
    rejected,
    supportRate: response.recommendations.length ? Number((accepted.length / response.recommendations.length).toFixed(4)) : 1
  };
}

module.exports = { validateRecommendations };
