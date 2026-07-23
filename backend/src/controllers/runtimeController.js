const runtimeService = require('../services/runtimeService');

function requireRuntimeInput(req) {
  const { executionPlan, promptPackage, override } = req.body || {};
  if (!executionPlan || !promptPackage) {
    const error = new Error('executionPlan and promptPackage are required');
    error.status = 400;
    throw error;
  }
  return { executionPlan, promptPackage, override: override || {} };
}

async function execute(req, res) {
  res.status(202).json(await runtimeService.execute(req.user.id, requireRuntimeInput(req), false));
}

async function stream(req, res) {
  res.status(202).json(await runtimeService.execute(req.user.id, requireRuntimeInput(req), true));
}

function providers(_req, res) {
  res.json({ providers: runtimeService.providers() });
}

function models(_req, res) {
  res.json({ models: runtimeService.models() });
}

async function metrics(req, res) {
  res.json({ metrics: await runtimeService.metrics(req.user.id, req.query.limit) });
}

function health(_req, res) {
  res.json(runtimeService.health());
}

function cancel(req, res) {
  res.json(runtimeService.cancel(req.body && req.body.runtimeRequestId));
}

module.exports = { execute, stream, providers, models, metrics, health, cancel };

