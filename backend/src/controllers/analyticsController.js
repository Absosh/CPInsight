const analyticsService = require('../services/analyticsService');

async function platform(req, res) {
  res.json(await analyticsService.getPlatformAnalytics(req.user.id, req.params.platform, req.query.window || 'all'));
}

async function combined(req, res) {
  res.json(await analyticsService.getCombinedAnalytics(req.user.id, req.query.window || 'all'));
}

module.exports = { platform, combined };
