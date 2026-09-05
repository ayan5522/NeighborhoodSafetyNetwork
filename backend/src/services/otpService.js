const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const constants = require('../config/constants');
const emailOtpProvider = require('./providers/emailOtpProvider');
const smsOtpProvider = require('./providers/smsOtpProvider');

class OTPService {
  /**
   * Generate a secure 6-digit numeric OTP
   */
  generateNumericOTP() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Create, hash, store, and dispatch an OTP
   */
  async createAndSendOTP(userId, recipient, purpose, channel) {
    // 1. Check Resend Cooldown
    const cooldownCheck = await db.query(
      `SELECT created_at FROM otp_verifications 
       WHERE user_id = $1 AND purpose = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, purpose]
    );

    if (cooldownCheck.rows.length > 0) {
      const lastCreated = new Date(cooldownCheck.rows[0].created_at).getTime();
      const now = Date.now();
      const diffSeconds = Math.floor((now - lastCreated) / 1000);
      if (diffSeconds < constants.SECURITY.OTP_RESEND_COOLDOWN_SECONDS) {
        const waitSeconds = constants.SECURITY.OTP_RESEND_COOLDOWN_SECONDS - diffSeconds;
        const err = new Error(`Please wait ${waitSeconds} seconds before requesting a new OTP.`);
        err.statusCode = 429;
        throw err;
      }
    }

    // 2. Invalidate previous unverified OTPs for this user & purpose
    await db.query(
      `DELETE FROM otp_verifications WHERE user_id = $1 AND purpose = $2`,
      [userId, purpose]
    );

    // 3. Generate OTP and hash
    const rawOtp = this.generateNumericOTP();
    const otpHash = await bcrypt.hash(rawOtp, constants.SECURITY.BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + constants.SECURITY.OTP_EXPIRY_MINUTES * 60 * 1000);

    // 4. Save hashed OTP to database
    await db.query(
      `INSERT INTO otp_verifications (user_id, purpose, channel, otp_hash, expires_at, attempts, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, NOW())`,
      [userId, purpose, channel, otpHash, expiresAt]
    );

    // 5. Dispatch via appropriate provider
    if (channel === constants.OTP_CHANNELS.EMAIL) {
      await emailOtpProvider.sendOTP(recipient, rawOtp, purpose);
    } else if (channel === constants.OTP_CHANNELS.SMS) {
      await smsOtpProvider.sendOTP(recipient, rawOtp, purpose);
    }

    return {
      success: true,
      expiresAt,
    };
  }

  /**
   * Verify an OTP provided by the user
   */
  async verifyOTP(userId, purpose, inputOtp) {
    const res = await db.query(
      `SELECT id, otp_hash, expires_at, attempts 
       FROM otp_verifications 
       WHERE user_id = $1 AND purpose = $2 AND verified_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [userId, purpose]
    );

    if (res.rows.length === 0) {
      const err = new Error('No active verification code found. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }

    const otpRecord = res.rows[0];

    // Check expiration
    if (new Date() > new Date(otpRecord.expires_at)) {
      await db.query(`DELETE FROM otp_verifications WHERE id = $1`, [otpRecord.id]);
      const err = new Error('Verification code has expired. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }

    // Check attempt limit
    if (otpRecord.attempts >= constants.SECURITY.OTP_MAX_ATTEMPTS) {
      await db.query(`DELETE FROM otp_verifications WHERE id = $1`, [otpRecord.id]);
      const err = new Error('Maximum verification attempts exceeded. Please request a new code.');
      err.statusCode = 400;
      throw err;
    }

    // Verify hash match
    const isValid = await bcrypt.compare(inputOtp, otpRecord.otp_hash);
    if (!isValid) {
      // Increment attempt counter
      await db.query(
        `UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1`,
        [otpRecord.id]
      );
      const remainingAttempts = constants.SECURITY.OTP_MAX_ATTEMPTS - (otpRecord.attempts + 1);
      const err = new Error(
        remainingAttempts > 0
          ? `Invalid verification code. ${remainingAttempts} attempts remaining.`
          : 'Maximum verification attempts exceeded. Please request a new code.'
      );
      err.statusCode = 400;
      throw err;
    }

    // Success: delete or mark verified
    await db.query(
      `UPDATE otp_verifications SET verified_at = NOW() WHERE id = $1`,
      [otpRecord.id]
    );

    return true;
  }
}

module.exports = new OTPService();
