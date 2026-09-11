/**
 * Runtime proof that the pre-authentication gate protects `auth` itself.
 *
 * The ordering tests in ratelimit.contract.test.js assert the middleware
 * sequence. This asserts the consequence: a flood of requests carrying an
 * INVALID token stops being answered 401 and starts being answered 429.
 *
 * That transition is only possible if the limiter runs BEFORE `auth` — if it
 * ran after, every request would reach `protect`, fail JWT verification, and
 * return 401 forever, with the signature check paid on every one of them.
 *
 * Rate limiting is disabled during tests unless ENABLE_RATE_LIMIT_TESTS=true
 * (see middleware/rateLimit.js), so this suite opts in and uses a small budget.
 */

process.env.ENABLE_RATE_LIMIT_TESTS = 'true';
process.env.PREAUTH_RATE_LIMIT_MAX = '12';
process.env.PREAUTH_RATE_LIMIT_WINDOW_MS = '60000';

const request = require('supertest');
const app = require('../app');
const { preAuthLimiter } = require('../middleware/rateLimit');

const BUDGET = 12;
const INVALID = 'Bearer not.a.real.token';

/** Each test gets a distinct IP so the per-IP buckets never collide. */
let ipCounter = 0;
const nextIp = () => `198.51.100.${(ipCounter += 1)}`;

beforeEach(async () => {
  // app.js sets `trust proxy = 1`, so X-Forwarded-For determines req.ip.
  if (preAuthLimiter.resetKey) {
    for (let i = 0; i <= ipCounter + 1; i += 1) {
      await preAuthLimiter.resetKey(`preauth:ip:198.51.100.${i}`);
    }
  }
});

afterAll(() => {
  delete process.env.ENABLE_RATE_LIMIT_TESTS;
  delete process.env.PREAUTH_RATE_LIMIT_MAX;
  delete process.env.PREAUTH_RATE_LIMIT_WINDOW_MS;
});

/** Fire n requests from one IP, returning the observed status codes. */
async function flood(method, path, n, ip) {
  const codes = [];
  for (let i = 0; i < n; i += 1) {
    const res = await request(app)[method](path)
      .set('Authorization', INVALID)
      .set('X-Forwarded-For', ip);
    codes.push(res.status);
  }
  return codes;
}

describe('🛡️  E · auth is protected against request floods', () => {
  test('an invalid-token flood flips from 401 to 429 — proving the gate precedes auth', async () => {
    const ip = nextIp();
    const codes = await flood('post', '/api/auth/logout', BUDGET + 6, ip);

    // Early requests reach `protect` and are rejected on the token.
    expect(codes[0]).toBe(401);
    // Once the IP budget is spent, requests never reach `protect` at all.
    expect(codes[codes.length - 1]).toBe(429);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  }, 30000);

  test('the 429 is the pre-auth gate, identified by its code and message', async () => {
    const ip = nextIp();
    await flood('get', '/api/users/search?q=x', BUDGET + 2, ip);

    const res = await request(app)
      .get('/api/users/search?q=x')
      .set('Authorization', INVALID)
      .set('X-Forwarded-For', ip);

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.message).toMatch(/network/i);
  }, 30000);

  test('the gate is per-IP: a second address is unaffected by the first exhausting it', async () => {
    const attacker = nextIp();
    const bystander = nextIp();

    await flood('post', '/api/auth/logout', BUDGET + 4, attacker);

    const blocked = await request(app).post('/api/auth/logout')
      .set('Authorization', INVALID).set('X-Forwarded-For', attacker);
    const innocent = await request(app).post('/api/auth/logout')
      .set('Authorization', INVALID).set('X-Forwarded-For', bystander);

    expect(blocked.status).toBe(429);
    // The bystander still reaches `protect` and gets the honest 401.
    expect(innocent.status).toBe(401);
  }, 30000);

  test('all four flagged routes are gated', async () => {
    const routes = [
      ['post', '/api/auth/logout'],
      ['put', '/api/auth/change-password'],
      ['get', '/api/users/search?q=x'],
      ['get', '/api/users/me/liked'],
    ];

    for (const [method, path] of routes) {
      const ip = nextIp();
      const codes = await flood(method, path, BUDGET + 3, ip);
      expect(codes[codes.length - 1]).toBe(429);
    }
  }, 60000);
});
