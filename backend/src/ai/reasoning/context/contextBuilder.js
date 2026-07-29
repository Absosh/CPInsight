const crypto = require('crypto');
const { ONTOLOGY_VERSION, ontologyDocument } = require('../ontology/behaviorOntology');
const { extractFindings } = require('../findings/findingExtractor');
const { buildCausalChains } = require('../causal/causalReasoner');
const { compressEvidence } = require('../compression/evidenceCompressor');
const { applyBudget } = require('./tokenBudget');

const REASONING_CONTEXT_VERSION = 1;

function classifyFindings(findings, contradictions) {
  const conflictEvidence = new Set((contradictions || []).flatMap((item) => item.evidenceIds || []));
  const strip = (finding) => ({
    findingId: finding.findingId,
    conceptId: finding.conceptId,
    findingType: finding.findingType,
    confidence: finding.confidence,
    evidenceCount: finding.evidenceCount,
    evidenceIds: finding.evidenceIds
  });
  return {
    confirmedFindings: findings.filter((finding) => finding.confidence >= 0.75 && !finding.evidenceIds.some((id) => conflictEvidence.has(id))).map(strip),
    weakFindings: findings.filter((finding) => finding.confidence < 0.6).map(strip),
    conflictingFindings: findings.filter((finding) => finding.evidenceIds.some((id) => conflictEvidence.has(id))).map(strip),
    needsMoreEvidence: findings.filter((finding) => finding.evidenceCount < 2).map(strip)
  };
}

function confidence(findings, evidencePackage) {
  if (!findings.length) return 0;
  const findingConfidence = findings.reduce((sum, finding) => sum + finding.confidence, 0) / findings.length;
  const packageConfidence = evidencePackage.confidenceSummary ? evidencePackage.confidenceSummary.averageConfidence || 0 : 0;
  const coverage = evidencePackage.missingEvidence && evidencePackage.retrievalMetadata
    ? 1 - (evidencePackage.missingEvidence.length / Math.max(1, evidencePackage.retrievalMetadata.sourceCount || 1))
    : 1;
  return Number(((findingConfidence * 0.45) + (packageConfidence * 0.35) + (coverage * 0.2)).toFixed(4));
}

function questionRelevantEvidence(evidencePackage) {
  const question = String(evidencePackage.question || '').toLowerCase();
  const topicPriorityQuestion = /\b(topic|practice|bridge (the )?gap|rating)\b/.test(question);
  if (!topicPriorityQuestion) return [];
  return (evidencePackage.evidence || [])
    .filter((item) => item.source === 'topic_performance' && item.payload && item.payload.topic)
    .slice()
    .sort((a, b) => {
      const priorityDelta = Number(b.payload.ratingGapPriorityScore || 0) - Number(a.payload.ratingGapPriorityScore || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return b.confidence - a.confidence;
    })
    .slice(0, 8)
    .map((item, index) => ({
      rank: index + 1,
      evidenceId: item.evidenceId,
      source: item.source,
      type: item.type,
      confidence: item.confidence,
      payload: item.payload
    }));
}

function buildReasoningContext(evidencePackage, { budget = '8k' } = {}) {
  const startedAt = Date.now();
  const findings = extractFindings(evidencePackage);
  const causalChains = buildCausalChains(findings.allFindings);
  const compression = compressEvidence(evidencePackage.evidence || [], { maxEvidence: budget === '4k' ? 24 : 80 });
  const classes = classifyFindings(findings.allFindings, evidencePackage.contradictions);
  const base = {
    contextId: crypto.randomUUID(),
    contextVersion: REASONING_CONTEXT_VERSION,
    ontologyVersion: ONTOLOGY_VERSION,
    evidencePackageId: evidencePackage.packageId,
    planId: evidencePackage.planId,
    userQuestion: evidencePackage.question || null,
    questionHash: evidencePackage.questionHash,
    userProfile: null,
    primaryFindings: findings.primaryFindings.map(({ evidence, averageRankScore, ...finding }) => finding),
    secondaryFindings: findings.secondaryFindings.map(({ evidence, averageRankScore, ...finding }) => finding),
    behaviorEvolution: {
      detected: compression.clusters.some((cluster) => cluster.type.includes('historical') || cluster.type.includes('pattern')),
      clusters: compression.clusters
    },
    causalChains,
    strengths: findings.allFindings.filter((finding) => finding.findingType === 'strength').map((finding) => finding.findingId),
    weaknesses: findings.allFindings.filter((finding) => finding.findingType === 'weakness').map((finding) => finding.findingId),
    evidenceSummary: {
      usedEvidence: compression.usedEvidence,
      discardedEvidenceIds: compression.discardedEvidenceIds,
      clusters: compression.clusters
    },
    questionRelevantEvidence: questionRelevantEvidence(evidencePackage),
    historicalComparison: {
      available: compression.clusters.some((cluster) => cluster.type.includes('historical') || cluster.type.includes('contest')),
      sourceClusters: compression.clusters.filter((cluster) => cluster.type.includes('historical') || cluster.type.includes('contest')).map((cluster) => cluster.clusterId)
    },
    contradictions: evidencePackage.contradictions || [],
    missingEvidence: evidencePackage.missingEvidence || [],
    findingClasses: classes,
    confidence: confidence(findings.allFindings, evidencePackage),
    reasoningMetadata: {
      createdAt: new Date().toISOString(),
      sourcePackageStatistics: evidencePackage.statistics || {},
      compressionStatistics: compression.statistics,
      findingCount: findings.allFindings.length,
      causalChainCount: causalChains.length,
      latencyMs: Date.now() - startedAt
    },
    ontology: ontologyDocument()
  };
  return applyBudget(base, budget);
}

module.exports = { REASONING_CONTEXT_VERSION, buildReasoningContext };
