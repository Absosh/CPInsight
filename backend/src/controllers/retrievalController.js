const retrievalService = require('../services/retrievalService');

function requirePlan(req) {
  const plan = req.body && req.body.plan;
  if (!plan || !Array.isArray(plan.retrievalSources)) {
    const error = new Error('plan with retrievalSources is required');
    error.status = 400;
    throw error;
  }
  return plan;
}

async function execute(req, res) {
  res.status(202).json(await retrievalService.execute(req.user.id, requirePlan(req), req.body.options || {}));
}

async function getPackage(req, res) {
  const result = await retrievalService.getPackage(req.user.id, req.params.id);
  if (!result) {
    res.status(404).json({ error: 'Evidence package not found' });
    return;
  }
  res.json(result);
}

function cache(_req, res) {
  res.json(retrievalService.cache());
}

async function metrics(req, res) {
  res.json({ metrics: await retrievalService.metrics(req.user.id, req.query.limit) });
}

function sources(_req, res) {
  res.json({ sources: retrievalService.sources() });
}

function health(_req, res) {
  res.json(retrievalService.health());
}

module.exports = { execute, getPackage, cache, metrics, sources, health };

