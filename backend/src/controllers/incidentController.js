const incidentService = require('../services/incidentService');
const { apiSuccess, apiError } = require('../utils/response');

class IncidentController {
  /**
   * Create a new safety incident.
   */
  async createIncident(req, res, next) {
    try {
      const { category, title, description, severity, latitude, longitude, image_url } = req.body;
      const result = await incidentService.createIncident({
        reporterId: req.user.id,
        category,
        title,
        description,
        severity,
        latitude,
        longitude,
        imageUrl: image_url || null,
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
   * Get all incidents reported by the authenticated user.
   */
  async getMyIncidents(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await incidentService.getMyIncidents({
        reporterId: req.user.id,
        page,
        limit,
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
   * Get single incident details (strictly owned by reporter).
   */
  async getIncidentById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await incidentService.getIncidentById({
        incidentId: id,
        userId: req.user.id,
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
   * Update pending incident report details.
   */
  async updateIncident(req, res, next) {
    try {
      const { id } = req.params;
      const { category, title, description, severity } = req.body;
      const result = await incidentService.updateIncident({
        incidentId: id,
        userId: req.user.id,
        category,
        title,
        description,
        severity,
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
   * Cancel an incident report.
   */
  async cancelIncident(req, res, next) {
    try {
      const { id } = req.params;
      const result = await incidentService.cancelIncident({
        incidentId: id,
        userId: req.user.id,
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
   * Get active nearby incidents within a radius for Neighborhood Map display.
   */
  async getNearbyIncidents(req, res, next) {
    try {
      const { latitude, longitude, radius, category, severity } = req.query;
      const result = await incidentService.getNearbyActiveIncidents({
        userId: req.user.id,
        latitude,
        longitude,
        radiusMeters: radius,
        category,
        severity,
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

module.exports = new IncidentController();
