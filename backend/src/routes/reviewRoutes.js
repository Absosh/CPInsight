const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/reviewController');

const router = express.Router();

router.use(authenticate);
router.get('/jobs/:id', asyncHandler(controller.getJob));
router.get('/jobs', asyncHandler(controller.listJobs));
router.get('/latest', asyncHandler(controller.latest));
router.get('/status/:contestId', asyncHandler(controller.status));

module.exports = router;
