import axios from 'axios';
import { Platform } from 'react-native';
import { secureStorage } from './secureStore';

// Default API URL: localhost for iOS/web, 10.0.2.2 for Android emulator
const getDefaultBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }
  return 'http://localhost:5000/api';
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Automatically attach JWT
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await secureStorage.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[ApiClient] Failed to attach auth token:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Extract clean error message
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred. Please try again.';
    let data = null;

    if (error.response) {
      // Backend returned an error response
      message = error.response.data?.message || error.response.data?.error || message;
      data = error.response.data?.data || error.response.data?.details || null;
    } else if (error.request) {
      // Network error or server not reachable
      message = 'Unable to connect to safety network server. Please check your connection.';
    }

    const enhancedError = new Error(message);
    enhancedError.statusCode = error.response?.status;
    enhancedError.data = data;
    enhancedError.originalError = error;

    return Promise.reject(enhancedError);
  }
);

export default apiClient;
