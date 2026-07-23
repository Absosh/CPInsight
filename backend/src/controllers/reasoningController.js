const reasoningService = require('../services/reasoningService');

function requireEvidencePackage(req) {
  const evidencePackage = req.body && req.body.evidencePackage;
  if (!evidencePackage || !Array.isArray(evidencePackage.evidence)) {
    const error = new Error('evidencePackage with evidence is required');
    error.status = 400;
    throw error;
  }
  return evidencePackage;
}

function requireReasoningContext(req) {
  const reasoningContext = req.body && req.body.reasoningContext;
  if (!reasoningContext || !reasoningContext.contextId) {
    const error = new Error('reasoningContext is required');
    error.status = 400;
    throw error;
  }
  return reasoningContext;
}

async function createContext(req, res) {
  res.status(202).json(await reasoningService.createContext(req.user.id, requireEvidencePackage(req), req.body.options || {}));
}

async function createPrompt(req, res) {
  res.status(202).json(await reasoningService.createPrompt(req.user.id, requireReasoningContext(req), req.body.options || {}));
}

function ontology(_req, res) {
  res.json(reasoningService.ontology());
}

async function getContext(req, res) {
  const row = await reasoningService.getContext(req.user.id, req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Reasoning context not found' });
    return;
  }
  res.json(row);
}

async function getPrompt(req, res) {
  const row = await reasoningService.getPrompt(req.user.id, req.params.id);
  if (!row) {
    res.status(404).json({ error: 'Prompt package not found' });
    return;
  }
  res.json(row);
}

async function metrics(req, res) {
  res.json({ metrics: await reasoningService.metrics(req.user.id, req.query.limit) });
}

module.exports = { createContext, createPrompt, ontology, getContext, getPrompt, metrics };

