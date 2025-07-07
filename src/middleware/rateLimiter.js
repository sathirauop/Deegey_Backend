const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: {
    error: 'Too many login attempts',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || 'unknown');
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 70,
  message: {
    error: 'Too many registration attempts',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many password reset attempts',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip + ':' + (req.body.email || 'unknown');
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: {
      error: options.message || 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: options.retryAfter || '15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
  });
};

module.exports = {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  generalLimiter,
  createRateLimiter,
};
