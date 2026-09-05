import apiClient from './apiClient';

class AlertService {
  /**
   * Get resident alert feed
   */
  async getAlerts({ status = '', unreadOnly = false, page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (unreadOnly) params.append('unread_only', 'true');
    params.append('page', page);
    params.append('limit', limit);

    const response = await apiClient.get(`/alerts?${params.toString()}`);
    return response.data;
  }

  /**
   * Get single alert details
   */
  async getAlertById(alertId) {
    const response = await apiClient.get(`/alerts/${alertId}`);
    return response.data?.data;
  }

  /**
   * Get unread active alert count for badge
   */
  async getUnreadCount() {
    try {
      const response = await apiClient.get('/alerts/unread-count');
      return response.data?.data?.unread_count || 0;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Mark alert as read
   */
  async markAsRead(alertId) {
    const response = await apiClient.patch(`/alerts/${alertId}/read`);
    return response.data?.data;
  }
}

export default new AlertService();
