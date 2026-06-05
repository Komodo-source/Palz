import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'palz_cache:';

const cache = {
  async get(key) {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const { data, expiresAt } = JSON.parse(raw);
      if (expiresAt && Date.now() > expiresAt) {
        AsyncStorage.removeItem(PREFIX + key).catch(() => {});
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  async set(key, data, ttlMs = 5 * 60 * 1000) {
    try {
      const entry = JSON.stringify({ data, expiresAt: Date.now() + ttlMs });
      await AsyncStorage.setItem(PREFIX + key, entry);
    } catch {
      // non-fatal — cache is best-effort
    }
  },

  async remove(key) {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {}
  },
};

export default cache;
