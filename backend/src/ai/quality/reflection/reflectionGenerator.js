const crypto = require('crypto');

function expiresAt(days = 90) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function generateReflections({ reasoningContext, qualityReport }) {
  const reflections = [];
  for (const finding of reasoningContext.primaryFindings || []) {
    if (finding.confidence < 0.6) continue;
    reflections.push(Object.freeze({
      reflectionId: crypto.randomUUID(),
      type: finding.findingType || 'behavior_finding',
      behaviorFinding: finding.conceptId,
      supportingEvidence: finding.evidenceIds || [],
      confidence: Math.min(finding.confidence, qualityReport.overallQualityScore),
      createdAt: new Date().toISOString(),
      expires: expiresAt(finding.findingType === 'weakness' ? 60 : 120),
      importance: Number(Math.min(1, (finding.confidence || 0) * Math.min(1, (finding.evidenceCount || 1) / 4)).toFixed(4)),
      version: 1
    }));
  }
  return reflections;
}

module.exports = { generateReflections };

