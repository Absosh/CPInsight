const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const reasoningController = require('../controllers/reasoningController');

const router = express.Router();

router.use(authenticate);
router.post('/context', asyncHandler(reasoningController.createContext));
router.post('/prompt', asyncHandler(reasoningController.createPrompt));
router.get('/ontology', reasoningController.ontology);
router.get('/context/:id', asyncHandler(reasoningController.getContext));
router.get('/prompt/:id', asyncHandler(reasoningController.getPrompt));
router.get('/metrics', asyncHandler(reasoningController.metrics));

module.exports = router;

