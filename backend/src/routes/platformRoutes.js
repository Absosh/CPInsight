const express = require('express');
const platformController = require('../controllers/platformController');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { connectSchema, disconnectSchema, platformParamSchema } = require('../validators/platformSchemas');

const router = express.Router();

router.get('/accounts', authenticate, asyncHandler(platformController.list));
router.post('/connect', authenticate, validate(connectSchema), asyncHandler(platformController.connect));
router.delete('/disconnect', authenticate, validate(disconnectSchema), asyncHandler(platformController.disconnect));
router.post('/sync', authenticate, asyncHandler(platformController.syncAccounts));
router.post('/sync/:platform', authenticate, validate(platformParamSchema, 'params'), asyncHandler(platformController.syncAccount));

module.exports = router;
