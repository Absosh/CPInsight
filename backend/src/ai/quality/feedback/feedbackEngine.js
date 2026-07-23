const ALLOWED_FEEDBACK = new Set(['helpful', 'not_helpful', 'incorrect', 'too_generic', 'too_long', 'too_short', 'needs_more_evidence']);

function normalizeFeedback(input) {
  const type = String(input.feedbackType || '').toLowerCase();
  if (!ALLOWED_FEEDBACK.has(type)) {
    const error = new Error('Invalid feedback type');
    error.status = 400;
    throw error;
  }
  return Object.freeze({
    responseId: input.responseId,
    feedbackType: type,
    metadata: input.metadata || {},
    createdAt: new Date().toISOString()
  });
}

module.exports = { normalizeFeedback, ALLOWED_FEEDBACK };

