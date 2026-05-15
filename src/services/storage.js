import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// In-memory fallback when SecureStore or localStorage is unavailable
const memoryStore = new Map();

const isWeb = Platform.OS === 'web';

/**
 * Cross-platform storage utility.
 * - Native: uses expo-secure-store (encrypted Keychain/Keystore)
 * - Web: uses localStorage
 * - All platforms: in-memory Map as final fallback
 */
const storage = {
  async getItem(key) {
    if (isWeb) {
      try {
        return localStorage.getItem(key);
      } catch {
        // localStorage might throw in private browsing
      }
      return memoryStore.get(key) ?? null;
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn('SecureStore.getItemAsync failed, using memory fallback:', err.message);
    }

    return memoryStore.get(key) ?? null;
  },

  async setItem(key, value) {
    if (isWeb) {
      try {
        localStorage.setItem(key, value);
        return;
      } catch {
        // localStorage might throw in private browsing
      }
      memoryStore.set(key, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (err) {
      console.warn('SecureStore.setItemAsync failed, using memory fallback:', err.message);
    }

    memoryStore.set(key, value);
  },

  async removeItem(key) {
    if (isWeb) {
      try {
        localStorage.removeItem(key);
        return;
      } catch {
        // localStorage might throw in private browsing
      }
      memoryStore.delete(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch (err) {
      console.warn('SecureStore.deleteItemAsync failed, using memory fallback:', err.message);
    }

    memoryStore.delete(key);
  },
};

export default storage;
