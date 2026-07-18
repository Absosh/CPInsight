const analyticsService = require('../services/analyticsService');
const compareService = require('../services/compareService');

async function platform(req, res) {
  res.json(await analyticsService.getPlatformAnalytics(req.user.id, req.params.platform, req.query.window || 'all'));
}

async function combined(req, res) {
  res.json(await analyticsService.getCombinedAnalytics(req.user.id, req.query.window || 'all'));
}

async function compare(req, res) {
  res.json(await compareService.compareUsers(req.user.id, req.params.username));
}

module.exports = { platform, combined, compare };
