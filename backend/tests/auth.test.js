require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');

const TEST_TIMEOUT = 30000;

describe('🔐 Authentication Tests', () => {
  const timestamp = Date.now();
  
  const testUser = {
  name: 'Auth Test User',
  email: `authtest${timestamp}@test.com`,
  username: `test${timestamp}`.slice(0, 20),  // ← LIMIT TO 20 CHARS
  password: 'Test123!@#'
};

  let authToken = '';
  let userId = '';

  // ========== SETUP & TEARDOWN ==========
  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connected to test database');
      
      // Clean up before tests
      await User.deleteMany({ 
        $or: [
          { email: { $regex: /authtest.*@test\.com/ } },
          { email: { $regex: /nousername.*@test\.com/ } },
          { email: { $regex: /test.*@test\.com/ } }
        ]
      });
      console.log('🧹 Database cleaned');
    } catch (error) {
      console.error('❌ Setup error:', error);
      throw error;
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {
    try {
      // Clean up after tests
      await User.deleteMany({ 
        $or: [
          { email: { $regex: /authtest.*@test\.com/ } },
          { email: { $regex: /nousername.*@test\.com/ } },
          { email: { $regex: /test.*@test\.com/ } }
        ]
      });
      
      await mongoose.connection.close();
      console.log('✅ Tests completed, database cleaned and closed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }, TEST_TIMEOUT);

  // ========== REGISTRATION TESTS ==========
  describe('POST /api/auth/register', () => {
    test('should register new user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      console.log('✅ Register response:', res.status, res.body.message);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/created successfully|log in/i);
    }, TEST_TIMEOUT);

    test('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already|exists|registered/i);
    }, TEST_TIMEOUT);

    test('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'Test123!@#'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: `test${Date.now()}@test.com`,
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should register user without username (optional field)', async () => {
      const userWithoutUsername = {
        name: 'No Username User',
        email: `nousername${Date.now()}@test.com`,
        password: 'Test123!@#'
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(userWithoutUsername);

      console.log('✅ No username response:', res.status);

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    }, TEST_TIMEOUT);
  });

  // ========== LOGIN TESTS ==========
  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Wait for database sync
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('should login with correct email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: testUser.password
        });

      console.log('✅ Login response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.token).toBeTruthy();
      
      authToken = res.body.token;
      userId = res.body.user.id;
      
      console.log('✅ Token saved');
    }, TEST_TIMEOUT);

    test('should login with username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.username,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.token).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: testUser.email,
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid credentials/i);
    }, TEST_TIMEOUT);

    test('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'nonexistent@test.com',
          password: 'Test123!@#'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid credentials/i);
    }, TEST_TIMEOUT);

    test('should reject missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);
  });

  // ========== GET ME TESTS ==========
  describe('GET /api/auth/me', () => {
    test('should get current user with valid token', async () => {
      if (!authToken) {
        console.warn('⚠️  Skipping: No auth token');
        return;
      }

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      console.log('✅ Get me response:', res.status);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toHaveProperty('email', testUser.email);
      expect(res.body.user).toHaveProperty('username', testUser.username);
      expect(res.body.user).toHaveProperty('name', testUser.name);
    }, TEST_TIMEOUT);

    test('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token_123');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);

    test('should reject malformed authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }, TEST_TIMEOUT);
  });
});
