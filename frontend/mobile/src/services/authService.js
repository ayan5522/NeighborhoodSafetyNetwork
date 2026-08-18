import apiClient from './apiClient';
import { secureStorage } from './secureStore';

export const authService = {
  /**
   * Register a new resident
   */
  async register({ fullName, email, mobileNumber, password, confirmPassword }) {
    const response = await apiClient.post('/auth/register', {
      full_name: fullName,
      email,
      mobile_number: mobileNumber,
      password,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  /**
   * Verify email OTP
   */
  async verifyEmail({ email, otp }) {
    const response = await apiClient.post('/auth/verify-email', {
      email,
      otp,
    });
    return response.data;
  },

  /**
   * Verify mobile OTP
   */
  async verifyMobile({ mobileNumber, otp }) {
    const response = await apiClient.post('/auth/verify-mobile', {
      mobile_number: mobileNumber,
      otp,
    });
    return response.data;
  },

  /**
   * Login user and securely store token
   */
  async login({ email, password }) {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    const { token, user } = response.data.data;
    if (token) {
      await secureStorage.saveAuthToken(token);
    }
    if (user) {
      await secureStorage.saveUser(user);
    }

    return response.data;
  },

  /**
   * Logout user and clear tokens
   */
  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.warn('[authService] Server logout notification failed:', err.message);
    } finally {
      await secureStorage.clearAll();
    }
  },

  /**
   * Forgot password OTP request
   */
  async forgotPassword({ channel, identifier }) {
    const response = await apiClient.post('/auth/forgot-password', {
      channel,
      identifier,
    });
    return response.data;
  },

  /**
   * Verify Reset OTP
   */
  async verifyResetOtp({ channel, identifier, otp }) {
    const response = await apiClient.post('/auth/verify-reset-otp', {
      channel,
      identifier,
      otp,
    });
    return response.data;
  },

  /**
   * Reset Password
   */
  async resetPassword({ channel, identifier, otp, newPassword, confirmPassword }) {
    const response = await apiClient.post('/auth/reset-password', {
      channel,
      identifier,
      otp,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  },

  /**
   * Resend OTP
   */
  async resendOtp({ purpose, channel, identifier }) {
    const response = await apiClient.post('/auth/resend-otp', {
      purpose,
      channel,
      identifier,
    });
    return response.data;
  },

  /**
   * Get current authenticated user profile
   */
  async getProfile() {
    const response = await apiClient.get('/users/me');
    const user = response.data.data?.user || response.data.data;
    if (user) {
      await secureStorage.saveUser(user);
    }
    return user;
  },

  /**
   * Update profile full name
   */
  async updateProfile({ fullName }) {
    const response = await apiClient.patch('/users/me', {
      full_name: fullName,
    });
    const user = response.data.data?.user || response.data.data;
    if (user) {
      await secureStorage.saveUser(user);
    }
    return user;
  },

  /**
   * Token and Local User Helpers
   */
  async getStoredToken() {
    return secureStorage.getAuthToken();
  },

  async getStoredUser() {
    return secureStorage.getUser();
  },

  async isAuthenticated() {
    const token = await secureStorage.getAuthToken();
    return !!token;
  },
};

export default authService;
