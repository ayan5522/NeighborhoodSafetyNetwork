const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

const passThrough = (req, res, next) => next();

// General API rate limiter
const generalLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per window
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again after 15 minutes.',
      },
    });

// Strict rate limiter for sensitive auth endpoints (login, forgot-password, OTP verification)
const authLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Too many authentication attempts, please try again after 15 minutes.',
      },
    });

// Rate limiter for OTP resend requests
const otpLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 10 * 60 * 1000, // 10 minutes
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Too many OTP requests, please try again after 10 minutes.',
      },
    });

module.exports = {
  generalLimiter,
  authLimiter,
  otpLimiter,
};
