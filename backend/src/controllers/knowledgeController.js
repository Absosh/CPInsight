const knowledgeService = require('../services/knowledgeService');

async function infer(req, res) {
  res.status(202).json(await knowledgeService.infer(req.user.id, req.body || {}));
}

async function graph(req, res) {
  res.json(await knowledgeService.graph(req.user.id));
}

async function strengths(req, res) {
  res.json(await knowledgeService.strengths(req.user.id));
}

async function weaknesses(req, res) {
  res.json(await knowledgeService.weaknesses(req.user.id));
}

async function patterns(req, res) {
  res.json(await knowledgeService.patterns(req.user.id));
}

async function evolution(req, res) {
  res.json(await knowledgeService.evolution(req.user.id));
}

async function evidence(req, res) {
  res.json(await knowledgeService.evidence(req.user.id, req.params.insightId));
}

module.exports = { infer, graph, strengths, weaknesses, patterns, evolution, evidence };
