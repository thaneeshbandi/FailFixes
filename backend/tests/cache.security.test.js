/**
 * Cache isolation regression tests.
 *
 * Two layers:
 *   1. Unit tests of the cacheability predicate.
 *   2. End-to-end tests against a real Redis + real Express app, driving the
 *      exact scenario that was broken: an owner views their unpublished draft,
 *      then an anonymous visitor requests the same URL.
 *
 * The e2e block self-skips when no Redis is reachable, so the suite still runs
 * in environments without one (the unit tests always run).
 */

const net = require('net');

const TEST_TIMEOUT = 30000;
const REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379';

// IMPORTANT: these must be set before ../app (and therefore middleware/cache)
// is first required — initRedis() reads REDIS_URL at module load, and the cache
// middleware short-circuits when NODE_ENV === 'test'. We restore both in
// afterAll so other suites are unaffected.
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
process.env.REDIS_URL = REDIS_URL;
process.env.NODE_ENV = 'development';

const request = require('supertest');
const mongoose = require('mongoose');
const { evaluateCacheability, isAuthenticatedRequest } = require('../middleware/cache');
const cache = require('../middleware/cache');
const app = require('../app');
const User = require('../models/User');
const Story = require('../models/Story');

function probeRedis() {
  return new Promise((resolve) => {
    const url = new URL(REDIS_URL);
    const sock = net
      .connect({ host: url.hostname, port: Number(url.port || 6379) })
      .on('connect', () => {
        sock.end();
        resolve(true);
      })
      .on('error', () => resolve(false));
    sock.setTimeout(1000, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

// ============================================================
describe('🗄️  Cache — cacheability predicate', () => {
  test('anonymous GET is cacheable', () => {
    expect(evaluateCacheability({ method: 'GET', headers: {} }).cacheable).toBe(true);
  });

  test('a request carrying a bearer token is NEVER cacheable', () => {
    const r = evaluateCacheability({
      method: 'GET',
      headers: { authorization: 'Bearer abc.def.ghi' },
    });
    expect(r.cacheable).toBe(false);
    expect(r.reason).toMatch(/authenticated/);
  });

  test('a bare (non-Bearer) token still counts as authenticated', () => {
    expect(isAuthenticatedRequest({ headers: { authorization: 'abc.def.ghi' } })).toBe(true);
  });

  test('a cookie counts as a credential', () => {
    expect(isAuthenticatedRequest({ headers: { cookie: 'session=1' } })).toBe(true);
  });

  test('the frontend\'s literal "null"/"undefined" token is treated as anonymous', () => {
    // These produce the anonymous response body, so caching them is consistent.
    expect(isAuthenticatedRequest({ headers: { authorization: 'Bearer null' } })).toBe(false);
    expect(isAuthenticatedRequest({ headers: { authorization: 'Bearer undefined' } })).toBe(false);
  });

  test('non-GET methods are never cacheable', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(evaluateCacheability({ method, headers: {} }).cacheable).toBe(false);
    }
  });
});

// ============================================================
describe('🗄️  Cache — end-to-end isolation (real Redis)', () => {
  let hasRedis = false;
  let owner;
  let otherUser;
  let ownerToken;
  let otherToken;
  let draftStoryId;
  let publishedStoryId;
  const stamp = Date.now();

  beforeAll(async () => {
    hasRedis = await probeRedis();
    if (!hasRedis) return;

    await mongoose.connect(process.env.MONGODB_URI);

    // wait for the redis client to report ready
    for (let i = 0; i < 50 && !cache.isRedisReady(); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }

    owner = await new User({
      name: `Cache Owner ${stamp}`,
      email: `cacheowner${stamp}@cachetest.com`,
      username: `cowner${stamp}`.slice(0, 20),
      password: 'Test123!@#',
      isVerified: true,
    }).save();

    otherUser = await new User({
      name: `Cache Other ${stamp}`,
      email: `cacheother${stamp}@cachetest.com`,
      username: `cother${stamp}`.slice(0, 20),
      password: 'Test123!@#',
      isVerified: true,
    }).save();

    ownerToken = owner.generateAuthToken();
    otherToken = otherUser.generateAuthToken();

    const draft = await new Story({
      title: 'Secret Unpublished Draft About My Failure',
      content: 'CONFIDENTIAL-DRAFT-MARKER '.repeat(20),
      category: 'business',
      author: owner._id,
      authorUsername: owner.username,
      status: 'draft',
    }).save();
    draftStoryId = draft._id.toString();

    const published = await new Story({
      title: 'A Published Story About Learning From Failure',
      content: 'This one is public and safe to read. '.repeat(10),
      category: 'career',
      author: owner._id,
      authorUsername: owner.username,
      status: 'published',
    }).save();
    publishedStoryId = published._id.toString();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (!hasRedis) return;
    await Story.deleteMany({ author: { $in: [owner._id, otherUser._id] } });
    await User.deleteMany({ email: { $regex: /@cachetest\.com$/ } });
    await cache.invalidateCache('*');
    await cache.quitRedis();
    await mongoose.connection.close();
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    delete process.env.REDIS_URL;
  }, TEST_TIMEOUT);

  const skipIfNoRedis = () => {
    if (!hasRedis) {
      console.warn('⚠️  Skipping Redis e2e cache tests — no Redis at ' + REDIS_URL);
      return true;
    }
    return false;
  };

  test('THE BUG: an owner reading their draft must not populate a cache entry an anonymous visitor can read', async () => {
    if (skipIfNoRedis()) return;

    const url = `/api/stories/${draftStoryId}`;

    // 1. Owner fetches their own unpublished draft — allowed.
    const ownerRes = await request(app).get(url).set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.story.content).toContain('CONFIDENTIAL-DRAFT-MARKER');
    // The authenticated request must have bypassed the cache entirely.
    expect(ownerRes.headers['x-cache-status']).toBe('BYPASS');

    // 2. Anonymous visitor requests the exact same URL.
    const anonRes = await request(app).get(url);
    expect(anonRes.status).toBe(404);
    expect(JSON.stringify(anonRes.body)).not.toContain('CONFIDENTIAL-DRAFT-MARKER');

    // 3. And a different logged-in user cannot see it either.
    const otherRes = await request(app).get(url).set('Authorization', `Bearer ${otherToken}`);
    expect(otherRes.status).toBe(404);
    expect(JSON.stringify(otherRes.body)).not.toContain('CONFIDENTIAL-DRAFT-MARKER');
  }, TEST_TIMEOUT);

  test('no cache key is ever written for an authenticated request', async () => {
    if (skipIfNoRedis()) return;

    await cache.invalidateCache('*');
    await request(app)
      .get(`/api/stories/${publishedStoryId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const client = cache.getClient();
    const keys = [];
    // node-redis v5 yields batches, not individual keys.
    for await (const batch of client.scanIterator({ MATCH: 'cache:*', COUNT: 100 })) {
      keys.push(...(Array.isArray(batch) ? batch : [batch]));
    }
    expect(keys).toEqual([]);
  }, TEST_TIMEOUT);

  test('user A\'s personalised isLiked does not leak to user B via the cache', async () => {
    if (skipIfNoRedis()) return;

    await cache.invalidateCache('*');

    // otherUser likes the published story.
    const likeRes = await request(app)
      .patch(`/api/stories/${publishedStoryId}/like`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.isLiked).toBe(true);

    const url = `/api/stories?limit=50`;

    // User B (the liker) sees isLiked: true.
    const bRes = await request(app).get(url).set('Authorization', `Bearer ${otherToken}`);
    const bStory = bRes.body.stories.find((s) => s._id === publishedStoryId);
    expect(bStory).toBeDefined();
    expect(bStory.isLiked).toBe(true);

    // The owner, who has NOT liked it, must see isLiked: false for the same URL.
    const aRes = await request(app).get(url).set('Authorization', `Bearer ${ownerToken}`);
    const aStory = aRes.body.stories.find((s) => s._id === publishedStoryId);
    expect(aStory).toBeDefined();
    expect(aStory.isLiked).toBe(false);

    // And an anonymous visitor must see isLiked: false.
    const anonRes = await request(app).get(url);
    const anonStory = anonRes.body.stories.find((s) => s._id === publishedStoryId);
    expect(anonStory).toBeDefined();
    expect(anonStory.isLiked).toBe(false);
  }, TEST_TIMEOUT);

  test('anonymous responses ARE still cached (the optimisation is preserved)', async () => {
    if (skipIfNoRedis()) return;

    await cache.invalidateCache('*');
    const url = '/api/stories?limit=5&page=1';

    const miss = await request(app).get(url);
    expect(miss.status).toBe(200);
    expect(miss.headers['x-cache-status']).toBe('MISS');

    const hit = await request(app).get(url);
    expect(hit.status).toBe(200);
    expect(hit.headers['x-cache-status']).toBe('HIT');
  }, TEST_TIMEOUT);


  test('a write invalidates the anonymous cache (the invalidation middleware actually runs)', async () => {
    if (skipIfNoRedis()) return;

    await cache.invalidateCache('*');
    const url = '/api/stories?limit=50&page=1';

    // Prime the anonymous cache.
    const first = await request(app).get(url);
    expect(first.headers['x-cache-status']).toBe('MISS');
    expect((await request(app).get(url)).headers['x-cache-status']).toBe('HIT');

    // A write must clear it — previously this middleware was mounted after the
    // routes and never executed, so the entry survived until its 300s TTL.
    const created = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'A Freshly Published Story For Cache Invalidation',
        content: 'Content long enough to satisfy the validator. '.repeat(4),
        category: 'personal',
      });
    expect(created.status).toBe(201);

    const after = await request(app).get(url);
    expect(after.headers['x-cache-status']).toBe('MISS');
    // ...and the new story is visible to anonymous visitors immediately.
    expect(after.body.stories.some((s) => s.title.includes('Cache Invalidation'))).toBe(true);
  }, TEST_TIMEOUT);

  test('responses advertise Vary: Authorization so a shared proxy cannot reintroduce the bug', async () => {
    if (skipIfNoRedis()) return;
    const res = await request(app).get('/api/stories?limit=1');
    expect(String(res.headers.vary)).toMatch(/Authorization/i);
  }, TEST_TIMEOUT);
});
