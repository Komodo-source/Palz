import axios from 'axios';
import storage from '@/services/storage';
import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach host machine's localhost
const LOCAL_HOST = Platform.select({
  android: '10.0.2.2',
  default: 'localhost',
});

const USE_LOCAL = process.env.EXPO_PUBLIC_USE_LOCAL === 'true';
const PROD_HOST = 'https://palz-backend.onrender.com';

const API_BASE = USE_LOCAL
  ? `http://${LOCAL_HOST}:3000/api`
  : `${PROD_HOST}/api`;

// Security key for backend DB access — set via env or hardcode for dev
const API_SECRET_KEY = process.env.EXPO_PUBLIC_API_KEY || 'palz-dev-key-change-in-production';

// Debug mode: set to true to see detailed backend error messages
const DEBUG_MODE = process.env.EXPO_PUBLIC_DEBUG === 'true';

// Callback for when the API returns 401 (token expired/invalid)
let onUnauthorized = null;
export const setOnUnauthorized = (fn) => { onUnauthorized = fn; };

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_SECRET_KEY,
    ...(DEBUG_MODE ? { 'x-debug': 'true' } : {}),
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

// Handle error responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        await storage.removeItem('auth_token');
        await storage.removeItem('auth_user');
        if (onUnauthorized) onUnauthorized();
      }
      // Attach a readable message for catch blocks to display
      error.displayMessage = error.response.data?.error || `Erreur ${status}`;
    } else {
      error.displayMessage = 'Erreur réseau — vérifie ta connexion.';
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
  getNumberPhoto: () => api.get('/users/nb_photo'),
  getNumberRelation: () => api.get('/users/nb_relation'),
  getProfile: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
};

// ── Upload ──
// Supabase storage public URL base
const SUPABASE_BASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kcglwtoegceicruwmxzo.supabase.co';
const SUPABASE_STORAGE_URL = `${SUPABASE_BASE_URL}/storage/v1/object/public`;

/**
 * Get the full public URL for a stored file.
 * Handles both legacy /uploads/ paths and Supabase storage paths.
 * Determines the bucket from the filename prefix (img_ → images, audio_ → audio).
 */
export const getStorageUrl = (storedValue) => {
  if (!storedValue) return '';
  // Already a full URL (e.g. Supabase public URL)
  if (storedValue.startsWith('http')) return storedValue;

  // Map filename prefixes to actual Supabase bucket names
  const bucket = storedValue.startsWith('audio_') ? 'audio_users' : 'user_photos';
  return `${SUPABASE_STORAGE_URL}/${bucket}/${storedValue}`;
};

export const uploadApi = {
  /**
   * Upload a profile image.
   * @param {object} params - { uri: string, fileName?: string, mimeType?: string }
   * Returns { url: string, filename: string }
   */
  uploadImage: async ({ uri, fileName, mimeType, token: providedToken }) => {
    const token = providedToken || await storage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName || 'photo.jpg',
      type: mimeType || 'image/jpeg',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(`${API_BASE}/upload/image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-api-key': API_SECRET_KEY,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errBody.error || 'Upload failed');
      }
      return res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Délai dépassé — réessaie.');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * Upload an audio fun fact.
   * @param {object} params - { uri: string, fileName?: string, mimeType?: string }
   * Returns { url: string, filename: string }
   */
  uploadAudio: async ({ uri, fileName, mimeType, token: providedToken }) => {
    const token = providedToken || await storage.getItem('auth_token');
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName || 'voice.m4a',
      type: mimeType || 'audio/m4a',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(`${API_BASE}/upload/audio`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-api-key': API_SECRET_KEY,
        },
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
      }
      return res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Délai dépassé — réessaie.');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
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
  updateStreak: (conversationId) => api.post(`/messages/update_streak`, conversationId),
  sendMessage: (data) => api.post('/messages/send', data),
  genrateIceBreaker: (data) => api.post('/messages/generate_personnal_iceBreaker', data),
  startConversation: (otherUserId) => api.post('/messages/start', { other_user_id: otherUserId }),
};

// ── Wall ──
export const wallApi = {
  getTheme: () => api.get('/wall/theme'),
  getPosts: () => api.get('/wall/posts'),
  createPost: (wallPhoto) => api.post('/wall/post', { wall_photo: wallPhoto }),
  deletePost: (postId) => api.delete(`/wall/post/${postId}`),
  reactToPost: (postId) => api.post(`/wall/post/${postId}/react`),
  getUserPosts: (userId) => api.get(`/wall/user/${userId}/posts`),
};

// ── Groups ──
export const groupsApi = {
  getCurrent: () => api.get('/groups/current'),
  generate: () => api.post('/groups/generate'),
  leave: () => api.post('/groups/leave'),
  vote: (weeklyGroupId, vote) => api.post('/groups/vote', { weekly_group_id: weeklyGroupId, vote }),
  getMessages: (weeklyGroupId) => api.get(`/groups/${weeklyGroupId}/messages`),
  sendMessage: (data) => api.post('/groups/message/send', data),
  setRendezvous: (weeklyGroupId, location, time) =>
    api.put('/groups/rendezvous', { weekly_group_id: weeklyGroupId, location, time }),
  submitMemberVotes: (weeklyGroupId, votes) =>
    api.post('/groups/member-vote', { weekly_group_id: weeklyGroupId, votes }),
  getMemberVotes: (weeklyGroupId) => api.get(`/groups/${weeklyGroupId}/member-votes`),
  submitDissolutionFeedback: (weeklyGroupId, groupRating, memberRatings) =>
    api.post('/groups/dissolution-feedback', {
      weekly_group_id: weeklyGroupId,
      group_rating: groupRating,
      member_ratings: memberRatings,
    }),
  voteActivity: (weeklyGroupId, suggestionIndex) =>
    api.post(`/groups/${weeklyGroupId}/activity-vote`, { suggestion_index: suggestionIndex }),
};

// ── Events ──
export const eventsApi = {
  getEvents: (filter, category) => api.get('/events', {
    params: {
      ...(filter ? { filter } : {}),
      ...(category ? { category } : {}),
    },
  }),
  createEvent: (data) => api.post('/events', data),
  getEvent: (id) => api.get(`/events/${id}`),
  joinEvent: (id) => api.post(`/events/${id}/join`),
  leaveEvent: (id) => api.post(`/events/${id}/leave`),
  rsvpEvent: (id, status) => api.patch(`/events/${id}/rsvp`, { status }),
  getMessages: (id) => api.get(`/events/${id}/messages`),
  sendMessage: (id, data) =>
    api.post(`/events/${id}/messages`, typeof data === 'string' ? { content: data } : data),
  getSuggested: () => api.get('/events/suggested'),
};

// ── Constant Data (zodiac, sports, hobbies) ──
export const constantDataApi = {
  getZodiacSigns: () => api.get('/constant_data/get_zodiac_sign'),
  getSports: () => api.get('/constant_data/get_sports'),
  getHobbies: () => api.get('/constant_data/get_hobbies'),
  getTypeSearch: () => api.get('/constant_data/get_type_search'),
};

// ── Payments ──
export const paymentsApi = {
  createPaymentSheet: () => api.post('/payments/create-payment-sheet'),
  confirm: (paymentIntentId) => api.post('/payments/confirm', { payment_intent_id: paymentIntentId }),
  getStatus: () => api.get('/payments/status'),
  cancel: () => api.post('/payments/cancel'),
};

export default api;
