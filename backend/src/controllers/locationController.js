const locationService = require('../services/locationService');
const { apiSuccess, apiError } = require('../utils/response');

class LocationController {
  /**
   * Save or update authenticated user's current GPS location.
   */
  async updateLocation(req, res, next) {
    try {
      const { latitude, longitude, accuracy } = req.body;
      const result = await locationService.updateUserLocation({
        userId: req.user.id,
        latitude,
        longitude,
        accuracy,
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
   * Get authenticated user's current stored location.
   */
  async getMyLocation(req, res, next) {
    try {
      const result = await locationService.getUserLocation(req.user.id);
      if (!result.success) {
        return apiError(res, result.statusCode, result.message);
      }
      return apiSuccess(res, result.statusCode, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get nearby safety perimeter within configurable radius (PostGIS ST_DWithin).
   * Strict privacy enforced: other users' exact coordinates and identities are never exposed.
   */
  async getNearby(req, res, next) {
    try {
      const { radius, latitude, longitude } = req.query;
      const result = await locationService.getNearbySafetyPerimeter({
        userId: req.user.id,
        latitude,
        longitude,
        radiusMeters: radius,
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
   * Get approximate neighborhood / locality for coordinates or authenticated user.
   */
  async getNeighborhood(req, res, next) {
    try {
      const { latitude, longitude } = req.query;
      const result = await locationService.getNeighborhoodInfo({
        userId: req.user.id,
        latitude,
        longitude,
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

module.exports = new LocationController();
