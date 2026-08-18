const OTPProviderInterface = require('./otpProviderInterface');
const logger = require('../../utils/logger');
const { normalizeIndianMobile } = require('../../utils/phoneUtils');

/**
 * ====================================================================
 * DEVELOPMENT & TESTING ONLY: Mock SMS OTP Provider
 * ====================================================================
 * Simulates Indian SMS Gateway delivery without requiring paid SMS subscriptions.
 * Formats the number according to Indian mobile standards (+91XXXXXXXXXX)
 * and displays the simulated SMS payload in the development console.
 * 
 * Extensibility Note:
 * To integrate a real SMS gateway (e.g. MSG91, Textlocal, Fast2SMS) in the future:
 * 1. Create `RealSmsProvider` extending `OTPProviderInterface`.
 * 2. Implement `sendOTP({ recipient, otp, purpose })` calling the gateway API.
 * 3. Update `SMS_OTP_PROVIDER` in `.env`.
 * No authentication logic needs to change.
 */
class MockSMSOTPProvider extends OTPProviderInterface {
  async sendOTP({ recipient, otp, purpose }) {
    const normalizedPhone = normalizeIndianMobile(recipient) || recipient;
    logger.devOTP('MOCK SMS (DEV ONLY)', normalizedPhone, otp, purpose);

    return {
      success: true,
      messageId: `mock-sms-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      recipient: normalizedPhone,
    };
  }
}

module.exports = MockSMSOTPProvider;
