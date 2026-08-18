const db = require('../../config/db');
const env = require('../../config/env');
const { generateOTP, hashOTP, verifyOTPHash } = require('../../utils/cryptoUtils');
const { OTP_PURPOSES, OTP_CHANNELS } = require('../../constants/otpPurposes');
const SmtpEmailOTPProvider = require('./smtpEmailProvider');
const MockEmailOTPProvider = require('./mockEmailProvider');
const MockSMSOTPProvider = require('./mockSmsProvider');
const logger = require('../../utils/logger');

// In-memory debug storage for development inspection
const devOTPStore = new Map();

class OTPService {
  constructor() {
    this.emailProvider = this.resolveEmailProvider();
    this.smsProvider = this.resolveSMSProvider();
  }

  resolveEmailProvider() {
    if (env.EMAIL_OTP_PROVIDER === 'smtp') {
      return new SmtpEmailOTPProvider();
    }
    return new MockEmailOTPProvider();
  }

  resolveSMSProvider() {
    // Currently returns mock SMS provider; extensible for real SMS gateway
    return new MockSMSOTPProvider();
  }

  /**
   * Generates, stores, and dispatches a new OTP.
   * Enforces 60-second resend cooldown and invalidates prior codes for the same purpose.
   */
  async generateAndSendOTP({ userId, recipient, purpose, channel }) {
    if (!userId || !recipient || !purpose || !channel) {
      throw new Error('userId, recipient, purpose, and channel are required.');
    }

    // 1. Check Resend Cooldown
    const recentOtpQuery = `
      SELECT created_at 
      FROM otp_verifications 
      WHERE user_id = $1 AND purpose = $2 AND channel = $3 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const recentRes = await db.query(recentOtpQuery, [userId, purpose, channel]);
    if (recentRes.rows.length > 0) {
      const lastCreatedAt = new Date(recentRes.rows[0].created_at).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastCreatedAt) / 1000);
      const cooldown = env.OTP_RESEND_COOLDOWN_SECONDS;

      if (elapsedSeconds < cooldown) {
        const remaining = cooldown - elapsedSeconds;
        return {
          success: false,
          code: 'COOLDOWN_ACTIVE',
          message: `Please wait ${remaining} seconds before requesting a new verification code.`,
          cooldownRemaining: remaining,
        };
      }
    }

    // 2. Invalidate any existing active OTPs for this user and purpose
    await db.query(
      `UPDATE otp_verifications 
       SET expires_at = NOW() 
       WHERE user_id = $1 AND purpose = $2 AND expires_at > NOW() AND verified_at IS NULL`,
      [userId, purpose]
    );

    // 3. Generate 6-digit cryptographically secure OTP
    const plainOtp = generateOTP();
    const hashedOtp = hashOTP(plainOtp);
    const expiryMinutes = env.OTP_EXPIRY_MINUTES;

    // 4. Save to Database
    const insertQuery = `
      INSERT INTO otp_verifications (user_id, purpose, channel, otp_hash, expires_at, attempts)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${expiryMinutes} minutes', 0)
      RETURNING id, expires_at, created_at
    `;
    const insertRes = await db.query(insertQuery, [userId, purpose, channel, hashedOtp]);
    const otpRecord = insertRes.rows[0];

    // Store in dev memory store for development testing
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      devOTPStore.set(`${userId}_${purpose}`, {
        otp: plainOtp,
        recipient,
        purpose,
        channel,
        expiresAt: otpRecord.expires_at,
        createdAt: otpRecord.created_at,
      });
    }

    // 5. Dispatch via appropriate provider
    if (channel === OTP_CHANNELS.EMAIL) {
      await this.emailProvider.sendOTP({ recipient, otp: plainOtp, purpose });
    } else if (channel === OTP_CHANNELS.SMS) {
      await this.smsProvider.sendOTP({ recipient, otp: plainOtp, purpose });
    }

    return {
      success: true,
      message: `Verification code sent to ${channel.toLowerCase()}.`,
      expiresInMinutes: expiryMinutes,
      cooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
      // For development/test convenience only
      devOtp: env.NODE_ENV !== 'production' ? plainOtp : undefined,
    };
  }

  /**
   * Verifies an OTP code for a user and purpose.
   */
  async verifyOTP({ userId, otp, purpose }) {
    if (!userId || !otp || !purpose) {
      return {
        success: false,
        message: 'User ID, OTP code, and purpose are required.',
      };
    }

    // Fetch the most recent active OTP record for this user and purpose
    const query = `
      SELECT id, otp_hash, expires_at, attempts, verified_at 
      FROM otp_verifications 
      WHERE user_id = $1 AND purpose = $2 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const res = await db.query(query, [userId, purpose]);

    if (res.rows.length === 0) {
      return {
        success: false,
        message: 'No verification code found. Please request a new code.',
      };
    }

    const record = res.rows[0];

    if (record.verified_at) {
      return {
        success: false,
        message: 'This verification code has already been used.',
      };
    }

    // Check if expired
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return {
        success: false,
        code: 'OTP_EXPIRED',
        message: 'Verification code has expired. Please request a new code.',
      };
    }

    // Check if attempts exceeded
    if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
      // Invalidate expired/exhausted OTP
      await db.query(`UPDATE otp_verifications SET expires_at = NOW() WHERE id = $1`, [record.id]);
      return {
        success: false,
        code: 'MAX_ATTEMPTS_EXCEEDED',
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      };
    }

    // Increment attempt count
    const updatedAttempts = record.attempts + 1;
    await db.query(`UPDATE otp_verifications SET attempts = $1 WHERE id = $2`, [updatedAttempts, record.id]);

    // Check OTP hash match
    const isMatch = verifyOTPHash(otp, record.otp_hash);

    if (!isMatch) {
      const remaining = env.OTP_MAX_ATTEMPTS - updatedAttempts;
      if (remaining <= 0) {
        await db.query(`UPDATE otp_verifications SET expires_at = NOW() WHERE id = $1`, [record.id]);
        return {
          success: false,
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Incorrect code. Maximum attempts reached. Please request a new code.',
          remainingAttempts: 0,
        };
      }
      return {
        success: false,
        code: 'INVALID_OTP',
        message: `Incorrect verification code. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining,
      };
    }

    // OTP is valid: mark as verified
    await db.query(`UPDATE otp_verifications SET verified_at = NOW() WHERE id = $1`, [record.id]);

    // Clean up dev store
    devOTPStore.delete(`${userId}_${purpose}`);

    return {
      success: true,
      message: 'Verification successful.',
    };
  }

  /**
   * Fetch all active development OTPs (development inspector endpoint).
   */
  getDevStore() {
    if (env.NODE_ENV === 'production') return [];
    const list = [];
    for (const [key, val] of devOTPStore.entries()) {
      list.push({ key, ...val });
    }
    return list;
  }
}

module.exports = new OTPService();
