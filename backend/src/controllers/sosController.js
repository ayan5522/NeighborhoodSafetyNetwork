const sosService = require('../services/sosService');
const { validateSOSTrigger } = require('../validators/sosValidators');
const { validateUUID } = require('../validators/alertValidators');

class SOSController {
  /**
   * POST /api/sos
   * Trigger a Personal Emergency SOS event
   */
  async triggerSOS(req, res, next) {
    try {
      const validation = validateSOSTrigger(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: validation.errors,
        });
      }

      const { latitude, longitude, notify_contact } = req.body;

      const result = await sosService.triggerSOS({
        userId: req.user.id,
        latitude,
        longitude,
        notifyContact: notify_contact === true || notify_contact === 'true',
      });

      return res.status(201).json({
        success: true,
        message: 'Emergency SOS activated successfully.',
        data: result.sosEvent,
        contact_notification: result.contactNotification,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/sos/my
   * Get current user's SOS history and active SOS events
   */
  async getMySOSEvents(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const feed = await sosService.getMySOSEvents({
        userId: req.user.id,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return res.status(200).json({
        success: true,
        data: feed.events,
        pagination: feed.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/sos/:id/resolve
   * Resolve or cancel an active SOS event
   */
  async resolveSOS(req, res, next) {
    try {
      const { id } = req.params;
      const { action = 'RESOLVE' } = req.body || {};

      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid SOS event ID format. Must be a valid UUID.',
        });
      }

      const resolved = await sosService.resolveSOS({
        sosId: id,
        userId: req.user.id,
        action: action.toUpperCase(),
      });

      if (!resolved) {
        return res.status(404).json({
          success: false,
          message: 'SOS event not found.',
        });
      }

      return res.status(200).json({
        success: true,
        message: `SOS event has been ${resolved.status.toLowerCase()}.`,
        data: resolved,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SOSController();
