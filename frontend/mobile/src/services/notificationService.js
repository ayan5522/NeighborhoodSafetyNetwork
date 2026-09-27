import apiClient from './apiClient';

/**
 * Notification Service for React Native / Expo Frontend (Module 7: Step 1)
 * Interfaces with the authenticated backend REST notification endpoints.
 */
class NotificationService {
  /**
   * Get user notification feed
   * GET /api/notifications
   */
  async getNotifications({ type = '', unreadOnly = false, page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (unreadOnly) params.append('unread_only', 'true');
    params.append('page', page);
    params.append('limit', limit);

    const response = await apiClient.get(`/notifications?${params.toString()}`);
    return response.data;
  }

  /**
   * Get unread notification count for badges / header icons
   * GET /api/notifications/unread-count
   */
  async getUnreadNotificationCount() {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      return response.data?.data?.unread_count || 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Mark a single notification as read
   * PATCH /api/notifications/:id/read
   */
  async markNotificationAsRead(notificationId) {
    const response = await apiClient.patch(`/notifications/${notificationId}/read`);
    return response.data?.data || response.data;
  }

  /**
   * Mark all unread notifications as read
   * PATCH /api/notifications/read-all
   */
  async markAllNotificationsAsRead() {
    const response = await apiClient.patch('/notifications/read-all');
    return response.data?.data || response.data;
  }
}

export default new NotificationService();
