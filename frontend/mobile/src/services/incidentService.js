import apiClient, { API_BASE_URL } from './apiClient';
import { Platform } from 'react-native';

export const incidentService = {
  /**
   * Submit a new safety incident report (supports optional photo attachment).
   */
  async createIncident({ category, title, description, severity, latitude, longitude, imageUri }) {
    if (imageUri) {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('severity', severity);
      formData.append('latitude', String(latitude));
      formData.append('longitude', String(longitude));

      // Append image based on platform
      const filename = imageUri.split('/').pop() || 'incident_photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';

      if (Platform.OS === 'web') {
        // On web, if it's a blob/data URI or File object
        try {
          const res = await fetch(imageUri);
          const blob = await res.blob();
          formData.append('image', blob, filename);
        } catch (e) {
          console.warn('[IncidentService Web] Blob conversion fallback:', e);
        }
      } else {
        formData.append('image', {
          uri: imageUri,
          name: filename,
          type,
        });
      }

      const response = await apiClient.post('/incidents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data?.data || response.data;
    }

    // Pure JSON payload without image
    const response = await apiClient.post('/incidents', {
      category,
      title,
      description,
      severity,
      latitude,
      longitude,
    });
    return response.data?.data || response.data;
  },

  /**
   * Fetch list of safety incident reports submitted by current resident.
   */
  async getMyIncidents(params = {}) {
    const response = await apiClient.get('/incidents/my', { params });
    return response.data?.data || response.data;
  },

  /**
   * Fetch specific incident details by ID.
   */
  async getIncidentById(id) {
    const response = await apiClient.get(`/incidents/${id}`);
    return response.data?.data || response.data;
  },

  /**
   * Update pending incident report details.
   */
  async updateIncident(id, data) {
    const response = await apiClient.patch(`/incidents/${id}`, data);
    return response.data?.data || response.data;
  },

  /**
   * Cancel an incident report.
   */
  async cancelIncident(id) {
    const response = await apiClient.patch(`/incidents/${id}/cancel`);
    return response.data?.data || response.data;
  },

  /**
   * Fetch active nearby incidents within radius for map display.
   */
  async getNearbyIncidents({ latitude, longitude, radius, category, severity } = {}) {
    const params = {};
    if (latitude !== undefined && latitude !== null) params.latitude = latitude;
    if (longitude !== undefined && longitude !== null) params.longitude = longitude;
    if (radius !== undefined && radius !== null) params.radius = radius;
    if (category) params.category = category;
    if (severity) params.severity = severity;

    const response = await apiClient.get('/incidents/nearby', { params });
    return response.data?.data || response.data;
  },

  /**
   * Get community verification summary and status for an incident.
   */
  async getIncidentVerifications(incidentId) {
    const response = await apiClient.get(`/incidents/${incidentId}/verifications`);
    return response.data?.data || response.data;
  },

  /**
   * Submit a verification (CONFIRM or DISPUTE) on an incident report.
   */
  async verifyIncident(incidentId, verificationType) {
    const response = await apiClient.post(`/incidents/${incidentId}/verify`, {
      verification_type: verificationType,
    });
    return response.data?.data || response.data;
  },

  /**
   * Helper to construct full public image URL from server relative path.
   */
  getImageUrl(relativePath) {
    if (!relativePath) return null;
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    // Remove /api from base url if present for static file endpoint
    const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${baseUrl}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
  },
};

export default incidentService;
