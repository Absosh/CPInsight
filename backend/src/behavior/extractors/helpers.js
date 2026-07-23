function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function avg(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function confidenceFromCount(count, target = 20) {
  return Number(clamp(count / target, 0.15, 0.95).toFixed(4));
}

function feature({ name, group, value, confidence, extractorId, version, metadata = {} }) {
  return Object.freeze({
    featureName: name,
    featureGroup: group,
    value,
    confidence: Number(clamp(confidence, 0, 1).toFixed(4)),
    extractorId,
    featureVersion: version,
    metadata
  });
}

module.exports = { clamp, avg, confidenceFromCount, feature };
