function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_nested) {
        return null;
      }
    }
  }
  return null;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalize(rawResponse) {
  const parsed = typeof rawResponse === 'object' && rawResponse && rawResponse.observations
    ? rawResponse
    : tryParseJson(rawResponse.text || rawResponse.rawResponse || '') || {};
  const summary = parsed.summary || parsed.answer || rawResponse.text || '';
  return Object.freeze({
    observations: asArray(parsed.observations),
    inferences: asArray(parsed.inferences),
    recommendations: asArray(parsed.recommendations),
    citations: asArray(parsed.citations),
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.5,
    uncertainty: asArray(parsed.uncertainty),
    summary: String(summary).slice(0, 4000),
    metadata: {
      provider: rawResponse.provider,
      model: rawResponse.model,
      runtimeRequestId: rawResponse.runtimeRequestId,
      repairedFromText: !parsed.observations
    }
  });
}

module.exports = { normalize };

