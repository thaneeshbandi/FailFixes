// backend/tests/api.test.js

require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

const TEST_TIMEOUT = 30000;

let authToken = '';
let userId = '';
let testStoryId = '';

// Keep IDs short so they pass validation constraints (username <= 20 chars). [file:73]
const suffix = Math.random().toString(36).slice(2, 8); // 6 chars
const timestamp = Date.now();

const testUser = {
  name: 'Test User', // often required by register validation
  username: `tester${suffix}`, // <= 12 chars, safe. [file:73]
  email: `test${timestamp}@test.com`,
  password: 'TestPass123!',
};

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('❌ MONGODB_URI not found');
  }

  console.log('\n🔗 Connecting to test database...');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}, TEST_TIMEOUT);

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.collection('users').deleteMany({
        email: { $regex: /test.*@test\.com/ },
      });
      await mongoose.connection.db.collection('stories').deleteMany({
        title: { $regex: /Test Story/ },
      });
      console.log('\n🧹 Test data cleaned');
    }
  } catch (error) {
    console.warn('⚠️  Cleanup error:', error.message);
  }

  await mongoose.connection.close();
  console.log('👋 Database disconnected\n');
}, 10000);

describe('🏥 Health Check', () => {
  test('should return API health status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      status: expect.stringMatching(/OK|healthy/i),
    });
  });
});

describe('🔐 Authentication', () => {
  test('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect('Content-Type', /json/);

    console.log('\n📋 Registration Response:');
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.body, null, 2));

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message');

    console.log('✅ User registered successfully');
  });

  test('should reject duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.status).toBe(400);
  });

  test('should login with correct credentials', async () => {
    const loginData = {
      identifier: testUser.email,
      password: testUser.password,
    };

    const res = await request(app)
      .post('/api/auth/login')
      .send(loginData)
      .expect('Content-Type', /json/);

    console.log('\n📋 Login Response:');
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.body, null, 2));

    if (res.status !== 200) {
      console.error('\n❌ Login failed!');
      console.error('Error:', res.body);
    }

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.token).toBeTruthy();

    authToken = res.body.token;
    userId = res.body.user?._id || res.body.user?.id;

    console.log('✅ Login successful');
    console.log('Token:', authToken.substring(0, 30) + '...');
  });

  test('should reject invalid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      identifier: testUser.email,
      password: 'WrongPassword123!',
    });

    expect([400, 401]).toContain(res.status);
  });

  test('should get current user with valid token', async () => {
    if (!authToken) {
      console.warn('⚠️  Skipping: No auth token');
      return;
    }

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
  });

  test('should reject request without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('📚 Stories', () => {
  test('should create a new story', async () => {
    if (!authToken) {
      console.warn('⚠️  Skipping story creation: No auth token');
      return;
    }

    const storyData = {
      title: `Test Story About Career Failure ${timestamp}`,
      content:
        'I deployed my application to production on a Friday evening without proper testing. Everything broke immediately after deployment. The database migrations failed, the API stopped responding, and users started complaining. I spent the entire weekend fixing it. This was one of the biggest failures in my career, but it taught me invaluable lessons about proper deployment procedures and testing.',
      category: 'technology',
      tags: ['deployment', 'production', 'lessons-learned'],
    };

    const res = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${authToken}`)
      .send(storyData);

    if (res.status !== 201) {
      console.error('❌ Story creation failed:', res.body);
    }

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('story');

    testStoryId = res.body.story._id;
    console.log(`✅ Story created: ${testStoryId}`);
  });

  test('should fetch all stories', async () => {
    const res = await request(app).get('/api/stories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stories');
    expect(Array.isArray(res.body.stories)).toBe(true);
  });

  test('should fetch single story by ID', async () => {
    if (!testStoryId) {
      console.warn('⚠️  Skipping: No story ID');
      return;
    }

    const res = await request(app).get(`/api/stories/${testStoryId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('story');
  });

  test('should return 404 for non-existent story', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).get(`/api/stories/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

describe('👤 User Operations', () => {
  test('should search users', async () => {
    const res = await request(app).get('/api/users/search?q=test');
    expect([200, 404]).toContain(res.status);
  });

  test('should get user profile', async () => {
    if (!testUser.username) return;
    const res = await request(app).get(`/api/users/profile/${testUser.username}`);
    expect([200, 404]).toContain(res.status);
  });
});

describe('❌ Error Handling', () => {
  test('should return 404 for invalid routes', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
  });

  test('should reject unauthorized requests', async () => {
    const res = await request(app).post('/api/stories').send({ title: 'Test' });
    expect(res.status).toBe(401);
  });
});

describe('🧹 Cleanup', () => {
  test('should delete test story', async () => {
    if (!authToken || !testStoryId) {
      console.warn('⚠️  Skipping deletion: No token or story ID');
      return;
    }

    const res = await request(app)
      .delete(`/api/stories/${testStoryId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect([200, 204, 404]).toContain(res.status);

    if (res.status === 200 || res.status === 204) {
      console.log(`✅ Story deleted: ${testStoryId}`);
    }
  });
});
