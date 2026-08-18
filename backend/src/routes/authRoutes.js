const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const {
  validateRegisterInput,
  validateLoginInput,
  validateVerifyOTPInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} = require('../validators/authValidators');
const { authLimiter, strictOtpLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Registration
router.post(
  '/register',
  authLimiter,
  validate(validateRegisterInput),
  authController.register
);

// Email Verification
router.post(
  '/verify-email',
  authLimiter,
  validate(validateVerifyOTPInput),
  authController.verifyEmail
);

// Mobile Verification
router.post(
  '/verify-mobile',
  authLimiter,
  validate(validateVerifyOTPInput),
  authController.verifyMobile
);

// Resend Verification Code
router.post(
  '/resend-otp',
  strictOtpLimiter,
  authController.resendOTP
);

// Login
router.post(
  '/login',
  authLimiter,
  validate(validateLoginInput),
  authController.login
);

// Forgot Password - Initiate
router.post(
  '/forgot-password',
  strictOtpLimiter,
  validate(validateForgotPasswordInput),
  authController.forgotPassword
);

// Forgot Password - Verify Code
router.post(
  '/verify-reset-otp',
  strictOtpLimiter,
  authController.verifyResetOTP
);

// Reset Password - Set New Password
router.post(
  '/reset-password',
  authLimiter,
  validate(validateResetPasswordInput),
  authController.resetPassword
);

// Logout
router.post(
  '/logout',
  requireAuth,
  authController.logout
);

module.exports = router;
