import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Secure Storage Adapter
 * Stores tokens securely using hardware-backed Android Keystore and iOS Keychain.
 * Uses fallback memory/local map in web/headless environments.
 */

// Memory fallback cache
const memoryStore = new Map();

export const secureStorage = {
  /**
   * Securely store a key-value pair.
   */
  async setItem(key, value) {
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(key, String(value), {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        });
      } else {
        memoryStore.set(key, String(value));
        try {
          localStorage.setItem(key, String(value));
        } catch {}
      }
      return true;
    } catch (err) {
      console.warn(`[secureStorage] Failed to save key "${key}":`, err.message);
      memoryStore.set(key, String(value));
      return false;
    }
  },

  /**
   * Retrieve a securely stored value.
   */
  async getItem(key) {
    try {
      if (Platform.OS !== 'web') {
        const val = await SecureStore.getItemAsync(key);
        return val || memoryStore.get(key) || null;
      } else {
        return memoryStore.get(key) || (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);
      }
    } catch (err) {
      console.warn(`[secureStorage] Failed to get key "${key}":`, err.message);
      return memoryStore.get(key) || null;
    }
  },

  /**
   * Securely remove a key-value pair upon logout.
   */
  async removeItem(key) {
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(key);
      }
      memoryStore.delete(key);
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem(key);
        } catch {}
      }
      return true;
    } catch (err) {
      console.warn(`[secureStorage] Failed to remove key "${key}":`, err.message);
      memoryStore.delete(key);
      return false;
    }
  },
};
