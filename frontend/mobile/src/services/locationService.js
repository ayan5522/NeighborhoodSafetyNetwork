import * as Location from 'expo-location';
import { Platform } from 'react-native';
import apiClient from './apiClient';

export const locationService = {
  /**
   * Check if location services (GPS hardware) are enabled on the device.
   */
  async isLocationServicesEnabled() {
    try {
      if (Platform.OS === 'web') {
        return true;
      }
      return await Location.isLocationServicesEnabledAsync();
    } catch (err) {
      console.warn('[LocationService] isLocationServicesEnabled error:', err);
      return true;
    }
  },

  /**
   * Check current foreground location permission status without prompting.
   */
  async checkPermissionStatus() {
    try {
      if (Platform.OS === 'web') {
        return { granted: true, canAskAgain: true };
      }
      const status = await Location.getForegroundPermissionsAsync();
      return status;
    } catch (err) {
      console.warn('[LocationService] checkPermissionStatus error:', err);
      return { granted: false, canAskAgain: true };
    }
  },

  /**
   * Request user foreground location permission.
   */
  async requestPermission() {
    try {
      if (Platform.OS === 'web') {
        return { granted: true };
      }
      const result = await Location.requestForegroundPermissionsAsync();
      return result;
    } catch (err) {
      console.warn('[LocationService] requestPermission error:', err);
      return { granted: false, error: err.message };
    }
  },

  /**
   * Obtain current GPS coordinates (Single non-continuous retrieval).
   */
  async getCurrentPosition() {
    // 1. Check if location services are enabled
    const isServicesEnabled = await this.isLocationServicesEnabled();
    if (!isServicesEnabled) {
      throw new Error('Location services (GPS) are disabled on your device. Please enable GPS in device settings.');
    }

    // 2. Check & Request permission
    const permission = await this.requestPermission();
    if (!permission.granted) {
      throw new Error('Location permission was denied. Please allow location access in settings to use neighborhood safety features.');
    }

    // 3. Web platform GPS handling with Ratnagiri fallback for development simulators
    if (Platform.OS === 'web') {
      try {
        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            return reject(new Error('Geolocation not supported on this browser.'));
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 8000,
            enableHighAccuracy: false,
          });
        });
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 10,
          timestamp: new Date(pos.timestamp).toISOString(),
        };
      } catch (e) {
        console.warn('[LocationService Web] Web GPS fallback to college ROSP default (Ratnagiri):', e.message);
        return {
          latitude: 16.9902,
          longitude: 73.3120,
          accuracy: 15,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // 4. Native Device GPS retrieval via expo-location
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: new Date(location.timestamp).toISOString(),
      };
    } catch (err) {
      // If fine GPS times out, try last known position
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy || 0,
            timestamp: new Date(lastKnown.timestamp).toISOString(),
          };
        }
      } catch (lastErr) {}

      throw new Error(`Unable to determine your GPS location: ${err.message}`);
    }
  },

  /**
   * Send and sync current user coordinates with backend PostgreSQL / PostGIS.
   */
  async syncLocationWithBackend({ latitude, longitude, accuracy }) {
    const response = await apiClient.post('/location', {
      latitude,
      longitude,
      accuracy,
    });
    return response.data?.data || response.data;
  },

  /**
   * Get authenticated user's latest stored location from backend.
   */
  async getMySavedLocation() {
    const response = await apiClient.get('/location/me');
    return response.data?.data || response.data;
  },

  /**
   * Query nearby safety circle and active resident count within radius (in meters).
   */
  async getNearbySafetyPerimeter({ radius = 2000, latitude, longitude } = {}) {
    const params = { radius };
    if (latitude !== undefined && longitude !== undefined) {
      params.latitude = latitude;
      params.longitude = longitude;
    }
    const response = await apiClient.get('/location/nearby', { params });
    return response.data?.data || response.data;
  },

  /**
   * Fetch approximate locality and neighborhood area name.
   */
  async getNeighborhoodInfo({ latitude, longitude } = {}) {
    const params = {};
    if (latitude !== undefined && longitude !== undefined) {
      params.latitude = latitude;
      params.longitude = longitude;
    }
    const response = await apiClient.get('/location/neighborhood', { params });
    return response.data?.data || response.data;
  },
};

export default locationService;
