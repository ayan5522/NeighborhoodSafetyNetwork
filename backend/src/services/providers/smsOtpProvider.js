const OTPProvider = require('./otpProvider.interface');

/**
 * Mock SMS OTP Provider (Development Only)
 * Allows developers and team members to test Indian Mobile OTP flows
 * without incurring third-party SMS provider charges.
 */
class MockSMSOTPProvider extends OTPProvider {
  async sendOTP(mobileNumber, otp, purpose) {
    const formattedPurpose = purpose.replace(/_/g, ' ');
    const message = `[Neighborhood Safety Network] Your verification code for ${formattedPurpose} is: ${otp}. Valid for 10 minutes.`;

    console.log(`\n======================================================`);
    console.log(`[DEVELOPMENT MOCK SMS PROVIDER - DEV ONLY]`);
    console.log(`To Mobile: ${mobileNumber}`);
    console.log(`Purpose:   ${purpose}`);
    console.log(`OTP Code:  ${otp}`);
    console.log(`SMS Body:  "${message}"`);
    console.log(`======================================================\n`);

    return true;
  }
}

/**
 * Factory / Switch to obtain active SMS provider
 */
function getSMSProvider() {
  // In future production releases, real Indian SMS gateway (e.g. Fast2SMS / MSG91) can be instantiated here
  return new MockSMSOTPProvider();
}

module.exports = getSMSProvider();
