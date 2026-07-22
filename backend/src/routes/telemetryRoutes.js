const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const telemetryController = require('../controllers/telemetryController');
const { telemetryUploadSchema } = require('../validators/telemetrySchemas');

const router = express.Router();

router.post('/upload', authenticate, validate(telemetryUploadSchema), asyncHandler(telemetryController.upload));

module.exports = router;
