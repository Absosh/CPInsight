const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1000, // Increased for development
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50, // Increased for development
  standardHeaders: true,
  legacyHeaders: false
});

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 500, // Increased for development
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { globalLimiter, authLimiter, analyticsLimiter };
