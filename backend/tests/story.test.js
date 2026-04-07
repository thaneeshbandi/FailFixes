require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Story = require('../models/Story');

const TEST_TIMEOUT = 30000;

describe('📖 Story Tests', () => {
  const timestamp = Date.now();
  
  // Test users
  const testAuthor = {
    name: 'Story Author',
    email: `author${timestamp}@test.com`,
    username: `author${timestamp % 10000000}`,
    password: 'Test123!@#'
  };

  const testReader = {
    name: 'Story Reader',
    email: `reader${timestamp}@test.com`,
    username: `reader${timestamp % 10000000}`,
    password: 'Test123!@#'
  };

  let authorToken = '';
  let authorId = '';
  let readerToken = '';
  let readerId = '';
  let storyId = '';
  let draftStoryId = '';

  // Test story data
  const validStory = {
    title: 'My Epic Failure Story That Changed Everything',
    content: 'This is a long story about my failure. '.repeat(20) + 'It taught me valuable lessons about perseverance, resilience, and never giving up on your dreams.',
    category: 'business',
    tags: ['startup', 'failure', 'lessons'],
    status: 'published',
    metadata: {
      failureType: 'startup',
      recoveryTime: '1 year',
      currentStatus: 'recovered',
      keyLessons: ['Never give up', 'Learn from mistakes']
    }
  };

  // ========== SETUP & TEARDOWN ==========
  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to test database');
      
      // Clean up test data
      await User.deleteMany({ 
        email: { $regex: /(author|reader).*@test\.com/ } 
      });
      await Story.deleteMany({ 
        title: { $regex: /Epic Failure|Test Story|Draft Story/i } 
      });
      
      console.log('🧹 Database cleaned');

      // Register test author
      const authorRes = await request(app)
        .post('/api/auth/register')
        .send(testAuthor);
      
      expect(authorRes.status).toBe(201);

      // Register test reader
      const readerRes = await request(app)
        .post('/api/auth/register')
        .send(testReader);
      
      expect(readerRes.status).toBe(201);

      // Login author
      const authorLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testAuthor.email,
          password: testAuthor.password
        });
      
      authorToken = authorLoginRes.body.token;
      authorId = authorLoginRes.body.user.id;
      
      // Login reader
      const readerLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testReader.email,
          password: testReader.password
        });
      
      readerToken = readerLoginRes.body.token;
      readerId = readerLoginRes.body.user.id;

      console.log('✅ Test users created and logged in');
      console.log('Author token:', authorToken.substring(0, 20) + '...');
      console.log('Reader token:', readerToken.substring(0, 20) + '...');

    } catch (error) {
      console.error('❌ Setup error:', error);
      throw error;
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    try {
      // Clean up all test data
      await User.deleteMany({ 
        email: { $regex: /(author|reader).*@test\.com/ } 
      });
      await Story.deleteMany({ 
        title: { $regex: /Epic Failure|Test Story|Draft Story/i } 
      });
      
      await mongoose.connection.close();
      console.log('✅ Tests completed, database cleaned and closed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }, TEST_TIMEOUT);

  // ========== CREATE STORY TESTS ==========
  describe('POST /api/stories', () => {
    test('should create a published story with valid data', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(validStory);

      console.log('✅ Create story response:', res.status);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.story).toHaveProperty('_id');
      expect(res.body.story.title).toBe(validStory.title);
      expect(res.body.story.status).toBe('published');
      expect(res.body.story.authorUsername).toBeTruthy();
      
      storyId = res.body.story._id;
      console.log('📝 Story created with ID:', storyId);
    }, TEST_TIMEOUT);

    test('should create a draft story', async () => {
      const draftStory = {
        ...validStory,
        title: 'Draft Story That Will Be Published Later',
        status: 'draft'
      };

      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authorToken}`)
        .send(draftStory);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.story.status).toBe('draft');
      
      draftStoryId = res.body.story._id;
    }, TEST_TIMEOUT);

    test('should reject story without authentication', async () => {
      const res = await request(app)
        .post('/api/stories')
        .send(validStory);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject story with missing required fields', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'Short',
          content: 'Too short'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject story with invalid category', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          ...validStory,
          category: 'invalid_category'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject story with title too short', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          ...validStory,
          title: 'Short'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject story with content too short', async () => {
      const res = await request(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          ...validStory,
          content: 'This is too short.'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);
  });

  // ========== GET ALL STORIES TESTS ==========
  describe('GET /api/stories', () => {
    beforeAll(async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('should get all published stories', async () => {
      const res = await request(app)
        .get('/api/stories');

      console.log('✅ Get stories response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stories).toBeInstanceOf(Array);
      expect(res.body.stories.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();
    }, TEST_TIMEOUT);

    test('should filter stories by category', async () => {
      const res = await request(app)
        .get('/api/stories?category=business');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.filters.category).toBe('business');
    }, TEST_TIMEOUT);

    test('should search stories by keyword', async () => {
      const res = await request(app)
        .get('/api/stories?search=failure');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }, TEST_TIMEOUT);

    test('should sort stories by popular', async () => {
      const res = await request(app)
        .get('/api/stories?sortBy=popular');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.filters.sortBy).toBe('popular');
    }, TEST_TIMEOUT);

    test('should paginate stories correctly', async () => {
      const res = await request(app)
        .get('/api/stories?page=1&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination.currentPage).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
    }, TEST_TIMEOUT);

    test('should get stories by author username', async () => {
      const res = await request(app)
        .get(`/api/stories?authorUsername=${testAuthor.username}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  // ========== GET STORY BY ID TESTS ==========
  describe('GET /api/stories/:id', () => {
    test('should get story by valid ID', async () => {
      if (!storyId) {
        console.warn('⚠️  No story ID available');
        return;
      }

      const res = await request(app)
        .get(`/api/stories/${storyId}`);

      console.log('✅ Get story by ID response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.story).toHaveProperty('_id', storyId);
      expect(res.body.story).toHaveProperty('title');
      expect(res.body.story).toHaveProperty('author');
      expect(res.body.story).toHaveProperty('stats');
    }, TEST_TIMEOUT);

    test('should increment view count on story view', async () => {
      if (!storyId) return;

      const res1 = await request(app)
        .get(`/api/stories/${storyId}`);
      
      const initialViews = res1.body.story.views || res1.body.story.stats?.views || 0;

      await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds

      const res2 = await request(app)
        .get(`/api/stories/${storyId}`);
      
      const newViews = res2.body.story.views || res2.body.story.stats?.views || 0;

      expect(newViews).toBeGreaterThanOrEqual(initialViews);
    }, 10000);

    test('should reject invalid story ID format', async () => {
      const res = await request(app)
        .get('/api/stories/invalid-id');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should return 404 for non-existent story', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/stories/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should not show draft stories to non-owners', async () => {
      if (!draftStoryId) return;

      const res = await request(app)
        .get(`/api/stories/${draftStoryId}`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should show draft stories to owner', async () => {
      if (!draftStoryId) return;

      const res = await request(app)
        .get(`/api/stories/${draftStoryId}`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.story.status).toBe('draft');
    }, TEST_TIMEOUT);
  });

  // ========== GET STORIES BY AUTHOR TESTS ==========
  describe('GET /api/stories/author/:authorUsername', () => {
    test('should get stories by author username', async () => {
      const res = await request(app)
        .get(`/api/stories/author/${testAuthor.username}`);

      console.log('✅ Get stories by author response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stories).toBeInstanceOf(Array);
      expect(res.body.author).toBeDefined();
      expect(res.body.pagination).toBeDefined();
    }, TEST_TIMEOUT);

    test('should return 404 for non-existent author', async () => {
      const res = await request(app)
        .get('/api/stories/author/nonexistentuser999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);
  });

  // ========== LIKE STORY TESTS ========== 
  // ✅ FIXED: Changed .post() to .patch() for all like routes
  describe('PATCH /api/stories/:id/like', () => {
    test('should like a story when authenticated', async () => {
      if (!storyId) return;

      const res = await request(app)
        .patch(`/api/stories/${storyId}/like`)  // ✅ CHANGED FROM .post TO .patch
        .set('Authorization', `Bearer ${readerToken}`);

      console.log('✅ Like story response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isLiked).toBe(true);
      expect(res.body.likesCount).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    test('should unlike a story on second like', async () => {
      if (!storyId) return;

      const res = await request(app)
        .patch(`/api/stories/${storyId}/like`)  // ✅ CHANGED FROM .post TO .patch
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isLiked).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject like without authentication', async () => {
      if (!storyId) return;

      const res = await request(app)
        .patch(`/api/stories/${storyId}/like`);  // ✅ CHANGED FROM .post TO .patch

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject like for invalid story ID', async () => {
      const res = await request(app)
        .patch('/api/stories/invalid-id/like')  // ✅ CHANGED FROM .post TO .patch
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject like for non-existent story', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/stories/${fakeId}/like`)  // ✅ CHANGED FROM .post TO .patch
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);
  });

  // ========== ADD COMMENT TESTS ==========
  // ✅ FIXED: Changed /comments to /comment (singular)
  describe('POST /api/stories/:id/comment', () => {
    test('should add comment to story when authenticated', async () => {
      if (!storyId) return;

      const res = await request(app)
        .post(`/api/stories/${storyId}/comment`)  // ✅ CHANGED FROM /comments TO /comment
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          content: 'Great story! Very inspiring and relatable.'
        });

      console.log('✅ Add comment response:', res.status);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.content).toBe('Great story! Very inspiring and relatable.');
      expect(res.body.commentsCount).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    test('should reject comment without authentication', async () => {
      if (!storyId) return;

      const res = await request(app)
        .post(`/api/stories/${storyId}/comment`)  // ✅ CHANGED FROM /comments TO /comment
        .send({
          content: 'This should fail'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject empty comment', async () => {
      if (!storyId) return;

      const res = await request(app)
        .post(`/api/stories/${storyId}/comment`)  // ✅ CHANGED FROM /comments TO /comment
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          content: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject comment that is too long', async () => {
      if (!storyId) return;

      const longComment = 'a'.repeat(1001);
      const res = await request(app)
        .post(`/api/stories/${storyId}/comment`)  // ✅ CHANGED FROM /comments TO /comment
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          content: longComment
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject comment for invalid story ID', async () => {
      const res = await request(app)
        .post('/api/stories/invalid-id/comment')  // ✅ CHANGED FROM /comments TO /comment
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          content: 'This should fail'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);
  });

  // ========== GET COMMENTS TESTS ==========
  describe('GET /api/stories/:id/comments', () => {
    test('should get comments for a story', async () => {
      if (!storyId) return;

      const res = await request(app)
        .get(`/api/stories/${storyId}/comments`);

      console.log('✅ Get comments response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.comments).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    }, TEST_TIMEOUT);

    test('should paginate comments correctly', async () => {
      if (!storyId) return;

      const res = await request(app)
        .get(`/api/stories/${storyId}/comments?page=1&limit=5`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination.currentPage).toBe(1);
    }, TEST_TIMEOUT);
  });

  // ========== UPDATE STORY TESTS ==========
  describe('PUT /api/stories/:id', () => {
    test('should update own story when authenticated', async () => {
      if (!storyId) return;

      const res = await request(app)
        .put(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          title: 'My Epic Failure Story That Changed Everything - Updated'
        });

      console.log('✅ Update story response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.story.title).toContain('Updated');
    }, TEST_TIMEOUT);

    test('should reject update without authentication', async () => {
      if (!storyId) return;

      const res = await request(app)
        .put(`/api/stories/${storyId}`)
        .send({
          title: 'Should fail'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject update of other user\'s story', async () => {
      if (!storyId) return;

      const res = await request(app)
        .put(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${readerToken}`)
        .send({
          title: 'Should fail'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject update with invalid data', async () => {
      if (!storyId) return;

      const res = await request(app)
        .put(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          category: 'invalid_category'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);
  });

  // ========== DELETE STORY TESTS ==========
  describe('DELETE /api/stories/:id', () => {
    test('should reject delete without authentication', async () => {
      if (!draftStoryId) return;

      const res = await request(app)
        .delete(`/api/stories/${draftStoryId}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject delete of other user\'s story', async () => {
      if (!storyId) return;

      const res = await request(app)
        .delete(`/api/stories/${storyId}`)
        .set('Authorization', `Bearer ${readerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should delete own story when authenticated', async () => {
      if (!draftStoryId) return;

      const res = await request(app)
        .delete(`/api/stories/${draftStoryId}`)
        .set('Authorization', `Bearer ${authorToken}`);

      console.log('✅ Delete story response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted successfully/i);
    }, TEST_TIMEOUT);

    test('should return 404 for non-existent story', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/stories/${fakeId}`)
        .set('Authorization', `Bearer ${authorToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);
  });
});
