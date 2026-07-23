const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const qualityController = require('../controllers/qualityController');

const router = express.Router();

router.use(authenticate);
router.post('/validate', asyncHandler(qualityController.validate));
router.post('/reflections', asyncHandler(qualityController.reflections));
router.post('/feedback', asyncHandler(qualityController.feedback));
router.get('/quality/:id', asyncHandler(qualityController.quality));
router.get('/reflections/:user', asyncHandler(qualityController.getReflections));
router.get('/feedback/metrics', asyncHandler(qualityController.feedbackMetrics));
router.get('/validation/metrics', asyncHandler(qualityController.validationMetrics));

module.exports = router;

