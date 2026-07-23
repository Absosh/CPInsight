const behaviorService = require('../services/behaviorService');

async function extract(req, res) {
  res.status(202).json(await behaviorService.runExtraction(req.user.id, req.body || {}));
}

async function sessions(req, res) {
  res.json(await behaviorService.getSessions(req.user.id, req.query.limit || 50));
}

async function profile(req, res) {
  res.json(await behaviorService.getProfile(req.user.id, req.query.window || 'all'));
}

async function features(req, res) {
  res.json(await behaviorService.getFeatures(req.user.id, req.query));
}

async function trends(req, res) {
  res.json(await behaviorService.getTrends(req.user.id, req.query));
}

async function compare(req, res) {
  res.json(await behaviorService.compareFeatures(req.user.id, req.params.featureName));
}

module.exports = { extract, sessions, profile, features, trends, compare };
