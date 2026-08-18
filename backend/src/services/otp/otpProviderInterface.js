/**
 * Abstract Base Class / Interface for OTP Providers
 */
class OTPProviderInterface {
  /**
   * Send an OTP code to a recipient.
   * @param {object} params
   * @param {string} params.recipient - Destination email or phone number
   * @param {string} params.otp - 6-digit plain OTP code
   * @param {string} params.purpose - EMAIL_VERIFICATION, MOBILE_VERIFICATION, or PASSWORD_RESET
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendOTP({ recipient, otp, purpose }) {
    throw new Error('Method sendOTP() must be implemented by subclass.');
  }
}

module.exports = OTPProviderInterface;
