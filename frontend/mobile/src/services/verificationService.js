import apiClient from './apiClient';

class VerificationService {
  /**
   * Get aggregated verification counts, community status, and current user's vote.
   * GET /api/incidents/:id/verifications
   */
  async getIncidentVerifications(incidentId) {
    const response = await apiClient.get(`/incidents/${incidentId}/verifications`);
    return response.data?.data || response.data;
  }

  /**
   * Submit a verification vote (CONFIRM or DISPUTE) on an incident report.
   * POST /api/incidents/:id/verify
   */
  async submitVerification(incidentId, verificationType) {
    const response = await apiClient.post(`/incidents/${incidentId}/verify`, {
      verification_type: verificationType,
    });
    return response.data?.data || response.data;
  }
}

export default new VerificationService();
