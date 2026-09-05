const nodemailer = require('nodemailer');
const OTPProvider = require('./otpProvider.interface');
const env = require('../../config/env');

class EmailOTPProvider extends OTPProvider {
  constructor() {
    super();
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    if (env.SMTP.USER && env.SMTP.PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP.HOST,
        port: env.SMTP.PORT,
        secure: env.SMTP.SECURE,
        auth: {
          user: env.SMTP.USER,
          pass: env.SMTP.PASS,
        },
      });
    }
  }

  async sendOTP(email, otp, purpose) {
    const subjectMap = {
      EMAIL_VERIFICATION: 'Verify Your Email - Neighborhood Safety Network',
      PASSWORD_RESET: 'Password Reset Code - Neighborhood Safety Network',
    };

    const subject = subjectMap[purpose] || 'Verification Code - Neighborhood Safety Network';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e3a8a; text-align: center;">Neighborhood Safety Network</h2>
        <p style="font-size: 16px; color: #334155;">Your verification code for <strong>${purpose.replace('_', ' ')}</strong> is:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e3a8a; background: #eff6ff; padding: 12px 24px; border-radius: 6px;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #64748b;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Open Source Neighborhood Safety & Alert Network</p>
      </div>
    `;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: env.SMTP.EMAIL_FROM,
          to: email,
          subject,
          html: htmlContent,
        });
        return true;
      } catch (err) {
        console.error('[EmailOTPProvider] Error sending email via SMTP:', err.message);
        // Fall back to dev log
      }
    }

    // Development & testing fallback: log OTP to console
    console.log(`\n========================================`);
    console.log(`[DEVELOPMENT EMAIL OTP]`);
    console.log(`To: ${email}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`========================================\n`);
    return true;
  }
}

module.exports = new EmailOTPProvider();
