const nodemailer = require('nodemailer');
const OTPProviderInterface = require('./otpProviderInterface');
const env = require('../../config/env');
const logger = require('../../utils/logger');

class SmtpEmailOTPProvider extends OTPProviderInterface {
  constructor() {
    super();
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });
    } catch (err) {
      logger.error('Failed to initialize SMTP transporter', err);
    }
  }

  /**
   * Format friendly human-readable title based on purpose.
   */
  getPurposeTitle(purpose) {
    switch (purpose) {
      case 'EMAIL_VERIFICATION':
        return 'Verify Your Email Address';
      case 'PASSWORD_RESET':
        return 'Password Reset Request';
      default:
        return 'Verification Code';
    }
  }

  async sendOTP({ recipient, otp, purpose }) {
    const title = this.getPurposeTitle(purpose);
    const subject = `[${env.APP_NAME}] ${title}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #1e3a8a; text-align: center;">${env.APP_NAME}</h2>
        <h3 style="color: #333333; text-align: center;">${title}</h3>
        <p style="color: #555555; font-size: 14px; line-height: 1.5;">
          Use the verification code below to complete your verification for the <strong>Neighborhood Safety Network</strong>. This code is valid for <strong>${env.OTP_EXPIRY_MINUTES} minutes</strong>.
        </p>
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${otp}</span>
        </div>
        <p style="color: #dc2626; font-size: 12px;">
          Do not share this OTP with anyone. Our safety team will never ask for your verification code.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center;">
          If you did not request this code, please ignore this email.
        </p>
      </div>
    `;

    try {
      if (!this.transporter) {
        this.initTransporter();
      }

      const info = await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: recipient,
        subject,
        html: htmlContent,
      });

      logger.info(`Email OTP sent successfully to ${recipient} (Message ID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error(`SMTP Email dispatch failed to ${recipient}: ${err.message}`);
      // In dev fallback, also log OTP so development doesn't get blocked by invalid SMTP credentials
      if (env.NODE_ENV === 'development') {
        logger.devOTP('SMTP (Fallback Mock)', recipient, otp, purpose);
      }
      return { success: false, error: err.message };
    }
  }
}

module.exports = SmtpEmailOTPProvider;
