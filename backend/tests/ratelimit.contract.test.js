/**
 * Rate-limit contract tests.
 *
 * These exist because of a CodeQL `js/missing-rate-limiting` failure on PR #1.
 * Two distinct problems produced those 11 high-severity alerts:
 *
 *   1. Four routes genuinely had no limiter (POST /auth/logout, GET /chats,
 *      GET /chats/:chatId/messages, GET /users/me/liked).
 *   2. Four routes DID have one, but the limiters were produced by a factory
 *      that returned the constructed middleware, so CodeQL's dataflow could not
 *      see a `rateLimit(...)` result reaching the route and reported them as
 *      unprotected.
 *
 * A static analyser can be made to see (2) by refactoring, but nothing stopped
 * the same regression recurring. These tests assert the properties directly,
 * against the real Express router, so the guarantee does not depend on CodeQL.
 */

const app = require('../app');
const {
  authLimiter,
  writeLimiter,
  searchLimiter,
  aiLimiter,
  viewLimiter,
  userOrIpKey,
} = require('../middleware/rateLimit');

/** Every limiter, by identity, so a handler can be recognised in a route stack. */
const LIMITERS = new Map([
  [authLimiter, 'authLimiter'],
  [writeLimiter, 'writeLimiter'],
  [searchLimiter, 'searchLimiter'],
  [aiLimiter, 'aiLimiter'],
  [viewLimiter, 'viewLimiter'],
]);

/** Limiters whose key depends on req.user and which must therefore follow auth. */
const USER_AWARE = new Set(['writeLimiter', 'searchLimiter', 'aiLimiter']);

/**
 * `auth` is an alias for `protect`, so a REQUIRED-auth middleware appears in the
 * stack under the name `protect`. `optionalAuth` never rejects, so it does not
 * guarantee `req.user` exists and is treated separately below.
 */
const REQUIRED_AUTH = 'protect';
const OPTIONAL_AUTH = 'optionalAuth';

/**
 * Walk the mounted Express router tree and return the ordered middleware stack
 * for one route, as a list of { name, limiter } descriptors.
 *
 * Matching mirrors how Express itself routes: a mounted router's regexp is
 * exec'd against the remaining path and the matched prefix is consumed, rather
 * than trying to reverse-engineer a literal mount path out of the regexp source.
 */
function stackFor(method, path) {
  let result = null;

  const walk = (layers, remaining) => {
    for (const layer of layers) {
      if (layer.route) {
        if (layer.route.path === remaining && layer.route.methods[method]) {
          result = layer.route.stack.map((s) => ({
            name: s.handle.name || '(anonymous)',
            limiter: LIMITERS.get(s.handle) || null,
          }));
          return true;
        }
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        const m = layer.regexp.exec(remaining);
        if (m) {
          let rest = remaining.slice(m[0].length);
          if (!rest.startsWith('/')) rest = `/${rest}`;
          if (walk(layer.handle.stack, rest)) return true;
        }
      }
    }
    return false;
  };

  walk(app._router.stack, path);
  return result;
}

/** Routes that must be rate limited, and the limiter each must use. */
const PROTECTED_ROUTES = [
  // --- the four that were genuinely missing a limiter (CodeQL: real findings) ---
  ['post', '/api/auth/logout', 'writeLimiter'],
  ['get', '/api/chats', 'searchLimiter'],
  ['get', '/api/chats/:chatId/messages', 'searchLimiter'],
  ['get', '/api/users/me/liked', 'searchLimiter'],

  // --- the four CodeQL reported that already had one (analyser blind spot) ---
  ['put', '/api/auth/change-password', 'authLimiter'],
  ['post', '/api/chats/direct', 'writeLimiter'],
  ['put', '/api/chats/:chatId/read', 'writeLimiter'],
  ['get', '/api/users/search', 'searchLimiter'],

  // --- spot checks on the pre-existing limiters, so the refactor can't drop one ---
  ['post', '/api/auth/login', 'authLimiter'],
  ['post', '/api/auth/register', 'authLimiter'],
  ['post', '/api/ai/generate-story', 'aiLimiter'],
  ['post', '/api/stories', 'writeLimiter'],
  ['post', '/api/stories/:id/view', 'viewLimiter'],
  ['get', '/api/stories', 'searchLimiter'],
];

describe('⏱️  Route rate-limit contract', () => {
  test('the router walker actually resolves routes (guards against vacuous passes)', () => {
    expect(stackFor('get', '/api/auth/me')).not.toBeNull();
    expect(stackFor('get', '/api/nope/not/a/route')).toBeNull();
  });

  test.each(PROTECTED_ROUTES)('%s %s is rate limited by %s', (method, path, expected) => {
    const stack = stackFor(method, path);
    expect(stack).not.toBeNull();

    const limiters = stack.map((s) => s.limiter).filter(Boolean);
    expect(limiters).toContain(expected);
  });

  // The ordering invariant applies to routes where authentication is REQUIRED.
  // On such a route req.user is guaranteed, so a user-aware limiter placed
  // before auth would silently degrade to per-IP keying — every user behind one
  // NAT sharing a single bucket. This is exactly the property that CodeQL's
  // suggested "move the limiter ahead of auth" autofix would have broken.
  const REQUIRED_AUTH_ROUTES = PROTECTED_ROUTES.filter(([method, path, limiter]) => {
    if (!USER_AWARE.has(limiter)) return false;
    const stack = stackFor(method, path);
    return Boolean(stack && stack.some((s) => s.name === REQUIRED_AUTH));
  });

  test('the required-auth route set is non-empty (guards against a vacuous filter)', () => {
    expect(REQUIRED_AUTH_ROUTES.length).toBeGreaterThanOrEqual(7);
  });

  test.each(REQUIRED_AUTH_ROUTES)(
    '%s %s runs required auth BEFORE the user-aware limiter %s',
    (method, path, expected) => {
      const stack = stackFor(method, path);
      const authIdx = stack.findIndex((s) => s.name === REQUIRED_AUTH);
      const limIdx = stack.findIndex((s) => s.limiter === expected);

      expect(authIdx).toBeGreaterThanOrEqual(0);
      expect(limIdx).toBeGreaterThanOrEqual(0);
      expect(authIdx).toBeLessThan(limIdx);
    },
  );

  test('authLimiter is IP-keyed, so it may legitimately precede auth', () => {
    // /api/auth/login has no auth middleware at all — authLimiter must not
    // depend on req.user.
    const stack = stackFor('post', '/api/auth/login');
    expect(stack.some((s) => s.limiter === 'authLimiter')).toBe(true);
    expect(stack.some((s) => s.name === REQUIRED_AUTH)).toBe(false);
  });

  test('GET /api/stories keys by IP deliberately, because auth there is optional', () => {
    // Pinned rather than skipped. This route is public (optionalAuth), serves
    // mostly anonymous traffic, and its limiter runs first — so userOrIpKey
    // resolves to the IP for every caller. That is a defensible choice for a
    // public endpoint, NOT the NAT-sharing regression the rule above prevents.
    // Moving searchLimiter after optionalAuth would give logged-in callers
    // per-user buckets; it is a possible improvement, out of scope here, and
    // this test exists so the change is a conscious one if anyone makes it.
    const stack = stackFor('get', '/api/stories');
    const limIdx = stack.findIndex((s) => s.limiter === 'searchLimiter');
    const optIdx = stack.findIndex((s) => s.name === OPTIONAL_AUTH);

    expect(limIdx).toBeGreaterThanOrEqual(0);
    expect(optIdx).toBeGreaterThanOrEqual(0);
    expect(stack.some((s) => s.name === REQUIRED_AUTH)).toBe(false);
    expect(limIdx).toBeLessThan(optIdx);
  });
});

describe('⏱️  Limiter keying strategy', () => {
  test('userOrIpKey keys on the user id when authenticated', () => {
    expect(userOrIpKey({ user: { _id: 'abc123' }, ip: '1.2.3.4' })).toBe('u:abc123');
  });

  test('userOrIpKey falls back to IP only when there is no user', () => {
    expect(userOrIpKey({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  test('every limiter is real express-rate-limit middleware', () => {
    for (const [fn, name] of LIMITERS) {
      expect(typeof fn).toBe('function');
      expect(fn.length).toBe(3); // (req, res, next)
      expect(typeof fn.resetKey).toBe('function'); // express-rate-limit surface
      expect(name).toBeTruthy();
    }
  });
});
