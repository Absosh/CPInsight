const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { updateProfileSchema, avatarUploadSchema, collegeQuerySchema } = require('../validators/userSchemas');

const router = express.Router();

router.get('/profile', authenticate, asyncHandler(userController.getProfile));
router.get('/colleges', authenticate, validate(collegeQuerySchema, 'query'), asyncHandler(userController.searchColleges));
router.patch('/profile', authenticate, validate(updateProfileSchema), asyncHandler(userController.updateProfile));
router.post('/profile/avatar', authenticate, validate(avatarUploadSchema), asyncHandler(userController.uploadAvatar));
router.delete('/profile/avatar', authenticate, asyncHandler(userController.deleteAvatar));

module.exports = router;
