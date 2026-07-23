const liveTelemetryService = require('../services/liveTelemetryService');

async function start(req, res) {
  res.status(201).json(await liveTelemetryService.startSession(req.user.id, req.body));
}

async function events(req, res) {
  res.status(202).json(await liveTelemetryService.ingestEvents(req.user.id, req.body, req.headers));
}

async function heartbeat(req, res) {
  res.status(202).json(await liveTelemetryService.heartbeat(req.user.id, req.body));
}

async function stop(req, res) {
  res.status(202).json(await liveTelemetryService.stopSession(req.user.id, req.body));
}

module.exports = { start, events, heartbeat, stop };
