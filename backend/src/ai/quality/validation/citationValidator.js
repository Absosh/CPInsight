const { evidenceIds, attachedEvidence } = require('./groundingValidator');

function citationId(citation) {
  if (typeof citation === 'string') return citation;
  return citation.evidenceId || citation.id || citation.ref || citation.reference;
}

function validateCitations(response, evidencePackage, reasoningContext) {
  const known = evidenceIds(evidencePackage, reasoningContext);
  if (reasoningContext.retrievalMode === 'general' || known.size === 0) {
    return {
      valid: true,
      accepted: [],
      fabricated: [],
      quality: 1,
      skipped: true,
      reason: 'personal_context_unavailable_or_not_required'
    };
  }
  const fabricated = [];
  const accepted = [];
  for (const citation of response.citations) {
    const id = String(citationId(citation) || '');
    if (!known.has(id)) fabricated.push({ citation, reason: 'unknown_reference' });
    else accepted.push(id);
  }
  for (const group of [response.observations, response.inferences, response.recommendations]) {
    for (const item of group) {
      for (const id of attachedEvidence(item)) {
        if (!known.has(id)) fabricated.push({ citation: id, reason: 'unknown_inline_reference' });
      }
    }
  }
  return {
    valid: fabricated.length === 0,
    accepted: [...new Set(accepted)],
    fabricated,
    quality: response.citations.length ? Number((accepted.length / response.citations.length).toFixed(4)) : 1
  };
}

module.exports = { validateCitations };
