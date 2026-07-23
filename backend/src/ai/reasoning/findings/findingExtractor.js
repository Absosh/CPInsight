const crypto = require('crypto');
const { conceptForEvidence } = require('../ontology/behaviorOntology');

function findingType(evidence) {
  const category = String(evidence.payload.category || evidence.payload.insight_type || evidence.type || '').toLowerCase();
  if (category.includes('weak')) return 'weakness';
  if (category.includes('strength')) return 'strength';
  if (category.includes('pattern')) return 'pattern';
  return evidence.confidence >= 0.78 ? 'supporting_signal' : 'weak_signal';
}

function rankFinding(finding) {
  const freshness = finding.evidence.reduce((max, item) => Math.max(max, new Date(item.timestamp).getTime()), 0);
  const ageDays = Math.max(0, (Date.now() - freshness) / 86400000);
  const freshnessScore = 1 / (1 + ageDays / 30);
  const score = (
    finding.confidence * 0.4 +
    Math.min(1, finding.evidence.length / 8) * 0.2 +
    freshnessScore * 0.15 +
    finding.averageRankScore * 0.15 +
    (finding.concept.category === 'unknown' ? 0 : 0.1)
  );
  return Number(score.toFixed(4));
}

function extractFindings(evidencePackage) {
  const grouped = new Map();
  for (const item of evidencePackage.evidence || []) {
    const concept = conceptForEvidence(item);
    const key = `${concept.id}:${findingType(item)}`;
    const entry = grouped.get(key) || { concept, type: findingType(item), evidence: [] };
    entry.evidence.push(item);
    grouped.set(key, entry);
  }

  const findings = [...grouped.values()].map((entry) => {
    const confidence = entry.evidence.reduce((sum, item) => sum + item.confidence, 0) / entry.evidence.length;
    const averageRankScore = entry.evidence.reduce((sum, item) => sum + (item.rankScore || 0), 0) / entry.evidence.length;
    const finding = {
      findingId: crypto.randomUUID(),
      conceptId: entry.concept.id,
      ontologyCategory: entry.concept.category,
      findingType: entry.type,
      confidence: Number(confidence.toFixed(4)),
      evidenceCount: entry.evidence.length,
      evidenceIds: entry.evidence.map((item) => item.evidenceId),
      evidence: entry.evidence,
      averageRankScore: Number(averageRankScore.toFixed(4))
    };
    return Object.freeze({ ...finding, priorityScore: rankFinding({ ...finding, concept: entry.concept }) });
  }).sort((a, b) => b.priorityScore - a.priorityScore || b.confidence - a.confidence || a.conceptId.localeCompare(b.conceptId));

  return {
    primaryFindings: findings.slice(0, 5),
    secondaryFindings: findings.slice(5),
    allFindings: findings
  };
}

module.exports = { extractFindings };

