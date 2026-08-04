function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch (_nested) {
        return null;
      }
    }
  }
  return null;
}

function extractJsonStringField(text, field) {
  if (!text || typeof text !== 'string') return null;
  const match = new RegExp(`"${field}"\\s*:\\s*"`, 'i').exec(text);
  if (!match) return null;

  let index = match.index + match[0].length;
  let escaped = false;
  let value = '';

  while (index < text.length) {
    const char = text[index];
    if (escaped) {
      value += `\\${char}`;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      try {
        return JSON.parse(`"${value}"`);
      } catch (_error) {
        return value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    } else {
      value += char;
    }
    index += 1;
  }

  return null;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalize(rawResponse) {
  const responseText = rawResponse.text || rawResponse.rawResponse || '';
  const parsed = typeof rawResponse === 'object' && rawResponse && rawResponse.observations
    ? rawResponse
    : tryParseJson(responseText) || {};
  const summary = parsed.summary || parsed.answer || extractJsonStringField(responseText, 'summary') || responseText || '';
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
