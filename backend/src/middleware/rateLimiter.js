const rateLimit = require('express-rate-limit');
const { apiError } = require('../utils/response');

/**
 * General authentication rate limiter
 * Allows 20 requests per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return apiError(res, 429, 'Too many requests from this IP. Please try again after 15 minutes.');
  },
  skip: () => process.env.NODE_ENV === 'test', // Skip in automated test suite
});

/**
 * Strict limiter for OTP generation and password reset
 * Allows 10 requests per 10-minute window.
 */
const strictOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return apiError(res, 429, 'Too many OTP requests. Please slow down and try again later.');
  },
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = {
  authLimiter,
  strictOtpLimiter,
};
