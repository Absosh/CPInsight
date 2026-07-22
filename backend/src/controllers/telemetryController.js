const telemetryService = require('../services/telemetryService');

async function upload(req, res) {
  const acknowledgement = await telemetryService.uploadTelemetryBatch(req.user.id, req.body, req.headers);
  res.status(202).json(acknowledgement);
}

module.exports = { upload };
