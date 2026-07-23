const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const behaviorController = require('../controllers/behaviorController');

const router = express.Router();

router.use(authenticate);
router.post('/extract', asyncHandler(behaviorController.extract));
router.get('/sessions', asyncHandler(behaviorController.sessions));
router.get('/profile', asyncHandler(behaviorController.profile));
router.get('/features', asyncHandler(behaviorController.features));
router.get('/trends', asyncHandler(behaviorController.trends));
router.get('/features/:featureName/compare', asyncHandler(behaviorController.compare));

module.exports = router;
