const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const plannerController = require('../controllers/plannerController');

const router = express.Router();

router.use(authenticate);
router.post('/classify', asyncHandler(plannerController.classify));
router.post('/plan', asyncHandler(plannerController.plan));
router.get('/intents', plannerController.intents);
router.get('/sources', plannerController.sources);
router.get('/strategies', plannerController.strategies);

module.exports = router;

