const crypto = require('crypto');

function normalizeEvidence(item) {
  return Object.freeze({
    evidenceId: item.evidenceId,
    source: item.source,
    type: item.type,
    identifier: item.identifier,
    confidence: Number(Math.max(0, Math.min(1, Number(item.confidence || 0))).toFixed(4)),
    timestamp: new Date(item.timestamp || 0).toISOString(),
    version: Number(item.version || 1),
    relationshipDistance: Number(item.distance || item.relationshipDistance || 1),
    payload: item.payload || {},
    references: item.references || {}
  });
}

function dedupe(evidence) {
  const byKey = new Map();
  for (const item of evidence.map(normalizeEvidence)) {
    const key = `${item.source}:${item.type}:${item.identifier}:v${item.version}`;
    const existing = byKey.get(key);
    if (!existing || item.confidence > existing.confidence) byKey.set(key, item);
  }
  return [...byKey.values()];
}

function freshnessScore(timestamp) {
  const ageMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const ageDays = ageMs / 86400000;
  return Number((1 / (1 + ageDays / 30)).toFixed(4));
}

function rankEvidence(evidence, sourcePriority = new Map(), sourceReliability = new Map()) {
  return evidence
    .map((item) => {
      const priority = sourcePriority.get(item.source) || 99;
      const reliability = sourceReliability.get(item.source) ?? 0.75;
      const freshness = freshnessScore(item.timestamp);
      const density = evidence.filter((other) => other.type === item.type).length;
      const densityScore = Math.min(1, density / 10);
      const distanceScore = 1 / Math.max(1, item.relationshipDistance);
      const score = (
        item.confidence * 0.35 +
        freshness * 0.15 +
        (1 / priority) * 0.15 +
        densityScore * 0.1 +
        distanceScore * 0.1 +
        reliability * 0.15
      );
      return Object.freeze({ ...item, rankScore: Number(score.toFixed(4)) });
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.confidence - a.confidence || a.evidenceId.localeCompare(b.evidenceId));
}

function numericPayloadValue(item) {
  const value = item.payload.value;
  if (typeof value === 'number') return value;
  if (value && typeof value.value === 'number') return value.value;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function detectContradictions(evidence) {
  const byFeature = new Map();
  const contradictions = [];
  for (const item of evidence) {
    const key = item.payload.feature_name || item.payload.featureName || item.payload.insight_key || item.identifier;
    if (!key) continue;
    const value = numericPayloadValue(item);
    if (value === null) continue;
    const previous = byFeature.get(key);
    if (previous && Math.abs(previous.value - value) >= 0.5) {
      contradictions.push(Object.freeze({
        contradictionId: crypto.randomUUID(),
        type: 'conflicting_feature_values',
        key,
        evidenceIds: [previous.item.evidenceId, item.evidenceId],
        severity: Math.min(previous.item.confidence, item.confidence) >= 0.75 ? 'needs_review' : 'low_confidence_conflict',
        values: [previous.value, value]
      }));
    } else if (!previous || item.confidence > previous.item.confidence) {
      byFeature.set(key, { value, item });
    }
  }
  return contradictions;
}

function fuse({ plan, retrievalResults, sourceHealth }) {
  const startedAt = Date.now();
  const rawEvidence = retrievalResults.flatMap((result) => result.evidence || []);
  const normalized = dedupe(rawEvidence);
  const sourcePriority = new Map((plan.retrievalSources || []).map((source) => [source.name, source.priority || 99]));
  const sourceReliability = new Map(sourceHealth.map((item) => [item.name, item.reliability ?? 0.75]));
  const ranked = rankEvidence(normalized, sourcePriority, sourceReliability);
  const contradictions = detectContradictions(ranked);
  const ignoredEvidenceIds = new Set(contradictions
    .filter((item) => item.severity === 'low_confidence_conflict')
    .flatMap((item) => item.evidenceIds));
  const resolvedEvidence = ranked.filter((item) => !ignoredEvidenceIds.has(item.evidenceId));
  const retrievedSources = retrievalResults.map((result) => ({
    source: result.source,
    status: result.status,
    evidenceCount: result.evidence ? result.evidence.length : 0,
    latencyMs: result.latencyMs,
    cacheHit: Boolean(result.cacheHit),
    error: result.error || null
  }));
  const confidenceValues = resolvedEvidence.map((item) => item.confidence);
  const averageConfidence = confidenceValues.length
    ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(4))
    : 0;

  return Object.freeze({
    packageId: crypto.randomUUID(),
    question: plan.question,
    questionHash: plan.questionHash,
    planId: plan.planId,
    retrievalMetadata: {
      createdAt: new Date().toISOString(),
      plannerIntent: plan.intents,
      requiredEvidence: plan.requiredEvidence,
      sourceCount: retrievedSources.length
    },
    retrievedSources,
    evidence: resolvedEvidence,
    ignoredEvidence: ranked.filter((item) => ignoredEvidenceIds.has(item.evidenceId)),
    contradictions,
    confidenceSummary: {
      averageConfidence,
      highestConfidence: confidenceValues.length ? Math.max(...confidenceValues) : 0,
      lowestConfidence: confidenceValues.length ? Math.min(...confidenceValues) : 0,
      requiredConfidence: plan.confidencePlan.requiredConfidence,
      meetsRequirement: averageConfidence >= plan.confidencePlan.requiredConfidence
    },
    missingEvidence: (plan.retrievalSources || [])
      .filter((source) => !retrievedSources.some((item) => item.source === source.name && item.evidenceCount > 0))
      .map((source) => source.name),
    statistics: {
      rawEvidenceCount: rawEvidence.length,
      normalizedEvidenceCount: normalized.length,
      rankedEvidenceCount: ranked.length,
      resolvedEvidenceCount: resolvedEvidence.length,
      contradictionCount: contradictions.length,
      fusionLatencyMs: Date.now() - startedAt
    }
  });
}

module.exports = { fuse, normalizeEvidence, rankEvidence, detectContradictions };
