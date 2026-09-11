import axios from 'axios';

// ✅ Base URL: includes /api and has NO trailing slash
const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:10000/api';

console.log('🔗 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// ✅ REQUEST INTERCEPTOR
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ff_token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Debug logging
    console.log(`📤 ${config.method.toUpperCase()} ${config.url}`, {
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      hasAuth: !!token
    });
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ✅ RESPONSE INTERCEPTOR
api.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.config.method.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`, {
      message: error.message,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.log('🔐 Authentication failed - redirecting to login');
      localStorage.removeItem('ff_token');
      localStorage.removeItem('ff_user');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Serialise params into a query string, dropping empty values.
 * This exact loop was copy-pasted into eight functions below; one definition
 * means one place for a caller to get it wrong.
 */
const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.append(key, value);
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

// ✅ VIEW TRACKING CACHE (prevents duplicate increments)
const viewCache = new Map();
const VIEW_CACHE_DURATION = 5000; // 5 seconds

const shouldTrackView = (key) => {
  const now = Date.now();
  const lastTracked = viewCache.get(key);
  
  if (lastTracked && now - lastTracked < VIEW_CACHE_DURATION) {
    console.log('⏭️  Skipping duplicate view tracking:', key);
    return false;
  }
  
  viewCache.set(key, now);
  return true;
};

// ========== STORIES API ==========
export const storiesAPI = {
  // Get all stories with filters
  getAllStories: (params = {}) => api.get(`/stories${buildQuery(params)}`),

  // Alias for getAllStories
  getStories: (params = {}) => storiesAPI.getAllStories(params),

  // Get stories by specific author
  getStoriesByAuthor: async (authorUsername, params = {}) => {
    try {
      console.log('📡 Fetching stories for author:', authorUsername);
      const response = await api.get(`/stories/author/${authorUsername}${buildQuery(params)}`);
      console.log('✅ Stories API response:', response.data);
      return response;
    } catch (error) {
      console.error('❌ Stories fetch error:', error);
      throw error;
    }
  },

  // Get single story by ID
  getStoryById: (id) => {
    console.log('📖 Fetching story:', id);
    return api.get(`/stories/${id}`);
  },

  // Create new story
  createStory: (storyData) => {
    console.log('✍️ Creating story:', storyData.title);
    return api.post('/stories', storyData);
  },

  // Update existing story
  updateStory: (id, storyData) => {
    console.log('📝 Updating story:', id);
    return api.put(`/stories/${id}`, storyData);
  },

  // Delete story
  deleteStory: (id) => {
    console.log('🗑️ Deleting story:', id);
    return api.delete(`/stories/${id}`);
  },

  // ✅ LIKE STORY - Using PATCH
  likeStory: (id) => {
    console.log('❤️ Liking story:', id);
    return api.patch(`/stories/${id}/like`);
  },

  // Track story view with deduplication
  incrementView: async (storyId) => {
    const cacheKey = `story-view-${storyId}`;
    
    if (!shouldTrackView(cacheKey)) {
      console.log('⏭️  View already tracked recently for story:', storyId);
      return { data: { success: true, cached: true } };
    }

    try {
      console.log('📊 Incrementing view for story:', storyId);
      const response = await api.post(`/stories/${storyId}/view`);
      console.log('✅ View incremented:', response.data);
      return response;
    } catch (error) {
      console.error('❌ View increment error:', error);
      return { data: { success: false, error: error.message } };
    }
  },

  // Backward compatibility alias
  trackStoryView: (storyId) => storiesAPI.incrementView(storyId),

  // Add comment to story
  addComment: (id, commentData) => {
    console.log('💬 Adding comment to story:', id);
    return api.post(`/stories/${id}/comment`, commentData);
  },

  // Get story comments
  getComments: (id, params = {}) => api.get(`/stories/${id}/comments${buildQuery(params)}`),

  // NOTE: no deleteComment / updateComment. Both used to be declared here and
  // called /stories/:id/comments/:commentId, which the backend never
  // implemented — editing and deleting comments is not a feature of this app.
};

// ========== AUTH API ==========
// Every function here maps to a route that exists in backend/routes/auth.js.
// `updateProfile` used to point at PUT /auth/profile, which was never
// implemented — profile updates live under /users/me/profile (see userAPI).
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),

  // Ends every session for the account (the server increments tokenVersion).
  // Stateless tokens carry no per-session id, so single-device logout is not
  // possible without a session store — see docs/ARCHITECTURE.md.
  logout: () => api.post('/auth/logout'),

  // Returns a fresh token: the change revokes all sessions, including this one,
  // so the caller must swap in the new token or it will be signed out.
  changePassword: (passwordData) => api.put('/auth/change-password', passwordData),
};

// ========== DASHBOARD API ==========
export const dashboardAPI = {
  testConnection: () => api.get('/health'),

  getDashboard: async () => {
    try {
      console.log('🔄 Fetching dashboard data from:', `${API_BASE_URL}/users/dashboard`);
      const response = await api.get('/users/dashboard');
      console.log('✅ Dashboard data received:', response.data);
      return response;
    } catch (error) {
      console.error('❌ Dashboard API error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  },

  getUserStats: () => api.get('/users/me/stats'),

  getUserStories: (params = {}) => api.get(`/users/me/stories${buildQuery(params)}`),

  // Was '/users/me/liked-stories', which 404'd; the route is '/users/me/liked'.
  getLikedStories: (params = {}) => api.get(`/users/me/liked${buildQuery(params)}`),

  getUserProfile: () => api.get('/users/me/profile'),
  updateUserProfile: (profileData) => api.put('/users/me/profile', profileData),
};

// ========== USERS API ==========
export const userAPI = {
  // Get user profile
  getUserProfile: async (username) => {
    try {
      console.log('📡 Fetching user profile:', username);
      const response = await api.get(`/users/profile/${username}`);
      console.log('✅ User profile API response:', response.data);
      return response;
    } catch (error) {
      console.error('❌ User profile fetch error:', error);
      throw error;
    }
  },

  // Track profile view with deduplication
  incrementProfileView: async (username) => {
    const cacheKey = `profile-view-${username}`;
    
    if (!shouldTrackView(cacheKey)) {
      console.log('⏭️  Profile view already tracked recently:', username);
      return { data: { success: true, cached: true } };
    }

    try {
      console.log('📊 Incrementing profile view:', username);
      const response = await api.post(`/users/profile/${username}/view`);
      console.log('✅ Profile view incremented:', response.data);
      return response;
    } catch (error) {
      console.error('❌ Profile view increment error:', error);
      return { data: { success: false, error: error.message } };
    }
  },

  // Backward compatibility alias
  trackProfileView: (username) => userAPI.incrementProfileView(username),

  // Follow user
  followUser: async (username) => {
    try {
      console.log('📡 Following user via API:', username);
      const response = await api.post(`/users/${username}/follow`);
      console.log('✅ Follow API response:', response.data);
      return response;
    } catch (error) {
      console.error('❌ Follow API error:', error);
      throw error;
    }
  },

  // NOTE: there is no separate unfollow call. POST /users/:username/follow is a
  // TOGGLE on the server (backend/controllers/userController.js followUser), and
  // the response's `isFollowing` reports the resulting state. A DELETE variant
  // used to be declared here and 404'd on every call.

  // Get user followers
  getUserFollowers: (username, params = {}) =>
    api.get(`/users/${username}/followers${buildQuery(params)}`),

  // Get user following
  getUserFollowing: (username, params = {}) =>
    api.get(`/users/${username}/following${buildQuery(params)}`),

  // Get personalized feed
  getUserFeed: async (params = {}) => {
    try {
      console.log('📡 Fetching user feed via API with params:', params);
      const response = await api.get(`/users/me/feed${buildQuery(params)}`);
      console.log('✅ Feed API response:', {
        success: response.data.success,
        storiesCount: response.data.stories?.length || 0,
        totalStories: response.data.pagination?.totalStories || 0,
        debug: response.data.debug,
      });
      return response;
    } catch (error) {
      console.error('❌ Feed API error:', error);
      throw error;
    }
  },

  // Get suggested users
  getSuggestedUsers: () => api.get('/users/suggested'),

  // Search users.
  //
  // Two bugs lived here: the route was never mounted on the backend (so this
  // always 404'd), and callers passed `{ query: term }` while the controller
  // reads `req.query.q`. Both are fixed — the signature now takes the term
  // itself so a caller cannot get the parameter name wrong.
  searchUsers: (term, params = {}) => api.get(`/users/search${buildQuery({ q: term, ...params })}`),

  // Update user profile
  updateProfile: (profileData) => api.put('/users/me/profile', profileData),
};

// ========== USERS API ALIASES ==========
export const usersAPI = {
  followUser: userAPI.followUser,
  getUserProfile: userAPI.getUserProfile,
  trackProfileView: userAPI.trackProfileView,
  incrementProfileView: userAPI.incrementProfileView,
  getUserFollowers: userAPI.getUserFollowers,
  getUserFollowing: userAPI.getUserFollowing,
  getUserFeed: userAPI.getUserFeed,
  getSuggestedUsers: userAPI.getSuggestedUsers,
  updateProfile: userAPI.updateProfile,
  searchUsers: userAPI.searchUsers,
};

// ========== CHATS API ==========
// Chat READS go over HTTP; chat WRITES go over Socket.IO. There is deliberately
// no sendMessage here — messages are sent with the socket 'sendMessage' event
// (see SocketContexts.js), which persists and fans out in one step.
export const chatAPI = {
  getChats: () => api.get('/chats'),

  createDirectChat: (userId) => api.post('/chats/direct', { userId }),

  getChatMessages: (chatId, params = {}) =>
    api.get(`/chats/${chatId}/messages${buildQuery(params)}`),

  // Writes a read receipt for every message the current user has not yet read.
  // Idempotent, and it deliberately does not bump the chat's updatedAt, so
  // opening a conversation does not reorder the sidebar.
  markChatAsRead: (chatId) => api.put(`/chats/${chatId}/read`),
};

// ========== ANALYTICS ==========
// Removed. Every one of these called an endpoint that either never existed
// (/stories/:id/analytics) or returned a hardcoded empty object with no data
// model behind it (/users/me/trends, /engagement, /analytics). The backend
// placeholders were deleted in the same pass; there is no analytics feature to
// call until one is actually built.

export default api;
