const crypto = require('crypto');

const CAUSAL_TEMPLATES = Object.freeze([
  { chain: ['time_allocation', 'panic', 'implementation_errors'], label: 'Time allocation pressure can amplify panic and submission mistakes.' },
  { chain: ['risk_taking', 'panic', 'time_mismanagement'], label: 'High risk taking can worsen late-contest pressure when outcomes are poor.' },
  { chain: ['persistence', 'recovery_strategy', 'rapid_improvement'], label: 'Persistence can support recovery and long-term improvement.' },
  { chain: ['deep_reading', 'conceptual_weakness', 'decision_delay'], label: 'Slow reading with weak confidence can indicate conceptual uncertainty before action.' },
  { chain: ['difficulty_avoidance', 'plateau'], label: 'Avoiding difficulty can contribute to plateau risk.' },
  { chain: ['fast_recognition', 'confidence', 'topic_mastery'], label: 'Fast recognition with confidence can indicate topic mastery.' }
]);

function buildCausalChains(findings) {
  const byConcept = new Map(findings.map((finding) => [finding.conceptId, finding]));
  return CAUSAL_TEMPLATES.map((template) => {
    const present = template.chain.filter((conceptId) => byConcept.has(conceptId));
    if (present.length < 2) return null;
    const chainFindings = present.map((conceptId) => byConcept.get(conceptId));
    const avgConfidence = chainFindings.reduce((sum, finding) => sum + finding.confidence, 0) / chainFindings.length;
    return Object.freeze({
      chainId: crypto.randomUUID(),
      label: template.label,
      nodes: present.map((conceptId) => ({ conceptId, findingId: byConcept.get(conceptId).findingId })),
      edges: present.slice(1).map((conceptId, index) => ({
        from: present[index],
        to: conceptId,
        relation: 'contributes_to'
      })),
      confidence: Number(avgConfidence.toFixed(4)),
      evidenceIds: [...new Set(chainFindings.flatMap((finding) => finding.evidenceIds))]
    });
  }).filter(Boolean).sort((a, b) => b.confidence - a.confidence || a.label.localeCompare(b.label));
}

module.exports = { buildCausalChains };

