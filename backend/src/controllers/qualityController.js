const qualityService = require('../services/qualityService');

function requireValidationInput(req) {
  const { executionPlan, reasoningContext, evidencePackage, rawResponse } = req.body || {};
  if (!executionPlan || !reasoningContext || !evidencePackage || !rawResponse) {
    const error = new Error('executionPlan, reasoningContext, evidencePackage, and rawResponse are required');
    error.status = 400;
    throw error;
  }
  return { executionPlan, reasoningContext, evidencePackage, rawResponse };
}

async function validate(req, res) {
  res.status(202).json(await qualityService.validate(req.user.id, requireValidationInput(req)));
}

async function reflections(req, res) {
  res.status(201).json({ reflections: await qualityService.storeReflections(req.user.id, req.body.validationId, req.body.reflections || []) });
}

async function feedback(req, res) {
  res.status(201).json(await qualityService.feedback(req.user.id, req.body || {}));
}

async function quality(req, res) {
  const row = await qualityService.quality(req.user.id, req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Validated response not found' });
    return;
  }
  res.json(row);
}

async function getReflections(req, res) {
  if (req.params.user !== req.user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  res.json({ reflections: await qualityService.reflections(req.params.user) });
}

async function feedbackMetrics(_req, res) {
  res.json({ metrics: await qualityService.feedbackMetrics() });
}

async function validationMetrics(req, res) {
  res.json({ metrics: await qualityService.validationMetrics(req.user.id) });
}

module.exports = { validate, reflections, feedback, quality, getReflections, feedbackMetrics, validationMetrics };
