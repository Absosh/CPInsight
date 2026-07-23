const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const knowledgeController = require('../controllers/knowledgeController');

const router = express.Router();

router.use(authenticate);
router.post('/infer', asyncHandler(knowledgeController.infer));
router.get('/graph', asyncHandler(knowledgeController.graph));
router.get('/strengths', asyncHandler(knowledgeController.strengths));
router.get('/weaknesses', asyncHandler(knowledgeController.weaknesses));
router.get('/patterns', asyncHandler(knowledgeController.patterns));
router.get('/evolution', asyncHandler(knowledgeController.evolution));
router.get('/insights/:insightId/evidence', asyncHandler(knowledgeController.evidence));

module.exports = router;
