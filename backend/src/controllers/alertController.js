const alertService = require('../services/alertService');
const { validateAlertFeedQuery, validateUUID } = require('../validators/alertValidators');

class AlertController {
  /**
   * GET /api/alerts
   * Retrieve resident alert feed
   */
  async getAlerts(req, res, next) {
    try {
      const validation = validateAlertFeedQuery(req.query);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: validation.errors,
        });
      }

      const { status, unread_only, page = 1, limit = 20 } = req.query;

      const feed = await alertService.getUserAlertFeed({
        userId: req.user.id,
        status,
        unreadOnly: unread_only === 'true' || unread_only === true,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return res.status(200).json({
        success: true,
        data: feed.alerts,
        pagination: feed.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/alerts/unread-count
   * Get count of unread active alerts for badge display
   */
  async getUnreadCount(req, res, next) {
    try {
      const count = await alertService.getUnreadAlertCount({ userId: req.user.id });

      return res.status(200).json({
        success: true,
        data: {
          unread_count: count,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/alerts/:id
   * Get single alert details
   */
  async getAlertById(req, res, next) {
    try {
      const { id } = req.params;
      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid alert ID format. Must be a valid UUID.',
        });
      }

      const alert = await alertService.getAlertById({ alertId: id, userId: req.user.id });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found.',
        });
      }

      return res.status(200).json({
        success: true,
        data: alert,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/alerts/:id/read
   * Mark alert as read
   */
  async markRead(req, res, next) {
    try {
      const { id } = req.params;
      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid alert ID format. Must be a valid UUID.',
        });
      }

      const updated = await alertService.markAlertAsRead({ alertId: id, userId: req.user.id });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Alert not found.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Alert marked as read.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AlertController();
