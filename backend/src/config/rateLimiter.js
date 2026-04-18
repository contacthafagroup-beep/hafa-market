'use strict';
const rateLimit = require('express-rate-limit');
const { getRedis, isAvailable } = require('./redis');
const logger = require('./logger');

// ===== REDIS STORE FOR RATE LIMITING =====
// Falls back to memory store if Redis is unavailable
function makeStore() {
  if (isAvailable()) {
    try {
      const { RedisStore } = require('rate-limit-redis');
      return new RedisStore({
        sendCommand: (...args) => getRedis().sendCommand(args),
        prefix: 'rl:',
      });
    } catch (e) {
      logger.warn('rate-limit-redis unavailable, using memory store');
    }
  }
  return undefined; // express-rate-limit uses memory store by default
}

const handler = (req, res) => {
  logger.warn(`Rate limit hit: ${req.ip} → ${req.method} ${req.originalUrl}`);
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please slow down and try again later.',
    retryAfter: Math.ceil(req.rateLimit?.resetTime / 1000) || 60,
  });
};

// ===== LIMITERS =====

// General API — 300 req / 15 min
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  handler,
  skip: (req) => req.method === 'OPTIONS',
});

// Auth routes — 100 req / 15 min in dev, 20 in production
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  handler: (req, res) => {
    logger.warn(`Auth rate limit hit: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please wait 15 minutes before trying again.',
    });
  },
});

// OTP / SMS — 5 req / 10 min (prevent SMS abuse)
exports.otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many OTP requests. Please wait 10 minutes.',
    });
  },
});

// Search — 60 req / min (prevent scraping)
exports.searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  handler,
});

// Upload — 20 req / hour
exports.uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  handler: (req, res) => {
    res.status(429).json({ success: false, message: 'Upload limit reached. Try again in an hour.' });
  },
});

// Payment — 10 req / 5 min (prevent payment spam)
exports.paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  handler: (req, res) => {
    res.status(429).json({ success: false, message: 'Too many payment requests. Please wait 5 minutes.' });
  },
});

// Payment initiation — 5 per 10 min per user (anti-abuse)
exports.paymentInitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true, legacyHeaders: false,
  store: makeStore(),
  handler: (req, res) => {
    logger.warn(`Payment init rate limit: user=${req.user?.id} ip=${req.ip}`);
    res.status(429).json({ success: false, message: 'Too many payment attempts. Please wait 10 minutes.', retryAfter: 600 });
  },
});

// Proof upload — 3 per 30 min per user (anti-fake-receipt spam)
exports.proofUploadLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true, legacyHeaders: false,
  store: makeStore(),
  handler: (req, res) => {
    logger.warn(`Proof upload rate limit: user=${req.user?.id} ip=${req.ip}`);
    res.status(429).json({ success: false, message: 'Too many proof submissions. Please wait 30 minutes.' });
  },
});

// Refund request — 3 per hour per user
exports.refundLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true, legacyHeaders: false,
  store: makeStore(),
  handler: (req, res) => {
    res.status(429).json({ success: false, message: 'Too many refund requests. Please wait 1 hour.' });
  },
});
