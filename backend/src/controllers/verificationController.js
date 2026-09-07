const verificationService = require('../services/verificationService');
const { apiSuccess, apiError } = require('../utils/response');

class VerificationController {
  /**
   * Submit a verification (CONFIRM or DISPUTE) on an incident report.
   * POST /api/incidents/:id/verify
   */
  async submitVerification(req, res, next) {
    try {
      const { id: incidentId } = req.params;
      const { verification_type } = req.body;
      const userId = req.user.id;

      const result = await verificationService.submitVerification({
        incidentId,
        userId,
        verificationType: verification_type,
      });

      if (!result.success) {
        return apiError(res, result.statusCode, result.message);
      }

      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get community verification summary and current user's vote for an incident report.
   * GET /api/incidents/:id/verifications
   */
  async getIncidentVerifications(req, res, next) {
    try {
      const { id: incidentId } = req.params;
      const userId = req.user?.id || null;

      const result = await verificationService.getIncidentVerifications({
        incidentId,
        userId,
      });

      if (!result.success) {
        return apiError(res, result.statusCode, result.message);
      }

      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new VerificationController();
