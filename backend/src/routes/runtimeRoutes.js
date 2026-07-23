const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const runtimeController = require('../controllers/runtimeController');

const router = express.Router();

router.use(authenticate);
router.post('/execute', asyncHandler(runtimeController.execute));
router.post('/stream', asyncHandler(runtimeController.stream));
router.get('/providers', runtimeController.providers);
router.get('/models', runtimeController.models);
router.get('/metrics', asyncHandler(runtimeController.metrics));
router.get('/health', runtimeController.health);
router.post('/cancel', runtimeController.cancel);

module.exports = router;

