const plannerService = require('../services/plannerService');

function requireQuestion(req) {
  const question = req.body && req.body.question;
  if (!question || typeof question !== 'string') {
    const error = new Error('question is required');
    error.status = 400;
    throw error;
  }
  return question;
}

async function classify(req, res) {
  res.json(await plannerService.classify(req.user.id, requireQuestion(req)));
}

async function plan(req, res) {
  const question = requireQuestion(req);
  res.status(202).json(await plannerService.plan(req.user.id, question, req.body.options || {}));
}

function intents(_req, res) {
  res.json({ intents: plannerService.intents() });
}

function sources(_req, res) {
  res.json({ sources: plannerService.sources() });
}

function strategies(_req, res) {
  res.json({ strategies: plannerService.strategies() });
}

module.exports = { classify, plan, intents, sources, strategies };

