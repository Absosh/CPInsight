const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const { analyticsLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/combined', authenticate, analyticsLimiter, asyncHandler(analyticsController.combined));
router.get('/:platform(codeforces|codechef|leetcode)', authenticate, analyticsLimiter, asyncHandler(analyticsController.platform));

module.exports = router;
