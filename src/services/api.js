import axios from 'axios';
import storage from '@/services/storage';
import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach host machine's localhost
const LOCAL_HOST = Platform.select({
  android: '10.0.2.2',
  default: 'localhost',
});

// Switch between local dev and production backend
// Set EXPO_PUBLIC_USE_LOCAL=true in your .env to use localhost
const USE_LOCAL = process.env.EXPO_PUBLIC_USE_LOCAL === 'true';
const PROD_HOST = 'https://palz-backend.onrender.com';

const API_BASE = USE_LOCAL
  ? `http://${LOCAL_HOST}:3000/api`
  : `${PROD_HOST}/api`;

// Security key for backend DB access — set via env or hardcode for dev
const API_SECRET_KEY = process.env.EXPO_PUBLIC_API_KEY || 'palz-dev-key-change-in-production';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_SECRET_KEY,
  },
});

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await storage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.removeItem('auth_token');
      await storage.removeItem('auth_user');
    }
    return Promise.reject(error);
  }
);

// ── Auth ──
export const authApi = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  googleAuth: (idToken) => api.post('/auth/google', { idToken }),
};

// ── Users ──
export const usersApi = {
  discover: () => api.get('/users/discover'),
  getProfile: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
};

// ── Upload ──
// Helper to get the base URL for direct uploads
export const getUploadBaseUrl = () => API_BASE;

export const uploadApi = {
  /**
   * Upload a profile image.
   * @param {object} params - { uri: string, fileName?: string, mimeType?: string }
   * Returns { url: string, filename: string }
   */
  uploadImage: async ({ uri, fileName, mimeType }) => {
    const token = await storage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName || 'photo.jpg',
      type: mimeType || 'image/jpeg',
    });

    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': API_SECRET_KEY,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }

    return res.json();
  },

  /**
   * Upload an audio fun fact.
   * @param {object} params - { uri: string, fileName?: string, mimeType?: string }
   * Returns { url: string, filename: string }
   */
  uploadAudio: async ({ uri, fileName, mimeType }) => {
    const token = await storage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName || 'voice.m4a',
      type: mimeType || 'audio/m4a',
    });

    const res = await fetch(`${API_BASE}/upload/audio`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': API_SECRET_KEY,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }

    return res.json();
  },
};

// ── Swipes ──
export const swipesApi = {
  swipe: (targetId, direction) =>
    api.post('/swipes', {
      target_id: targetId,
      direction,
    }),
  getMatches: () => api.get('/swipes/matches'),
  getLikes: () => api.get('/swipes/likes'),
  blockUser: (id) => api.post(`/swipes/block/${id}`),
};

// ── Messages ──
export const messagesApi = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (conversationId) => api.get(`/messages/${conversationId}`),
  sendMessage: (data) => api.post('/messages/send', data),
};

export default api;
