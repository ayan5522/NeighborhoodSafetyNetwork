/**
 * Base OTP Provider Interface
 */
class OTPProvider {
  /**
   * @param {string} recipient - email or mobile number
   * @param {string} otp - generated 6-digit OTP code
   * @param {string} purpose - purpose of OTP
   * @returns {Promise<boolean>}
   */
  async sendOTP(recipient, otp, purpose) {
    throw new Error('sendOTP must be implemented by subclass');
  }
}

module.exports = OTPProvider;
