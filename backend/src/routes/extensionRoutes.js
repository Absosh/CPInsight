const express = require('express');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const extensionController = require('../controllers/extensionController');
const { leetcodeCollectionSchema } = require('../validators/extensionSchemas');

const router = express.Router();

router.post(
  '/leetcode/collection',
  authenticate,
  validate(leetcodeCollectionSchema),
  asyncHandler(extensionController.uploadLeetCodeCollection)
);

module.exports = router;
