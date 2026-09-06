/**
 * Rate limiting behaviour.
 *
 * Rate limiting is skipped when NODE_ENV==='test' unless ENABLE_RATE_LIMIT_TESTS
 * is set, so the other suites can make hundreds of rapid calls. This file opts
 * in, and must therefore be self-contained: it sets the flag before requiring
 * the app and clears limiter state between tests.
 */

process.env.ENABLE_RATE_LIMIT_TESTS = 'true';
// Small, explicit budgets so the tests are fast and deterministic rather than
// depending on the production defaults.
process.env.AUTH_RATE_LIMIT_MAX = '5';
process.env.AI_RATE_LIMIT_MAX = '3';
process.env.WRITE_RATE_LIMIT_MAX = '10';
process.env.VIEW_RATE_LIMIT_MAX = '8';

const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../app');
const limiters = require('../middleware/rateLimit');
const User = require('../models/User');
const Story = require('../models/Story');

const TEST_TIMEOUT = 30000;
const stamp = Date.now();

let user;
let token;
let storyId;

/**
 * express-rate-limit keys on `ip:<addr>` or `u:<id>`. supertest always connects
 * from ::ffff:127.0.0.1, so resetting those two keys clears state between tests.
 */
function resetLimiters(userId) {
  const keys = ['ip:::ffff:127.0.0.1', 'ip:127.0.0.1', 'ip:::1'];
  if (userId) keys.push(`u:${userId}`);
  for (const limiter of Object.values(limiters)) {
    if (limiter && typeof limiter.resetKey === 'function') {
      keys.forEach((k) => limiter.resetKey(k));
    }
  }
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  user = await new User({
    name: `RL User ${stamp}`,
    email: `rl${stamp}@rltest.com`,
    username: `rl${stamp}`.slice(0, 20),
    password: 'Test123!@#',
    isVerified: true,
  }).save();
  token = user.generateAuthToken();

  const story = await new Story({
    title: 'A Story For Rate Limit Testing Purposes',
    content: 'Content that is comfortably long enough for the validator. '.repeat(4),
    category: 'career',
    author: user._id,
    authorUsername: user.username,
    status: 'published',
  }).save();
  storyId = story._id.toString();
}, TEST_TIMEOUT);

afterAll(async () => {
  await Story.deleteMany({ author: user._id });
  await User.deleteMany({ email: { $regex: /@rltest\.com$/ } });
  await mongoose.connection.close();
  delete process.env.ENABLE_RATE_LIMIT_TESTS;
}, TEST_TIMEOUT);

beforeEach(() => resetLimiters(user && user._id));

describe('🚦 Rate limiting — login', () => {
  test('legitimate traffic under the limit is not blocked', async () => {
    for (let i = 0; i < 4; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: user.email, password: 'Test123!@#' });
      expect(res.status).toBe(200);
    }
  }, TEST_TIMEOUT);

  test('brute-force attempts are throttled with 429', async () => {
    let throttled = null;
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: user.email, password: `wrong-guess-${i}` });
      if (res.status === 429) {
        throttled = res;
        break;
      }
    }
    expect(throttled).not.toBeNull();
    expect(throttled.body.code).toBe('RATE_LIMITED_AUTH');
    expect(throttled.body.retryAfter).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  test('the throttle also blocks a *correct* password once tripped (no bypass)', async () => {
    for (let i = 0; i < 6; i += 1) {
      await request(app).post('/api/auth/login').send({ identifier: user.email, password: 'nope' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: user.email, password: 'Test123!@#' });
    expect(res.status).toBe(429);
  }, TEST_TIMEOUT);

  test('registration shares the auth budget', async () => {
    let throttled = false;
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: `Spam ${i}`, email: `spam${i}${stamp}@rltest.com`, password: 'Test123!@#' });
      if (res.status === 429) {
        throttled = true;
        break;
      }
    }
    expect(throttled).toBe(true);
  }, TEST_TIMEOUT);
});

describe('🚦 Rate limiting — AI generation (denial-of-wallet)', () => {
  test('is capped per user, well below the general write budget', async () => {
    let throttled = null;
    for (let i = 0; i < 8; i += 1) {
      const res = await request(app)
        .post('/api/ai/generate-story')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: `write a story about failure number ${i}` });
      if (res.status === 429) {
        throttled = res;
        break;
      }
    }
    expect(throttled).not.toBeNull();
    expect(throttled.body.code).toBe('RATE_LIMITED_AI');
  }, TEST_TIMEOUT);

  test('an unauthenticated caller is rejected before consuming AI budget', async () => {
    const res = await request(app)
      .post('/api/ai/generate-story')
      .send({ prompt: 'free llm please' });
    expect(res.status).toBe(401);
  });
});

describe('🚦 Rate limiting — unauthenticated view tracking', () => {
  test('view-count inflation is bounded', async () => {
    let throttled = false;
    for (let i = 0; i < 20; i += 1) {
      const res = await request(app).post(`/api/stories/${storyId}/view`);
      if (res.status === 429) {
        throttled = true;
        break;
      }
    }
    expect(throttled).toBe(true);
  }, TEST_TIMEOUT);
});

describe('🚦 Rate limiting — writes', () => {
  test('normal write activity is not blocked', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: `bio revision ${i}` });
      expect(res.status).toBe(200);
    }
  }, TEST_TIMEOUT);

  test('a write flood is throttled', async () => {
    let throttled = false;
    for (let i = 0; i < 25; i += 1) {
      const res = await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: `flood ${i}` });
      if (res.status === 429) {
        throttled = true;
        break;
      }
    }
    expect(throttled).toBe(true);
  }, TEST_TIMEOUT);
});

describe('🚦 Rate limiting — configuration', () => {
  test('limits are keyed per user, so one account cannot exhaust another\'s budget', async () => {
    const other = await new User({
      name: `RL Other ${stamp}`,
      email: `rlother${stamp}@rltest.com`,
      username: `rlo${stamp}`.slice(0, 20),
      password: 'Test123!@#',
      isVerified: true,
    }).save();
    const otherToken = other.generateAuthToken();

    // Exhaust the first user's write budget.
    for (let i = 0; i < 25; i += 1) {
      await request(app)
        .put('/api/users/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: `exhaust ${i}` });
    }
    const blocked = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'blocked' });
    expect(blocked.status).toBe(429);

    // The second user is unaffected.
    const ok = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ bio: 'unaffected' });
    expect(ok.status).toBe(200);
  }, TEST_TIMEOUT);

  test('429 responses advertise standard RateLimit headers', async () => {
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: user.email, password: 'nope' });
      if (res.status === 429) {
        expect(res.headers).toHaveProperty('ratelimit-limit');
        expect(res.headers).toHaveProperty('ratelimit-remaining');
        return;
      }
    }
    throw new Error('never hit the rate limit');
  }, TEST_TIMEOUT);
});
