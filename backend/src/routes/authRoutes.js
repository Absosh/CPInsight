const express = require('express');
const authController = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiters');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema
} = require('../validators/authSchemas');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));
router.post('/refresh', authLimiter, validate(refreshSchema), asyncHandler(authController.refresh));
router.post('/logout', validate(logoutSchema), asyncHandler(authController.logout));

module.exports = router;
