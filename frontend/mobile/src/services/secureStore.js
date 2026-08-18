import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'rosp_auth_jwt_token';
const USER_KEY = 'rosp_auth_user_data';

// In-memory fallback for environments where SecureStore isn't available (e.g. web/test)
const memoryStorage = new Map();

export const secureStorage = {
  async setItem(key, value) {
    try {
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(key, value);
        } catch {}
        memoryStorage.set(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    } catch (err) {
      console.warn(`[SecureStore] Fallback to memory for setItem (${key}):`, err.message);
      memoryStorage.set(key, value);
    }
  },

  async getItem(key) {
    try {
      if (Platform.OS === 'web') {
        return (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null) || memoryStorage.get(key) || null;
      }
      const val = await SecureStore.getItemAsync(key);
      return val || memoryStorage.get(key) || null;
    } catch (err) {
      console.warn(`[SecureStore] Fallback to memory for getItem (${key}):`, err.message);
      return memoryStorage.get(key) || null;
    }
  },

  async removeItem(key) {
    try {
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem(key);
        } catch {}
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (err) {
      console.warn(`[SecureStore] Fallback to memory for removeItem (${key}):`, err.message);
    } finally {
      memoryStorage.delete(key);
    }
  },

  // Token Specific Helpers
  async saveAuthToken(token) {
    return this.setItem(TOKEN_KEY, token);
  },

  async getAuthToken() {
    return this.getItem(TOKEN_KEY);
  },

  async removeAuthToken() {
    return this.removeItem(TOKEN_KEY);
  },

  // User Profile Helpers
  async saveUser(user) {
    return this.setItem(USER_KEY, JSON.stringify(user));
  },

  async getUser() {
    const raw = await this.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async removeUser() {
    return this.removeItem(USER_KEY);
  },

  async clearAll() {
    await this.removeAuthToken();
    await this.removeUser();
  },
};
