const db = require('../config/db');
const { hashPassword, comparePassword, generateAccessToken, generateResetToken, verifyToken } = require('../utils/cryptoUtils');
const otpService = require('./otp/otpService');
const { OTP_PURPOSES, OTP_CHANNELS } = require('../constants/otpPurposes');
const { USER_STATUS } = require('../constants/userStatus');
const { ROLES } = require('../constants/roles');
const { normalizeIndianMobile } = require('../utils/phoneUtils');
const logger = require('../utils/logger');
const env = require('../config/env');

class AuthService {
  /**
   * Helper to format safe user object (removes passwords, OTPs, hashes)
   */
  sanitizeUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      mobile_number: user.mobile_number,
      role: user.role,
      status: user.status,
      email_verified: user.email_verified,
      email_verified_at: user.email_verified_at,
      mobile_verified: user.mobile_verified,
      mobile_verified_at: user.mobile_verified_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * Register a new resident user.
   */
  async register({ full_name, fullName, email, mobile_number, mobileNumber, password }) {
    const name = (full_name || fullName || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const rawMobile = (mobile_number || mobileNumber || '').trim();
    const cleanMobile = normalizeIndianMobile(rawMobile) || rawMobile;

    // 1. Check for duplicate email
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (emailCheck.rows.length > 0) {
      return {
        success: false,
        statusCode: 409,
        message: 'An account with this email address already exists.',
      };
    }

    // 2. Check for duplicate mobile number
    const mobileCheck = await db.query('SELECT id FROM users WHERE mobile_number = $1', [cleanMobile]);
    if (mobileCheck.rows.length > 0) {
      return {
        success: false,
        statusCode: 409,
        message: 'An account with this mobile number already exists.',
      };
    }

    // 3. Hash password securely using bcrypt (12 rounds)
    const password_hash = await hashPassword(password);

    // 4. Insert user record with default 'resident' role & 'PENDING_VERIFICATION' status
    const insertQuery = `
      INSERT INTO users (
        full_name, email, mobile_number, password_hash, role, status, email_verified, mobile_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE)
      RETURNING id, full_name, email, mobile_number, role, status, email_verified, mobile_verified, created_at
    `;
    const userRes = await db.query(insertQuery, [
      name,
      cleanEmail,
      cleanMobile,
      password_hash,
      ROLES.RESIDENT,
      USER_STATUS.PENDING_VERIFICATION,
    ]);

    const newUser = userRes.rows[0];

    // 5. Generate and dispatch Email OTP
    const emailOtpResult = await otpService.generateAndSendOTP({
      userId: newUser.id,
      recipient: newUser.email,
      purpose: OTP_PURPOSES.EMAIL_VERIFICATION,
      channel: OTP_CHANNELS.EMAIL,
    });

    // 6. Generate and dispatch Mobile OTP
    const smsOtpResult = await otpService.generateAndSendOTP({
      userId: newUser.id,
      recipient: newUser.mobile_number,
      purpose: OTP_PURPOSES.MOBILE_VERIFICATION,
      channel: OTP_CHANNELS.SMS,
    });

    logger.info(`User registered successfully: ${newUser.id} (${newUser.email})`);

    return {
      success: true,
      statusCode: 201,
      message: 'Registration successful! Please verify your email address and mobile number.',
      data: {
        user: this.sanitizeUser(newUser),
        email_otp_sent: emailOtpResult.success,
        mobile_otp_sent: smsOtpResult.success,
        dev_email_otp: emailOtpResult.devOtp,
        dev_mobile_otp: smsOtpResult.devOtp,
      },
    };
  }

  /**
   * Verify email OTP and activate account if mobile is also verified.
   */
  async verifyEmail({ user_id, email, otp }) {
    let user;
    if (user_id) {
      const res = await db.query('SELECT * FROM users WHERE id = $1', [user_id]);
      user = res.rows[0];
    } else if (email) {
      const res = await db.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      user = res.rows[0];
    }

    if (!user) {
      return { success: false, statusCode: 404, message: 'User account not found.' };
    }

    if (user.email_verified) {
      return {
        success: true,
        statusCode: 200,
        message: 'Email is already verified.',
        data: { user: this.sanitizeUser(user) },
      };
    }

    const verifyResult = await otpService.verifyOTP({
      userId: user.id,
      otp,
      purpose: OTP_PURPOSES.EMAIL_VERIFICATION,
    });

    if (!verifyResult.success) {
      return {
        success: false,
        statusCode: 400,
        message: verifyResult.message,
        code: verifyResult.code,
        remainingAttempts: verifyResult.remainingAttempts,
      };
    }

    // Mark email as verified
    const shouldActivate = user.mobile_verified;
    const newStatus = shouldActivate ? USER_STATUS.ACTIVE : user.status;

    const updateQuery = `
      UPDATE users 
      SET email_verified = TRUE, email_verified_at = NOW(), status = $1 
      WHERE id = $2 
      RETURNING *
    `;
    const updateRes = await db.query(updateQuery, [newStatus, user.id]);
    const updatedUser = updateRes.rows[0];

    logger.info(`Email verified for user: ${user.id}. Account status: ${newStatus}`);

    return {
      success: true,
      statusCode: 200,
      message: shouldActivate 
        ? 'Email verified! Your account is now fully active.' 
        : 'Email verified successfully. Please proceed to verify your mobile number.',
      data: {
        user: this.sanitizeUser(updatedUser),
        is_fully_activated: shouldActivate,
      },
    };
  }

  /**
   * Verify mobile OTP and activate account if email is also verified.
   */
  async verifyMobile({ user_id, mobile_number, mobileNumber, otp }) {
    let user;
    const rawMobile = mobile_number || mobileNumber;
    const cleanMobile = rawMobile ? (normalizeIndianMobile(rawMobile) || rawMobile) : null;

    if (user_id) {
      const res = await db.query('SELECT * FROM users WHERE id = $1', [user_id]);
      user = res.rows[0];
    } else if (cleanMobile) {
      const res = await db.query('SELECT * FROM users WHERE mobile_number = $1', [cleanMobile]);
      user = res.rows[0];
    }

    if (!user) {
      return { success: false, statusCode: 404, message: 'User account not found.' };
    }

    if (user.mobile_verified) {
      return {
        success: true,
        statusCode: 200,
        message: 'Mobile number is already verified.',
        data: { user: this.sanitizeUser(user) },
      };
    }

    const verifyResult = await otpService.verifyOTP({
      userId: user.id,
      otp,
      purpose: OTP_PURPOSES.MOBILE_VERIFICATION,
    });

    if (!verifyResult.success) {
      return {
        success: false,
        statusCode: 400,
        message: verifyResult.message,
        code: verifyResult.code,
        remainingAttempts: verifyResult.remainingAttempts,
      };
    }

    // Mark mobile as verified
    const shouldActivate = user.email_verified;
    const newStatus = shouldActivate ? USER_STATUS.ACTIVE : user.status;

    const updateQuery = `
      UPDATE users 
      SET mobile_verified = TRUE, mobile_verified_at = NOW(), status = $1 
      WHERE id = $2 
      RETURNING *
    `;
    const updateRes = await db.query(updateQuery, [newStatus, user.id]);
    const updatedUser = updateRes.rows[0];

    logger.info(`Mobile verified for user: ${user.id}. Account status: ${newStatus}`);

    return {
      success: true,
      statusCode: 200,
      message: shouldActivate 
        ? 'Mobile number verified! Your account is now fully active.' 
        : 'Mobile number verified successfully. Please proceed to verify your email address.',
      data: {
        user: this.sanitizeUser(updatedUser),
        is_fully_activated: shouldActivate,
      },
    };
  }

  /**
   * Resend an OTP code with cooldown check.
   */
  async resendOTP({ user_id, email, mobile_number, identifier, purpose, channel }) {
    let user;
    const lookupEmail = email || (channel === OTP_CHANNELS.EMAIL ? identifier : null);
    const lookupMobile = mobile_number || (channel === OTP_CHANNELS.SMS ? identifier : null);
    const cleanMobile = lookupMobile ? (normalizeIndianMobile(lookupMobile) || lookupMobile) : null;

    if (user_id) {
      const res = await db.query('SELECT * FROM users WHERE id = $1', [user_id]);
      user = res.rows[0];
    } else if (lookupEmail) {
      const res = await db.query('SELECT * FROM users WHERE email = $1', [lookupEmail.trim().toLowerCase()]);
      user = res.rows[0];
    } else if (cleanMobile) {
      const res = await db.query('SELECT * FROM users WHERE mobile_number = $1', [cleanMobile]);
      user = res.rows[0];
    }

    if (!user) {
      return {
        success: true,
        statusCode: 200,
        message: 'If an active account exists with the provided contact information, a verification code has been dispatched.',
      };
    }

    if (purpose === OTP_PURPOSES.EMAIL_VERIFICATION && user.email_verified) {
      return { success: false, statusCode: 400, message: 'Email address is already verified.' };
    }

    if (purpose === OTP_PURPOSES.MOBILE_VERIFICATION && user.mobile_verified) {
      return { success: false, statusCode: 400, message: 'Mobile number is already verified.' };
    }

    const recipient = channel === OTP_CHANNELS.EMAIL ? user.email : user.mobile_number;

    const sendRes = await otpService.generateAndSendOTP({
      userId: user.id,
      recipient,
      purpose,
      channel,
    });

    if (!sendRes.success) {
      return {
        success: false,
        statusCode: sendRes.code === 'COOLDOWN_ACTIVE' ? 429 : 400,
        message: sendRes.message,
        cooldownRemaining: sendRes.cooldownRemaining,
      };
    }

    return {
      success: true,
      statusCode: 200,
      message: `A new verification code has been sent to your ${channel.toLowerCase()}.`,
      data: {
        cooldown_seconds: sendRes.cooldownSeconds,
        dev_otp: sendRes.devOtp,
      },
    };
  }

  /**
   * Login with email and password.
   */
  async login({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const query = 'SELECT * FROM users WHERE email = $1';
    const res = await db.query(query, [cleanEmail]);

    if (res.rows.length === 0) {
      return {
        success: false,
        statusCode: 401,
        message: 'Invalid email address or password.',
      };
    }

    const user = res.rows[0];

    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return {
        success: false,
        statusCode: 401,
        message: 'Invalid email address or password.',
      };
    }

    if (user.status === USER_STATUS.PENDING_VERIFICATION) {
      return {
        success: false,
        statusCode: 403,
        message: 'Your account is pending verification. Please complete email and mobile verification before logging in.',
        data: {
          user_id: user.id,
          email: user.email,
          mobile_number: user.mobile_number,
          email_verified: user.email_verified,
          mobile_verified: user.mobile_verified,
          status: user.status,
        },
      };
    }

    if (user.status === USER_STATUS.SUSPENDED) {
      return {
        success: false,
        statusCode: 403,
        message: 'Your account has been suspended. Please contact support.',
      };
    }

    const token = generateAccessToken(user);

    logger.info(`User logged in successfully: ${user.id} (${user.email})`);

    return {
      success: true,
      statusCode: 200,
      message: 'Login successful.',
      data: {
        token,
        user: this.sanitizeUser(user),
      },
    };
  }

  /**
   * Request password reset code via Email or SMS (anti-enumeration generic response).
   */
  async forgotPassword({ channel, identifier }) {
    let user;
    const cleanId = (identifier || '').trim();
    if (channel === OTP_CHANNELS.EMAIL) {
      const res = await db.query('SELECT * FROM users WHERE email = $1', [cleanId.toLowerCase()]);
      user = res.rows[0];
    } else {
      const cleanMobile = normalizeIndianMobile(cleanId) || cleanId;
      const res = await db.query('SELECT * FROM users WHERE mobile_number = $1', [cleanMobile]);
      user = res.rows[0];
    }

    const genericResponse = {
      success: true,
      statusCode: 200,
      message: 'If an active account exists with the provided contact information, a verification code has been dispatched.',
    };

    if (!user || user.status === USER_STATUS.SUSPENDED) {
      return genericResponse;
    }

    const otpResult = await otpService.generateAndSendOTP({
      userId: user.id,
      recipient: channel === OTP_CHANNELS.EMAIL ? user.email : user.mobile_number,
      purpose: OTP_PURPOSES.PASSWORD_RESET,
      channel,
    });

    if (env.NODE_ENV !== 'production' && otpResult.devOtp) {
      genericResponse.data = {
        user_id: user.id,
        dev_otp: otpResult.devOtp,
      };
    }

    return genericResponse;
  }

  /**
   * Verify password reset OTP.
   */
  async verifyResetOTP({ identifier, channel, otp }) {
    let user;
    const cleanId = (identifier || '').trim();
    if (channel === OTP_CHANNELS.EMAIL) {
      const res = await db.query('SELECT * FROM users WHERE email = $1', [cleanId.toLowerCase()]);
      user = res.rows[0];
    } else {
      const cleanMobile = normalizeIndianMobile(cleanId) || cleanId;
      const res = await db.query('SELECT * FROM users WHERE mobile_number = $1', [cleanMobile]);
      user = res.rows[0];
    }

    if (!user) {
      return {
        success: false,
        statusCode: 400,
        message: 'Invalid verification code or user.',
      };
    }

    const verifyResult = await otpService.verifyOTP({
      userId: user.id,
      otp,
      purpose: OTP_PURPOSES.PASSWORD_RESET,
    });

    if (!verifyResult.success) {
      return {
        success: false,
        statusCode: 400,
        message: verifyResult.message,
        code: verifyResult.code,
        remainingAttempts: verifyResult.remainingAttempts,
      };
    }

    const reset_token = generateResetToken(user);

    return {
      success: true,
      statusCode: 200,
      message: 'OTP verified successfully. You may now reset your password.',
      data: {
        reset_token,
      },
    };
  }

  /**
   * Reset user password using the verified reset_token or direct OTP verification.
   */
  async resetPassword({ reset_token, resetToken, channel, identifier, otp, new_password, newPassword, password }) {
    const tokenToUse = reset_token || resetToken;
    const passwordToSet = new_password || newPassword || password;
    let userId;

    if (tokenToUse) {
      let decoded;
      try {
        decoded = verifyToken(tokenToUse);
        userId = decoded.id;
      } catch (err) {
        return {
          success: false,
          statusCode: 400,
          message: 'Password reset session has expired or is invalid. Please request a new code.',
        };
      }
    } else if (identifier && otp && channel) {
      const cleanId = identifier.trim();
      let userRes;
      if (channel === OTP_CHANNELS.EMAIL) {
        userRes = await db.query('SELECT * FROM users WHERE email = $1', [cleanId.toLowerCase()]);
      } else {
        const cleanMobile = normalizeIndianMobile(cleanId) || cleanId;
        userRes = await db.query('SELECT * FROM users WHERE mobile_number = $1', [cleanMobile]);
      }

      if (userRes.rows.length === 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'Password reset failed. Invalid request.',
        };
      }

      const user = userRes.rows[0];
      const verifyResult = await otpService.verifyOTP({
        userId: user.id,
        otp,
        purpose: OTP_PURPOSES.PASSWORD_RESET,
      });

      if (!verifyResult.success) {
        return {
          success: false,
          statusCode: 400,
          message: verifyResult.message,
        };
      }
      userId = user.id;
    } else {
      return {
        success: false,
        statusCode: 400,
        message: 'Reset token or verification parameters required.',
      };
    }

    const password_hash = await hashPassword(passwordToSet);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, userId]);

    logger.info(`Password successfully reset for user: ${userId}`);

    return {
      success: true,
      statusCode: 200,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    };
  }
}

module.exports = new AuthService();
