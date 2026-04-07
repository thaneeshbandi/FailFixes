import axios from 'axios';

// ✅ Base URL: includes /api and has NO trailing slash
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  getAllStories: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString();
    return api.get(`/stories${queryString ? `?${queryString}` : ''}`);
  },

  // Alias for getAllStories
  getStories: (params = {}) => storiesAPI.getAllStories(params),

  // Get stories by specific author
  getStoriesByAuthor: async (authorUsername, params = {}) => {
    try {
      console.log('📡 Fetching stories for author:', authorUsername);
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });
      const queryString = queryParams.toString();
      const response = await api.get(
        `/stories/author/${authorUsername}${queryString ? `?${queryString}` : ''}`
      );
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
  getComments: (id, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString();
    return api.get(`/stories/${id}/comments${queryString ? `?${queryString}` : ''}`);
  },

  // Delete comment
  deleteComment: (storyId, commentId) => {
    console.log('🗑️ Deleting comment:', commentId);
    return api.delete(`/stories/${storyId}/comments/${commentId}`);
  },

  // Update comment
  updateComment: (storyId, commentId, commentData) => {
    console.log('✏️ Updating comment:', commentId);
    return api.put(`/stories/${storyId}/comments/${commentId}`, commentData);
  },
};

// ========== AUTH API ==========
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  updateProfile: (userData) => api.put('/auth/profile', userData),
  changePassword: (passwordData) => api.put('/auth/change-password', passwordData),
  logout: () => api.post('/auth/logout'),
};

// ========== DASHBOARD API ==========
export const dashboardAPI = {
  testConnection: () => api.get('/health'),
  testUserRoutes: () => api.get('/users/test'),
  debugUserStories: () => api.get('/users/debug/stories'),

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

  getUserStories: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString();
    return api.get(`/users/me/stories${queryString ? `?${queryString}` : ''}`);
  },

  getUserAnalytics: () => api.get('/users/me/analytics'),
  getLikedStories: () => api.get('/users/me/liked-stories'),
  getUserActivity: () => api.get('/users/me/activity'),
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

  // Unfollow user
  unfollowUser: async (username) => {
    try {
      console.log('📡 Unfollowing user via API:', username);
      const response = await api.delete(`/users/${username}/follow`);
      console.log('✅ Unfollow API response:', response.data);
      return response;
    } catch (error) {
      console.error('❌ Unfollow API error:', error);
      throw error;
    }
  },

  // Get user followers
  getUserFollowers: (username, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString();
    return api.get(`/users/${username}/followers${queryString ? `?${queryString}` : ''}`);
  },

  // Get user following
  getUserFollowing: (username, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString();
    return api.get(`/users/${username}/following${queryString ? `?${queryString}` : ''}`);
  },

  // Get personalized feed
  getUserFeed: async (params = {}) => {
    try {
      console.log('📡 Fetching user feed via API with params:', params);
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });
      const queryString = queryParams.toString();
      const response = await api.get(`/users/me/feed${queryString ? `?${queryString}` : ''}`);
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

  // Search users
  searchUsers: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString();
    return api.get(`/users/search${queryString ? `?${queryString}` : ''}`);
  },

  // Update user profile
  updateProfile: (profileData) => api.put('/users/me/profile', profileData),
};

// ========== USERS API ALIASES ==========
export const usersAPI = {
  followUser: userAPI.followUser,
  unfollowUser: userAPI.unfollowUser,
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
export const chatAPI = {
  getChats: () => api.get('/chats'),

  createDirectChat: (userId) => api.post('/chats/direct', { userId }),

  getChatMessages: (chatId, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString();
    return api.get(`/chats/${chatId}/messages${queryString ? `?${queryString}` : ''}`);
  },

  sendMessage: (chatId, messageData) => api.post(`/chats/${chatId}/messages`, messageData),

  markChatAsRead: (chatId) => api.put(`/chats/${chatId}/read`),

  deleteChat: (chatId) => api.delete(`/chats/${chatId}`),
};

// ========== ANALYTICS API ==========
export const analyticsAPI = {
  getStoryPerformance: (id) => api.get(`/stories/${id}/analytics`),

  getViewTrends: (period = '30d') => api.get(`/users/me/trends?period=${period}`),

  getEngagementMetrics: () => api.get('/users/me/engagement'),

  getStoryAnalytics: (id) => api.get(`/stories/${id}/analytics`),

  getUserAnalytics: () => api.get('/users/me/analytics'),
};

export default api;
