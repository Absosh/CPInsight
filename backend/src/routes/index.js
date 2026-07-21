const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const platformRoutes = require('./platformRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const healthRoutes = require('./healthRoutes');
const debugRoutes = require('./debugRoutes');
const extensionRoutes = require('./extensionRoutes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/user', userRoutes);
router.use('/api/platforms', platformRoutes);
router.use('/api/analytics', analyticsRoutes);
router.use('/api/debug', debugRoutes);
router.use('/api/extension', extensionRoutes);

module.exports = router;
