const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const retrievalController = require('../controllers/retrievalController');

const router = express.Router();

router.use(authenticate);
router.post('/execute', asyncHandler(retrievalController.execute));
router.get('/package/:id', asyncHandler(retrievalController.getPackage));
router.get('/cache', retrievalController.cache);
router.get('/metrics', asyncHandler(retrievalController.metrics));
router.get('/sources', retrievalController.sources);
router.get('/health', retrievalController.health);

module.exports = router;

