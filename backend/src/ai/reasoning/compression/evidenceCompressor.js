function evidencePriority(item) {
  return Number(((item.rankScore || 0) * 0.6 + item.confidence * 0.4).toFixed(4));
}

function compressEvidence(evidence, { maxEvidence = 80 } = {}) {
  const grouped = new Map();
  for (const item of evidence) {
    const key = `${item.source}:${item.type}`;
    const group = grouped.get(key) || [];
    group.push(item);
    grouped.set(key, group);
  }

  const clusters = [...grouped.entries()].map(([key, rows]) => {
    const sorted = rows.slice().sort((a, b) => evidencePriority(b) - evidencePriority(a));
    return Object.freeze({
      clusterId: key,
      source: sorted[0].source,
      type: sorted[0].type,
      evidenceCount: sorted.length,
      representativeEvidenceIds: sorted.slice(0, 5).map((item) => item.evidenceId),
      averageConfidence: Number((sorted.reduce((sum, item) => sum + item.confidence, 0) / sorted.length).toFixed(4)),
      latestTimestamp: sorted.reduce((latest, item) => latest > item.timestamp ? latest : item.timestamp, sorted[0].timestamp)
    });
  }).sort((a, b) => b.averageConfidence - a.averageConfidence || b.evidenceCount - a.evidenceCount);

  const sortedEvidence = evidence.slice().sort((a, b) => evidencePriority(b) - evidencePriority(a));
  const used = sortedEvidence.slice(0, maxEvidence);
  const discarded = sortedEvidence.slice(maxEvidence);
  return Object.freeze({
    usedEvidence: used,
    discardedEvidenceIds: discarded.map((item) => item.evidenceId),
    clusters,
    statistics: {
      originalEvidenceCount: evidence.length,
      usedEvidenceCount: used.length,
      discardedEvidenceCount: discarded.length,
      compressionRatio: evidence.length ? Number((used.length / evidence.length).toFixed(4)) : 1
    }
  });
}

module.exports = { compressEvidence };

