import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { secureStorage } from './secureStore';

/**
 * Dynamically resolve the backend base URL:
 * 1. Environment variable if set (EXPO_PUBLIC_API_URL)
 * 2. If running on physical device via Expo Go, dynamically use the host IP (e.g. 10.24.90.252)
 * 3. Fallback to localhost for Web / iOS Simulator or 10.0.2.2 for Android Emulator
 */
const getDefaultBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Extract host IP when running via Metro / Expo Go (e.g. '10.24.90.252:8081' -> '10.24.90.252')
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:5000/api`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  return 'http://localhost:5000/api';
};

export const API_BASE_URL = getDefaultBaseUrl();

console.log('[ApiClient] Initialized with API Base URL:', API_BASE_URL);

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
      message = error.response.data?.message || error.response.data?.error || message;
      data = error.response.data?.data || error.response.data?.details || null;
    } else if (error.request) {
      message = 'Unable to connect to safety network server. Please check your network connection.';
    }

    const enhancedError = new Error(message);
    enhancedError.statusCode = error.response?.status;
    enhancedError.data = data;
    enhancedError.originalError = error;

    return Promise.reject(enhancedError);
  }
);

export default apiClient;
