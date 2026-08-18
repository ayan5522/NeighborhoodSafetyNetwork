const otpService = require('../services/otp/otpService');
const { apiSuccess, apiError } = require('../utils/response');
const env = require('../config/env');

class DevController {
  async getDevOTPs(req, res) {
    if (env.NODE_ENV === 'production') {
      return apiError(res, 404, 'Dev inspector is disabled in production.');
    }
    const otps = otpService.getDevStore();
    return apiSuccess(res, 200, 'Development active OTP store retrieved.', { otps });
  }
}

module.exports = new DevController();
