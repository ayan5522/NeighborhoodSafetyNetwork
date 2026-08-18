const userService = require('../services/userService');
const { apiSuccess, apiError } = require('../utils/response');

class UserController {
  async getProfile(req, res, next) {
    try {
      const result = await userService.getProfile(req.user.id);
      if (!result.success) {
        return apiError(res, result.statusCode, result.message);
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { full_name, fullName } = req.body;
      const nameToUpdate = full_name || fullName;
      const result = await userService.updateProfile(req.user.id, { full_name: nameToUpdate });
      if (!result.success) {
        return apiError(res, result.statusCode, result.message);
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
