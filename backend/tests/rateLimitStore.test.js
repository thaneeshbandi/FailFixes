/**
 * Redis rate-limit store tests.
 *
 * The point of moving the store to Redis is that a limit must (a) survive a
 * process restart and (b) be shared between instances. Both are asserted here by
 * constructing two independent store instances against the same Redis — the same
 * shape as two processes — rather than by trusting the configuration.
 *
 * The fallback path matters just as much: Redis is optional in this application,
 * so the store must degrade to in-memory counting rather than fail a request.
 */

const net = require('net');

const REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379';
const ORIGINAL_REDIS_URL = process.env.REDIS_URL;

const redis = require('redis');
const { RedisRateLimitStore, createRateLimitStore, KEY_PREFIX } = require('../middleware/rateLimitStore');
const cache = require('../middleware/cache');

const TEST_TIMEOUT = 20000;

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

let hasRedis = false;
let probeClient;

beforeAll(async () => {
  hasRedis = await probeRedis();
  if (!hasRedis) return;

  process.env.REDIS_URL = REDIS_URL;
  probeClient = redis.createClient({ url: REDIS_URL });
  probeClient.on('error', () => {});
  await probeClient.connect();

  // The store reads the live client from middleware/cache. Point that at our
  // connected client for the duration of this suite.
  cache.__setClientForTests(probeClient, true);
}, TEST_TIMEOUT);

afterAll(async () => {
  if (hasRedis) {
    const keys = await probeClient.keys(`${KEY_PREFIX}test:*`);
    if (keys.length) await probeClient.del(keys);
    await probeClient.quit();
    cache.__setClientForTests(null, false);
  }
  if (ORIGINAL_REDIS_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_REDIS_URL;
}, TEST_TIMEOUT);

const skipIfNoRedis = () => {
  if (!hasRedis) {
    console.warn('⚠️  Skipping Redis rate-limit store tests — no Redis at ' + REDIS_URL);
    return true;
  }
  return false;
};

function makeStore(windowMs = 60_000) {
  const store = new RedisRateLimitStore();
  store.init({ windowMs });
  return store;
}

describe('⏱️  Redis rate-limit store', () => {
  test('counts hits and reports a reset time', async () => {
    if (skipIfNoRedis()) return;
    const store = makeStore();
    const key = `test:count:${Date.now()}`;

    const first = await store.increment(key);
    expect(first.totalHits).toBe(1);
    expect(first.resetTime).toBeInstanceOf(Date);
    expect(first.resetTime.getTime()).toBeGreaterThan(Date.now());

    expect((await store.increment(key)).totalHits).toBe(2);
    expect((await store.increment(key)).totalHits).toBe(3);
  });

  test('THE POINT: two instances share one counter', async () => {
    if (skipIfNoRedis()) return;
    // Two separate store objects against the same Redis == two processes.
    const instanceA = makeStore();
    const instanceB = makeStore();
    const key = `test:shared:${Date.now()}`;

    await instanceA.increment(key);
    await instanceA.increment(key);
    const onB = await instanceB.increment(key);

    // With the old in-memory store this would be 1, and the effective limit
    // would have been N x the configured limit for N instances.
    expect(onB.totalHits).toBe(3);
  });

  test('a new store instance still sees the count — a restart does not reset it', async () => {
    if (skipIfNoRedis()) return;
    const key = `test:restart:${Date.now()}`;
    const before = makeStore();
    await before.increment(key);
    await before.increment(key);

    // Simulate a redeploy: brand new process, same Redis.
    const after = makeStore();
    expect((await after.increment(key)).totalHits).toBe(3);
  });

  test('the window expires so a client is not limited forever', async () => {
    if (skipIfNoRedis()) return;
    const store = makeStore(300); // 300ms window
    const key = `test:expiry:${Date.now()}`;

    await store.increment(key);
    await store.increment(key);
    expect((await store.increment(key)).totalHits).toBe(3);

    await new Promise((r) => setTimeout(r, 450));

    // The key expired, so the window starts over.
    expect((await store.increment(key)).totalHits).toBe(1);
  });

  test('a key always gets a TTL — no counter can leak forever', async () => {
    if (skipIfNoRedis()) return;
    const store = makeStore(60_000);
    const key = `test:ttl:${Date.now()}`;
    await store.increment(key);

    const ttl = await probeClient.pTTL(`${KEY_PREFIX}${key}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
  });

  test('resetKey clears the counter', async () => {
    if (skipIfNoRedis()) return;
    const store = makeStore();
    const key = `test:reset:${Date.now()}`;
    await store.increment(key);
    await store.increment(key);
    await store.resetKey(key);
    expect((await store.increment(key)).totalHits).toBe(1);
  });

  test('decrement gives a hit back', async () => {
    if (skipIfNoRedis()) return;
    const store = makeStore();
    const key = `test:dec:${Date.now()}`;
    await store.increment(key);
    await store.increment(key);
    await store.decrement(key);
    expect((await store.increment(key)).totalHits).toBe(2);
  });
});

describe('⏱️  Rate-limit store fallback behaviour', () => {
  test('falls back to memory when Redis is unavailable rather than failing', async () => {
    // No client configured at all — the failure mode a Redis outage produces.
    cache.__setClientForTests(null, false);

    const store = makeStore();
    const key = `test:fallback:${Date.now()}`;

    const first = await store.increment(key);
    const second = await store.increment(key);

    // Still counting, just not shared. A request is never failed by the store.
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);

    if (hasRedis) cache.__setClientForTests(probeClient, true);
  });

  test('createRateLimitStore returns undefined with no REDIS_URL, so limiting still works', () => {
    const saved = process.env.REDIS_URL;
    delete process.env.REDIS_URL;

    // undefined means "let express-rate-limit use its own MemoryStore" — the
    // dependency stays genuinely optional.
    expect(createRateLimitStore()).toBeUndefined();

    if (saved === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = saved;
  });
});
