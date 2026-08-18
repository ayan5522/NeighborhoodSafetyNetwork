const OTPProviderInterface = require('./otpProviderInterface');
const logger = require('../../utils/logger');

/**
 * ====================================================================
 * DEVELOPMENT & TESTING ONLY: Mock Email OTP Provider
 * ====================================================================
 * Simulates email delivery by safely printing formatted OTP notifications
 * to the terminal console during development and testing without requiring
 * external SMTP network connections or paid services.
 */
class MockEmailOTPProvider extends OTPProviderInterface {
  async sendOTP({ recipient, otp, purpose }) {
    logger.devOTP('MOCK EMAIL (DEV ONLY)', recipient, otp, purpose);
    return {
      success: true,
      messageId: `mock-email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }
}

module.exports = MockEmailOTPProvider;
