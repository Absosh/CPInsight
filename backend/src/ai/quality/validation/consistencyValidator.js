const { textOf } = require('./groundingValidator');

function dedupeStrings(rows) {
  const seen = new Set();
  const duplicates = [];
  for (const row of rows) {
    const text = textOf(row).toLowerCase();
    if (seen.has(text)) duplicates.push(text);
    seen.add(text);
  }
  return duplicates;
}

function validateConsistency(response) {
  const duplicates = [
    ...dedupeStrings(response.observations),
    ...dedupeStrings(response.inferences),
    ...dedupeStrings(response.recommendations)
  ];
  const circular = response.inferences.filter((inference) => {
    const text = textOf(inference).toLowerCase();
    return response.observations.some((observation) => text === textOf(observation).toLowerCase());
  });
  return {
    valid: duplicates.length === 0 && circular.length === 0,
    duplicates,
    circularReasoning: circular.map(textOf),
    contradictionCount: 0
  };
}

module.exports = { validateConsistency };

