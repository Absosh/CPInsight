const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.use(authenticate);
router.post('/route', asyncHandler(taskController.route));
router.post('/plan', asyncHandler(taskController.plan));
router.get('/tasks', taskController.tasks);
router.get('/strategies', taskController.strategies);
router.get('/schemas', taskController.schemas);
router.get('/policies', taskController.policies);
router.get('/execution/:id', asyncHandler(taskController.execution));

module.exports = router;

