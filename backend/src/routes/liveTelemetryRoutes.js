const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const liveTelemetryController = require('../controllers/liveTelemetryController');
const {
  startLiveTelemetrySessionSchema,
  liveTelemetryEventsSchema,
  liveTelemetryHeartbeatSchema,
  stopLiveTelemetrySessionSchema
} = require('../validators/liveTelemetrySchemas');

const router = express.Router();

router.post('/session/start', authenticate, validate(startLiveTelemetrySessionSchema), asyncHandler(liveTelemetryController.start));
router.post('/events', authenticate, validate(liveTelemetryEventsSchema), asyncHandler(liveTelemetryController.events));
router.post('/session/heartbeat', authenticate, validate(liveTelemetryHeartbeatSchema), asyncHandler(liveTelemetryController.heartbeat));
router.post('/session/stop', authenticate, validate(stopLiveTelemetrySessionSchema), asyncHandler(liveTelemetryController.stop));

module.exports = router;
