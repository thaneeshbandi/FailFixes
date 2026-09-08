/**
 * Frontend/backend route contract test.
 *
 * The single largest class of defect found in this codebase was the frontend
 * calling endpoints the backend never implemented: PUT /auth/profile,
 * GET /users/search, PUT /chats/:id/read, GET /users/me/liked-stories,
 * POST /chats/:id/messages, and several more. Nothing caught them because
 * nothing compared the two sides — there is no shared schema, and the frontend
 * is not type-checked against the API.
 *
 * This test reads the real frontend API client, extracts every URL it can call,
 * and asserts each one matches a route REGISTERED on the real Express app.
 *
 * It introspects the router stack rather than issuing HTTP requests, because an
 * HTTP probe cannot tell "no such route" (404 from the catch-all) apart from
 * "route exists, resource not found" (404 from a controller) — GET /stories/:id
 * with a random ObjectId legitimately answers 404.
 *
 * It parses the client source rather than maintaining a hand-written list,
 * because a hand-written list is exactly the thing that drifts.
 */

const fs = require('fs');
const path = require('path');

const app = require('../app');

const TEST_TIMEOUT = 30000;
const API_CLIENT = path.resolve(__dirname, '../../frontend/src/services/api.js');

// Placeholder values for path params so the URL is well-formed. The status does
// not matter — only that the router matches something.
const OBJECT_ID = '507f1f77bcf86cd799439011';
const SUBSTITUTIONS = [
  [/\$\{[^}]*[Ii]d\}/g, OBJECT_ID],
  [/\$\{[^}]*[Uu]sername\}/g, 'someuser'],
  [/\$\{buildQuery\([^)]*\)\}/g, ''],
  [/\$\{[^}]+\}/g, 'x'], // anything else
];

/**
 * Extract `api.<verb>(`<url>`...)` call sites from the client source.
 * @returns {Array<{method: string, url: string}>}
 */
function extractCalls(source) {
  const calls = [];
  // Matches api.get('/x'), api.post(`/x/${y}`), across both quote styles.
  const re = /\bapi\.(get|post|put|patch|delete)\(\s*(['"`])([^'"`]+)\2/g;

  let match;
  while ((match = re.exec(source)) !== null) {
    const method = match[1];
    let url = match[3];

    for (const [pattern, replacement] of SUBSTITUTIONS) {
      url = url.replace(pattern, replacement);
    }

    // The client's baseURL already ends in /api.
    calls.push({ method, url: `/api${url}` });
  }
  return calls;
}

/**
 * Walk the Express router stack and collect every registered route as
 * { methods: Set<string>, regexp } so a concrete URL can be matched against it.
 */
function collectRoutes(expressApp) {
  const routes = [];

  const walk = (stack, prefixRegexps) => {
    for (const layer of stack) {
      if (layer.route) {
        routes.push({
          methods: new Set(Object.keys(layer.route.methods)),
          matchers: [...prefixRegexps, layer.regexp],
        });
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        walk(layer.handle.stack, [...prefixRegexps, layer.regexp]);
      }
    }
  };

  walk(expressApp._router.stack, []);
  return routes;
}

/**
 * Does `url` match a registered route for `method`?
 * Mounted routers match a prefix and hand the remainder to the child, so this
 * consumes the matched prefix at each level, exactly as Express does.
 */
function isRegistered(routes, method, url) {
  return routes.some(({ methods, matchers }) => {
    if (!methods.has(method) && !methods.has('all')) return false;

    let remaining = url;
    for (let i = 0; i < matchers.length; i += 1) {
      const m = matchers[i].exec(remaining);
      if (!m) return false;

      const isLast = i === matchers.length - 1;
      if (isLast) return true;

      remaining = remaining.slice(m[0].length) || '/';
      if (!remaining.startsWith('/')) remaining = `/${remaining}`;
    }
    return false;
  });
}

/** Strip comments so a URL mentioned in prose is not treated as a call site. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

let calls = [];
let registered = [];
let sourceWithoutComments = '';

beforeAll(() => {
  const raw = fs.readFileSync(API_CLIENT, 'utf8');
  sourceWithoutComments = stripComments(raw);
  calls = extractCalls(sourceWithoutComments);
  registered = collectRoutes(app);
}, TEST_TIMEOUT);

describe('🔗 Frontend API client ↔ backend routes', () => {
  test('the parser actually found the client calls', () => {
    // Guards against this suite silently passing because the regex stopped
    // matching after a refactor of api.js.
    expect(calls.length).toBeGreaterThan(15);
  });

  test('the router introspection found the backend routes', () => {
    expect(registered.length).toBeGreaterThan(20);
  });

  test('every endpoint the frontend calls is a registered backend route', () => {
    const missing = calls
      .filter(({ method, url }) => !isRegistered(registered, method, url))
      .map(({ method, url }) => `${method.toUpperCase()} ${url}`);

    expect(missing).toEqual([]);
  });

  test('a deliberately fake endpoint IS reported — the check can fail', () => {
    // Without this, a bug in isRegistered would make the test above pass for
    // every input and quietly protect nothing.
    expect(isRegistered(registered, 'get', '/api/definitely/not/a/route')).toBe(false);
    expect(isRegistered(registered, 'get', '/api/auth/me')).toBe(true);
    expect(isRegistered(registered, 'put', '/api/chats/507f1f77bcf86cd799439011/read')).toBe(true);
  });

  test('the frontend does not reference endpoints that were deliberately removed', () => {
    const source = sourceWithoutComments;

    // These were placeholders or never existed. If one reappears in the client,
    // it is a bug — not a feature waiting for a backend.
    const forbidden = [
      '/users/me/analytics',
      '/users/me/activity',
      '/users/me/trends',
      '/users/me/engagement',
      '/users/me/liked-stories',
      '/users/test',
      '/users/debug/',
      '/auth/profile',
    ];

    const reintroduced = forbidden.filter((f) => source.includes(`'${f}`) || source.includes(`\`${f}`));
    expect(reintroduced).toEqual([]);
  });

  test('chat message sending is not exposed over HTTP', () => {
    const source = sourceWithoutComments;
    // Messages are sent over Socket.IO only; a REST twin would be a second
    // authorization path to keep in sync.
    expect(source).not.toMatch(/api\.post\(`\/chats\/\$\{chatId\}\/messages`/);
  });
});
