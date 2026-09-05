import apiClient from './apiClient';

class SOSService {
  /**
   * Trigger Personal Emergency SOS
   */
  async triggerSOS({ latitude, longitude, notifyContact = false }) {
    const response = await apiClient.post('/sos', {
      latitude,
      longitude,
      notify_contact: notifyContact,
    });
    return response.data;
  }

  /**
   * Get current user's SOS history
   */
  async getMySOSEvents({ page = 1, limit = 20 } = {}) {
    const response = await apiClient.get(`/sos/my?page=${page}&limit=${limit}`);
    return response.data;
  }

  /**
   * Resolve or cancel an active SOS event
   */
  async resolveSOS(sosId, action = 'RESOLVE') {
    const response = await apiClient.patch(`/sos/${sosId}/resolve`, {
      action,
    });
    return response.data?.data;
  }
}

export default new SOSService();
