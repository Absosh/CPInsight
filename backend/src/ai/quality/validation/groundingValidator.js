function textOf(item) {
  if (typeof item === 'string') return item;
  return item.text || item.claim || item.observation || JSON.stringify(item);
}

function evidenceIds(evidencePackage, reasoningContext) {
  const ids = new Set();
  for (const item of evidencePackage.evidence || []) ids.add(item.evidenceId);
  for (const item of reasoningContext.evidenceSummary?.usedEvidence || []) ids.add(item.evidenceId);
  return ids;
}

function attachedEvidence(item) {
  if (typeof item === 'object' && item) {
    return [
      ...new Set([
        ...((item.evidenceIds || item.evidence || item.citations || []).map(String)),
        ...(item.evidenceId ? [String(item.evidenceId)] : [])
      ])
    ];
  }
  return [];
}

function validateGrounding(response, evidencePackage, reasoningContext) {
  const known = evidenceIds(evidencePackage, reasoningContext);
  const unsupported = [];
  const accepted = [];
  for (const observation of response.observations) {
    const refs = attachedEvidence(observation);
    const validRefs = refs.filter((id) => known.has(id));
    if (!validRefs.length) unsupported.push({ observation: textOf(observation), reason: 'missing_valid_evidence' });
    else accepted.push({ observation: textOf(observation), evidenceIds: validRefs });
  }
  return {
    valid: unsupported.length === 0,
    accepted,
    unsupported,
    coverage: response.observations.length ? Number((accepted.length / response.observations.length).toFixed(4)) : 1
  };
}

module.exports = { validateGrounding, evidenceIds, attachedEvidence, textOf };

