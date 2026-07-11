const express = require('express');
const healthController = require('../controllers/healthController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/health', asyncHandler(healthController.health));
router.get('/ready', asyncHandler(healthController.readiness));

module.exports = router;
