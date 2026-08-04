const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const conversationController = require('../controllers/conversationController');

const router = express.Router();

router.use(authenticate);
router.get('/conversations', asyncHandler(conversationController.list));
router.post('/conversations', asyncHandler(conversationController.create));
router.post('/conversations/search', asyncHandler(conversationController.search));
router.get('/conversations/:id', asyncHandler(conversationController.get));
router.post('/conversations/:id/messages', asyncHandler(conversationController.addMessage));
router.patch('/conversations/:id', asyncHandler(conversationController.update));
router.delete('/conversations/:id', asyncHandler(conversationController.remove));
router.post('/conversations/:id/archive', asyncHandler(conversationController.archive));
router.post('/conversations/:id/pin', asyncHandler(conversationController.pin));
router.post('/conversations/:id/rename', asyncHandler(conversationController.rename));

module.exports = router;
