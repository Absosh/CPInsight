const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/userSchemas');

const router = express.Router();

router.get('/profile', authenticate, asyncHandler(userController.getProfile));
router.patch('/profile', authenticate, validate(updateProfileSchema), asyncHandler(userController.updateProfile));

module.exports = router;
