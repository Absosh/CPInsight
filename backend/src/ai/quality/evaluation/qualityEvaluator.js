function score(validation) {
  const grounding = validation.grounding.coverage;
  const citation = validation.citations.quality;
  const recommendation = validation.recommendations.supportRate;
  const confidence = 1 - Math.min(1, validation.confidence.mismatch);
  const consistency = validation.consistency.valid ? 1 : 0.5;
  const schema = validation.schema.valid ? 1 : 0.4;
  const completeness = validation.response.summary ? 0.8 : 0.4;
  const conciseness = validation.response.summary.length <= 1200 ? 1 : 0.7;
  const actionability = validation.response.recommendations.length ? recommendation : 0.7;
  const overall = (
    grounding * 0.2 +
    citation * 0.15 +
    recommendation * 0.15 +
    confidence * 0.1 +
    consistency * 0.1 +
    schema * 0.1 +
    completeness * 0.08 +
    conciseness * 0.05 +
    actionability * 0.07
  );
  return Object.freeze({
    groundingCoverage: grounding,
    evidenceUtilization: grounding,
    citationQuality: citation,
    recommendationSupport: recommendation,
    actionability,
    readability: conciseness,
    completeness,
    conciseness,
    contradictionCount: validation.consistency.contradictionCount,
    missingEvidence: validation.evidencePackage.missingEvidence || [],
    overallQualityScore: Number(overall.toFixed(4))
  });
}

module.exports = { score };

