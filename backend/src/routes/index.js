const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const platformRoutes = require('./platformRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const healthRoutes = require('./healthRoutes');
const debugRoutes = require('./debugRoutes');
const extensionRoutes = require('./extensionRoutes');
const telemetryRoutes = require('./telemetryRoutes');
const behaviorRoutes = require('./behaviorRoutes');
const knowledgeRoutes = require('./knowledgeRoutes');
const plannerRoutes = require('./plannerRoutes');
const retrievalRoutes = require('./retrievalRoutes');
const reasoningRoutes = require('./reasoningRoutes');
const taskRoutes = require('./taskRoutes');
const runtimeRoutes = require('./runtimeRoutes');
const qualityRoutes = require('./qualityRoutes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/user', userRoutes);
router.use('/api/platforms', platformRoutes);
router.use('/api/analytics', analyticsRoutes);
router.use('/api/debug', debugRoutes);
router.use('/api/extension', extensionRoutes);
router.use('/api/telemetry', telemetryRoutes);
router.use('/api/behavior', behaviorRoutes);
router.use('/api/knowledge', knowledgeRoutes);
router.use('/api/ai/planner', plannerRoutes);
router.use('/api/ai/retrieval', retrievalRoutes);
router.use('/api/ai/reasoning', reasoningRoutes);
router.use('/api/ai/runtime', runtimeRoutes);
router.use('/api/ai', taskRoutes);
router.use('/api/ai', qualityRoutes);

module.exports = router;
