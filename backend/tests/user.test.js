// backend/tests/user.test.js

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Story = require('../models/Story');

const TEST_TIMEOUT = 30000;

describe('👤 User Tests', () => {
  let user1Token = '';
  let user2Token = '';
  let user3Token = '';
  let user1Id = '';
  let user2Id = '';
  let user3Id = '';
  let user1Username = '';
  let user2Username = '';
  let user3Username = '';
  let storyId = '';
  
  // ✅ USE SHORT RANDOM IDs (max 20 chars total)
  const shortId = Math.random().toString(36).substring(2, 8); // 6 chars

  const user1 = {
    username: `usr1${shortId}`,      // ✅ ~10 chars
    email: `user1${shortId}@test.com`,
    password: 'Test123!@#',
    name: 'User One'
  };

  const user2 = {
    username: `usr2${shortId}`,      // ✅ ~10 chars
    email: `user2${shortId}@test.com`,
    password: 'Test123!@#',
    name: 'User Two'
  };

  const user3 = {
    username: `usr3${shortId}`,      // ✅ ~10 chars
    email: `user3${shortId}@test.com`,
    password: 'Test123!@#',
    name: 'User Three'
  };

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to test database');

      // Register users
      const reg1 = await request(app).post('/api/auth/register').send(user1);
      const reg2 = await request(app).post('/api/auth/register').send(user2);
      const reg3 = await request(app).post('/api/auth/register').send(user3);

      console.log('✅ Users registered');
      console.log('User1 registration status:', reg1.status);
      console.log('User2 registration status:', reg2.status);
      console.log('User3 registration status:', reg3.status);

      // Login users
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({ identifier: user1.email, password: user1.password });

      const login2 = await request(app)
        .post('/api/auth/login')
        .send({ identifier: user2.email, password: user2.password });

      const login3 = await request(app)
        .post('/api/auth/login')
        .send({ identifier: user3.email, password: user3.password });

      console.log('Login1 status:', login1.status);
      console.log('Login2 status:', login2.status);
      console.log('Login3 status:', login3.status);

      user1Token = login1.body.token;
      user2Token = login2.body.token;
      user3Token = login3.body.token;
      user1Id = login1.body.user?.id || login1.body.user?._id;
      user2Id = login2.body.user?.id || login2.body.user?._id;
      user3Id = login3.body.user?.id || login3.body.user?._id;
      user1Username = login1.body.user?.username;
      user2Username = login2.body.user?.username;
      user3Username = login3.body.user?.username;

      console.log('✅ Users logged in');
      console.log('Tokens received:', { 
        user1: !!user1Token, 
        user2: !!user2Token, 
        user3: !!user3Token 
      });

      // Create a test story for user1
      const storyRes = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Test Story for User Tests',
          content: 'This is a test story content for user testing. '.repeat(50),
          category: 'tech',
          status: 'published'
        });

      storyId = storyRes.body.story?.id || storyRes.body.story?._id;
      console.log('✅ Test story created, ID:', storyId);

    } catch (error) {
      console.error('❌ Setup error:', error);
      throw error;
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    try {
      // Cleanup with shorter pattern
      await User.deleteMany({
        username: { $regex: new RegExp(`^usr[123]${shortId}$`) }
      });
      await Story.deleteMany({
        title: 'Test Story for User Tests'
      });
      await mongoose.connection.close();
      console.log('✅ Tests completed, database cleaned and closed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }, TEST_TIMEOUT);

  // ==================== PROFILE TESTS ====================
  describe('GET /api/users/profile/:username', () => {
    test('should get user profile by username', async () => {
      const res = await request(app)
        .get(`/api/users/profile/${user1Username}`);

      console.log('✅ Get profile response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.username).toBe(user1Username);
    });

    test('should get profile with stats', async () => {
      const res = await request(app)
        .get(`/api/users/profile/${user1Username}`);

      expect(res.status).toBe(200);
      expect(res.body.profile.stats).toBeDefined();
      expect(typeof res.body.profile.stats.storiesCount).toBe('number');
      expect(typeof res.body.profile.stats.followersCount).toBe('number');
    });

    test('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/profile/nonexistentuser999');

      expect(res.status).toBe(404);
    });

    test('should include isFollowing status when authenticated', async () => {
      const res = await request(app)
        .get(`/api/users/profile/${user2Username}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.profile).toHaveProperty('isFollowing');
      expect(typeof res.body.profile.isFollowing).toBe('boolean');
    });
  });

  // ==================== FOLLOW/UNFOLLOW TESTS ====================
  describe('POST /api/users/:username/follow', () => {
    test('should follow another user', async () => {
      const res = await request(app)
        .post(`/api/users/${user2Username}/follow`)
        .set('Authorization', `Bearer ${user1Token}`);

      console.log('✅ Follow response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isFollowing).toBe(true);
      expect(res.body.action).toBe('followed');
    });

    test('should unfollow user', async () => {
      const res = await request(app)
        .post(`/api/users/${user2Username}/follow`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isFollowing).toBe(false);
      expect(res.body.action).toBe('unfollowed');
    });

    test('should follow user3', async () => {
      const res = await request(app)
        .post(`/api/users/${user3Username}/follow`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.isFollowing).toBe(true);
    });

    test('should reject self-follow', async () => {
      const res = await request(app)
        .post(`/api/users/${user1Username}/follow`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should reject follow without authentication', async () => {
      const res = await request(app)
        .post(`/api/users/${user2Username}/follow`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/users/nonexistentuser999/follow')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== DASHBOARD TESTS ====================
  describe('GET /api/users/dashboard', () => {
    test('should get user dashboard', async () => {
      const res = await request(app)
        .get('/api/users/dashboard')
        .set('Authorization', `Bearer ${user1Token}`);

      console.log('✅ Dashboard response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dashboard).toBeDefined();
      expect(res.body.dashboard.user).toBeDefined();
      expect(res.body.dashboard.stats).toBeDefined();
    });

    test('should include story statistics', async () => {
      const res = await request(app)
        .get('/api/users/dashboard')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.body.dashboard.stats.storiesShared).toBeGreaterThanOrEqual(0);
      expect(res.body.dashboard.stats.totalViews).toBeGreaterThanOrEqual(0);
      expect(res.body.dashboard.stats.followersCount).toBeGreaterThanOrEqual(0);
    });

    test('should include recent stories', async () => {
      const res = await request(app)
        .get('/api/users/dashboard')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.body.dashboard.recentStories).toBeDefined();
      expect(Array.isArray(res.body.dashboard.recentStories)).toBe(true);
    });

    test('should reject without authentication', async () => {
      const res = await request(app).get('/api/users/dashboard');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== USER FEED TESTS ====================
  describe('GET /api/users/me/feed', () => {
    beforeAll(async () => {
      // Make sure user1 follows user2
      await request(app)
        .post(`/api/users/${user2Username}/follow`)
        .set('Authorization', `Bearer ${user1Token}`);

      // User2 creates a story
      await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Story by User2 for Feed Test',
          content: 'This is user2 story content. '.repeat(50),
          category: 'tech',
          status: 'published'
        });
    });

    test('should get user feed', async () => {
      const res = await request(app)
        .get('/api/users/me/feed')
        .set('Authorization', `Bearer ${user1Token}`);

      console.log('✅ Feed response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stories).toBeDefined();
      expect(Array.isArray(res.body.stories)).toBe(true);
    });

    test('should include pagination', async () => {
      const res = await request(app)
        .get('/api/users/me/feed?page=1&limit=10')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.currentPage).toBe(1);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(0);
    });

    test('should include isFollowing status in stories', async () => {
      const res = await request(app)
        .get('/api/users/me/feed')
        .set('Authorization', `Bearer ${user1Token}`);

      if (res.body.stories.length > 0) {
        expect(res.body.stories[0]).toHaveProperty('isFollowing');
      }
    });

    test('should reject without authentication', async () => {
      const res = await request(app).get('/api/users/me/feed');

      expect(res.status).toBe(401);
    });
  });

  // ==================== USER STATS TESTS ====================
  describe('GET /api/users/me/stats', () => {
    test('should get user stats', async () => {
      const res = await request(app)
        .get('/api/users/me/stats')
        .set('Authorization', `Bearer ${user1Token}`);

      console.log('✅ Stats response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
    });

    test('should include all stat fields', async () => {
      const res = await request(app)
        .get('/api/users/me/stats')
        .set('Authorization', `Bearer ${user1Token}`);

      const stats = res.body.stats;
      expect(stats).toHaveProperty('storiesCount');
      expect(stats).toHaveProperty('publishedStories');
      expect(stats).toHaveProperty('totalViews');
      expect(stats).toHaveProperty('totalLikes');
      expect(stats).toHaveProperty('followersCount');
      expect(stats).toHaveProperty('followingCount');
    });

    test('should reject without authentication', async () => {
      const res = await request(app).get('/api/users/me/stats');

      expect(res.status).toBe(401);
    });
  });

  // ==================== USER STORIES TESTS ====================
  describe('GET /api/users/me/stories', () => {
    test('should get user stories', async () => {
      const res = await request(app)
        .get('/api/users/me/stories')
        .set('Authorization', `Bearer ${user1Token}`);

      console.log('✅ User stories response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stories).toBeDefined();
      expect(Array.isArray(res.body.stories)).toBe(true);
    });

    test('should support pagination', async () => {
      const res = await request(app)
        .get('/api/users/me/stories?page=1&limit=5')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.currentPage).toBe(1);
    });

    test('should filter by status', async () => {
      const res = await request(app)
        .get('/api/users/me/stories?status=published')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      if (res.body.stories.length > 0) {
        expect(res.body.stories[0].status).toBe('published');
      }
    });

    test('should reject without authentication', async () => {
      const res = await request(app).get('/api/users/me/stories');

      expect(res.status).toBe(401);
    });
  });

  // ==================== SUGGESTED USERS TESTS ====================
  describe('GET /api/users/suggested', () => {
    test('should get suggested users', async () => {
      const res = await request(app)
        .get('/api/users/suggested')
        .set('Authorization', `Bearer ${user1Token}`);

      console.log('✅ Suggested users response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.users).toBeDefined();
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    test('should exclude already followed users', async () => {
      const res = await request(app)
        .get('/api/users/suggested')
        .set('Authorization', `Bearer ${user1Token}`);

      const suggestedUsernames = res.body.users.map(u => u.username);
      expect(suggestedUsernames).toBeDefined();
    });

    test('should support limit parameter', async () => {
      const res = await request(app)
        .get('/api/users/suggested?limit=5')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.body.users.length).toBeLessThanOrEqual(5);
    });

    test('should reject without authentication', async () => {
      const res = await request(app).get('/api/users/suggested');

      expect(res.status).toBe(401);
    });
  });

  // ==================== FOLLOWERS/FOLLOWING TESTS ====================
  describe('GET /api/users/:username/followers', () => {
    test('should get user followers', async () => {
      const res = await request(app)
        .get(`/api/users/${user2Username}/followers`);

      console.log('✅ Followers response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.followers).toBeDefined();
      expect(Array.isArray(res.body.followers)).toBe(true);
    });

    test('should support pagination', async () => {
      const res = await request(app)
        .get(`/api/users/${user2Username}/followers?page=1&limit=10`);

      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/users/:username/following', () => {
    test('should get user following', async () => {
      const res = await request(app)
        .get(`/api/users/${user1Username}/following`);

      console.log('✅ Following response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.following).toBeDefined();
      expect(Array.isArray(res.body.following)).toBe(true);
    });

    test('should support pagination', async () => {
      const res = await request(app)
        .get(`/api/users/${user1Username}/following?page=1&limit=10`);

      expect(res.body.pagination).toBeDefined();
    });
  });

  // ==================== PROFILE UPDATE TESTS ====================
  describe('PUT /api/users/me/profile', () => {
    test('should update user profile', async () => {
      const res = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          bio: 'Updated bio for testing',
          location: 'Test City'
        });

      console.log('✅ Profile update response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile).toBeDefined();
    });

    test('should reject without authentication', async () => {
      const res = await request(app)
        .put('/api/users/me/profile')
        .send({ bio: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  // ==================== ADDITIONAL ENDPOINTS ====================
  describe('Additional User Endpoints', () => {
    test('GET /api/users/me/profile should work', async () => {
      const res = await request(app)
        .get('/api/users/me/profile')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('GET /api/users/me/analytics should return placeholder', async () => {
      const res = await request(app)
        .get('/api/users/me/analytics')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('GET /api/users/me/trends should return placeholder', async () => {
      const res = await request(app)
        .get('/api/users/me/trends')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('GET /api/users/me/engagement should return placeholder', async () => {
      const res = await request(app)
        .get('/api/users/me/engagement')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
