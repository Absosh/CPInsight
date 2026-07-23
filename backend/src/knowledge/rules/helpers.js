function numericValue(feature) {
  if (!feature) return null;
  if (typeof feature.value === 'number') return feature.value;
  if (feature.value && typeof feature.value === 'object' && typeof feature.value.value === 'number') return feature.value.value;
  return Number.isFinite(Number(feature.value)) ? Number(feature.value) : null;
}

function latest(features, name) {
  return features.find((feature) => feature.feature_name === name || feature.featureName === name) || null;
}

function byName(features, name) {
  return features.filter((feature) => feature.feature_name === name || feature.featureName === name);
}

function confidence(features, multiplier = 1) {
  if (!features.length) return 0;
  const avg = features.reduce((sum, feature) => sum + Number(feature.confidence || 0), 0) / features.length;
  return Number(Math.max(0, Math.min(0.99, avg * multiplier)).toFixed(4));
}

function insight({ ruleId, insightKey, insightType, category, confidence: score, features, sessions = [], properties = {}, relationshipType, targetNode }) {
  return Object.freeze({
    ruleId,
    insightKey,
    insightType,
    category,
    confidence: Number(Math.max(0, Math.min(1, score)).toFixed(4)),
    supportingFeatures: features.map((feature) => feature.id).filter(Boolean),
    evidenceSessions: [...new Set(sessions.filter(Boolean))],
    properties,
    relationshipType,
    targetNode
  });
}

module.exports = { numericValue, latest, byName, confidence, insight };
