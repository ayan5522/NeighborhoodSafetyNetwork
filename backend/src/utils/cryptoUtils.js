const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 * @returns {string} 6-digit OTP string
 */
function generateOTP() {
  const otpNumber = crypto.randomInt(100000, 1000000);
  return otpNumber.toString();
}

/**
 * Hash an OTP using SHA-256 before database storage.
 * @param {string} otp
 * @returns {string} SHA-256 hex string
 */
function hashOTP(otp) {
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
}

/**
 * Verify a plain OTP against a stored SHA-256 hash using timing-safe comparison.
 * @param {string} plainOTP
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyOTPHash(plainOTP, storedHash) {
  if (!plainOTP || !storedHash) return false;
  const computedHash = hashOTP(plainOTP);
  if (computedHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
}

/**
 * Hash a plaintext password using bcrypt with 12 salt rounds.
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plaintext password with a bcrypt password hash.
 * @param {string} plainPassword
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Generate a JWT access token for an authenticated user.
 * @param {object} payload - { id, email, role, status }
 * @returns {string} Signed JWT
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Generate a short-lived password reset token.
 * @param {object} payload - { id, email, purpose: 'PASSWORD_RESET' }
 * @returns {string} Signed JWT
 */
function generateResetToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      purpose: 'PASSWORD_RESET',
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_RESET_EXPIRES_IN }
  );
}

/**
 * Verify and decode a JWT.
 * @param {string} token
 * @returns {object} Decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTPHash,
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateResetToken,
  verifyToken,
};
