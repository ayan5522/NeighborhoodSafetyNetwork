const notificationService = require('../services/notificationService');
const { validateNotificationFeedQuery, validateUUID } = require('../validators/notificationValidators');

class NotificationController {
  /**
   * GET /api/notifications
   * Retrieve current authenticated user's notifications.
   */
  async getNotifications(req, res, next) {
    try {
      const validation = validateNotificationFeedQuery(req.query);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: validation.errors,
        });
      }

      const { type, unread_only, page = 1, limit = 20 } = req.query;

      const feed = await notificationService.getUserNotifications({
        userId: req.user.id,
        type,
        unreadOnly: unread_only === 'true' || unread_only === true,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });

      return res.status(200).json({
        success: true,
        data: feed.notifications,
        pagination: feed.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Return count of unread notifications for badge display.
   */
  async getUnreadCount(req, res, next) {
    try {
      const count = await notificationService.getUnreadNotificationCount({
        userId: req.user.id,
      });

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
   * PATCH /api/notifications/:id/read
   * Mark a single notification as read.
   */
  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid notification ID format. Must be a valid UUID.',
        });
      }

      const updated = await notificationService.markNotificationAsRead({
        notificationId: id,
        userId: req.user.id,
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * Mark all unread notifications for the user as read.
   */
  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllNotificationsAsRead({
        userId: req.user.id,
      });

      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
