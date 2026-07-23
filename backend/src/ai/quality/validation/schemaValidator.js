function validateSchema(response) {
  const errors = [];
  const repaired = { ...response };
  for (const field of ['observations', 'inferences', 'recommendations', 'citations', 'uncertainty']) {
    if (!Array.isArray(repaired[field])) {
      errors.push(`${field} must be an array`);
      repaired[field] = repaired[field] ? [repaired[field]] : [];
    }
  }
  if (typeof repaired.summary !== 'string') {
    errors.push('summary must be a string');
    repaired.summary = String(repaired.summary || '');
  }
  repaired.confidence = Math.max(0, Math.min(1, Number(repaired.confidence || 0)));
  if (repaired.summary.length > 4000) {
    errors.push('summary exceeded maximum length and was truncated');
    repaired.summary = repaired.summary.slice(0, 4000);
  }
  const malformed = !repaired.summary && !repaired.observations.length && !repaired.inferences.length;
  return {
    valid: !malformed,
    repaired: Object.freeze(repaired),
    errors,
    repairedDeterministically: errors.length > 0 || Boolean(response.metadata && response.metadata.repairedFromText)
  };
}

module.exports = { validateSchema };
