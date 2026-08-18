const authService = require('../services/authService');
const { apiSuccess, apiError } = require('../utils/response');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      if (!result.success) {
        return apiError(res, result.statusCode, result.message);
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const result = await authService.verifyEmail(req.body);
      if (!result.success) {
        return apiError(res, result.statusCode, result.message, result.code ? [result.code] : []);
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  async verifyMobile(req, res, next) {
    try {
      const result = await authService.verifyMobile(req.body);
      if (!result.success) {
        return apiError(res, result.statusCode, result.message, result.code ? [result.code] : []);
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  async resendOTP(req, res, next) {
    try {
      const result = await authService.resendOTP(req.body);
      if (!result.success) {
        return apiError(res, result.statusCode, result.message, { cooldownRemaining: result.cooldownRemaining });
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);
      if (!result.success) {
        return apiError(res, result.statusCode, result.message, result.data || []);
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword(req.body);
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  async verifyResetOTP(req, res, next) {
    try {
      const { identifier, channel, otp } = req.body;
      if (!identifier || !channel || !otp) {
        return apiError(res, 400, 'Identifier, channel (EMAIL/SMS), and OTP code are required.');
      }
      const result = await authService.verifyResetOTP({ identifier, channel, otp });
      if (!result.success) {
        return apiError(res, result.statusCode, result.message);
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword(req.body);
      if (!result.success) {
        return apiError(res, result.statusCode, result.message);
      }
      return apiSuccess(res, result.statusCode, result.message);
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      return apiSuccess(res, 200, 'Logged out successfully.');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
