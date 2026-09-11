/**
 * Tiered rate limiting.
 *
 * `express-rate-limit` was already a declared dependency but was never imported,
 * so the API had no throttling at all: unlimited login attempts (no lockout, no
 * CAPTCHA), unlimited unauthenticated view-count increments, and an unmetered
 * LLM proxy.
 *
 * Limits are scoped per concern rather than one global number, because the cost
 * of a request varies by three orders of magnitude between "read a story" and
 * "call a 70B model" / "run bcrypt at cost 12".
 *
 * Client identification: app.js sets `trust proxy = 1` for Render, so `req.ip`
 * is the real client address from X-Forwarded-For. Authenticated limiters key on
 * the user id instead, so one abusive account cannot be hidden behind rotating
 * IPs, and users behind a shared NAT don't throttle each other.
 *
 * Storage: counters live in Redis when REDIS_URL is set (see
 * middleware/rateLimitStore.js), so a limit survives a restart and is shared
 * across instances. Without Redis — or while Redis is unreachable — each process
 * falls back to an in-memory store, which is weaker but never fails a request.
 * Every limiter below shares ONE store instance so they cannot diverge; the
 * per-limiter `prefix` keeps their key spaces separate.
 */

const rateLimit = require('express-rate-limit');
const { createRateLimitStore } = require('./rateLimitStore');

const num = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

/**
 * Rate limiting is off during tests by default — the existing suites make
 * hundreds of rapid login/story calls and would otherwise 429. Tests that need
 * to assert throttling set ENABLE_RATE_LIMIT_TESTS=true.
 */
function skipInTests() {
  return process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_TESTS !== 'true';
}

/** Key by authenticated user when available, else by IP. */
function userOrIpKey(req) {
  return req.user ? `u:${req.user._id}` : `ip:${req.ip}`;
}

// One shared store for every limiter in this module. `undefined` means "use
// express-rate-limit's own MemoryStore", which is what happens with no REDIS_URL.
const sharedStore = createRateLimitStore();

/**
 * Build the shared option set for a limiter.
 *
 * NOTE ON SHAPE: this returns an options *object*, and each limiter below wraps
 * it in its own `rateLimit(...)` call. It previously returned the constructed
 * middleware itself (`build()` called `rateLimit()` internally).
 *
 * The behaviour is identical either way — but static analysis is not. CodeQL's
 * `js/missing-rate-limiting` query recognises a rate limiter by tracking the
 * value returned from a call to `express-rate-limit`. With the call hidden
 * inside a factory and the result exported across a module boundary, that
 * dataflow did not reach the route files, so CodeQL reported routes that ARE
 * limited (`POST /api/chats/direct`, `PUT /api/chats/:chatId/read`,
 * `GET /api/users/search`, `PUT /api/auth/change-password`) as unprotected.
 *
 * Keeping the shared config in one function and the `rateLimit()` call at each
 * limiter keeps this DRY while making the protection visible to the analyser.
 * This is deliberately not a suppression: the limiters are real either way.
 */
function limiterOptions({ windowMs, max, message, code, keyGenerator, prefix }) {
  return {
    windowMs,
    max,
    standardHeaders: true, // RateLimit-* headers
    legacyHeaders: false,
    skip: skipInTests,
    store: sharedStore,
    // Namespaced so two limiters with the same window never share a counter for
    // the same client. Without this, `ip:1.2.3.4` in the auth limiter and in the
    // view limiter would be the same Redis key.
    keyGenerator: (req) => `${prefix}:${(keyGenerator || ((r) => `ip:${r.ip}`))(req)}`,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        code,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  };
}

/**
 * Login / registration. Deliberately tight: these are the credential-guessing
 * endpoints and each login runs a cost-12 bcrypt comparison.
 */
const authLimiter = rateLimit(
  limiterOptions({
    prefix: 'auth',
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: num(process.env.AUTH_RATE_LIMIT_MAX, 10),
    message: 'Too many authentication attempts. Please try again later.',
    code: 'RATE_LIMITED_AUTH',
  }),
);

/**
 * LLM generation. The tightest budget in the app — this is the denial-of-wallet
 * surface. Keyed per user (the route requires auth).
 */
const aiLimiter = rateLimit(
  limiterOptions({
    prefix: 'ai',
    windowMs: num(process.env.AI_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
    max: num(process.env.AI_RATE_LIMIT_MAX, 20),
    message: 'AI generation limit reached. Please try again later.',
    code: 'RATE_LIMITED_AI',
    keyGenerator: userOrIpKey,
  }),
);

/** Authenticated writes: create/update/delete story, comment, follow. */
const writeLimiter = rateLimit(
  limiterOptions({
    prefix: 'write',
    windowMs: num(process.env.WRITE_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: num(process.env.WRITE_RATE_LIMIT_MAX, 100),
    message: 'Too many write requests. Please slow down.',
    code: 'RATE_LIMITED_WRITE',
    keyGenerator: userOrIpKey,
  }),
);

/**
 * Unauthenticated analytics pings. Generous (a browsing session fires several)
 * but bounded, so view counts can't be inflated without limit.
 */
const viewLimiter = rateLimit(
  limiterOptions({
    prefix: 'view',
    windowMs: num(process.env.VIEW_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000),
    max: num(process.env.VIEW_RATE_LIMIT_MAX, 120),
    message: 'Too many requests.',
    code: 'RATE_LIMITED',
  }),
);

/**
 * Search / listing. Cheaper than a write but the regex path still touches every
 * story document, so it gets its own budget.
 */
const searchLimiter = rateLimit(
  limiterOptions({
    prefix: 'search',
    windowMs: num(process.env.SEARCH_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000),
    max: num(process.env.SEARCH_RATE_LIMIT_MAX, 100),
    message: 'Too many search requests. Please slow down.',
    code: 'RATE_LIMITED_SEARCH',
    keyGenerator: userOrIpKey,
  }),
);

/**
 * Pre-authentication gate. IP-keyed, and mounted BEFORE `auth`.
 *
 * WHY THIS EXISTS (and why it does not replace the user-aware limiters):
 * `protect` is not free — it verifies a JWT and then issues `User.findById()`.
 * A limiter placed after it bounds the controller but not that work, so a
 * caller could force one signature check and one database read per request
 * indefinitely, including on requests that are ultimately answered 429.
 *
 * It cannot be user-keyed: it runs before `req.user` exists. That is the whole
 * point — it is the only limiter that can protect authentication itself.
 *
 * BUDGET: 600 per minute per IP (10/sec sustained), deliberately generous.
 * None of the existing IP-keyed limiters was appropriate here — authLimiter is
 * a 10-per-15-minutes credential-guessing budget that ordinary browsing would
 * exhaust in seconds, viewLimiter is 0.4/sec for anonymous analytics pings, and
 * globalLimiter's 1.1/sec would throttle a shared office or carrier-grade NAT
 * where hundreds of legitimate users share one address.
 *
 * 10/sec still cuts a flood by two to three orders of magnitude, which is all
 * this needs to do: the work it protects is one indexed lookup, so the risk is
 * amplification, not per-request cost. The one-minute window also means an IP
 * that does trip it recovers in under a minute rather than fifteen. Override
 * with PREAUTH_RATE_LIMIT_MAX / PREAUTH_RATE_LIMIT_WINDOW_MS where an operator
 * sits behind unusually dense NAT.
 */
const preAuthLimiter = rateLimit(
  limiterOptions({
    prefix: 'preauth',
    windowMs: num(process.env.PREAUTH_RATE_LIMIT_WINDOW_MS, 60 * 1000),
    max: num(process.env.PREAUTH_RATE_LIMIT_MAX, 600),
    message: 'Too many requests from this network. Please try again shortly.',
    code: 'RATE_LIMITED',
  }),
);

/**
 * Backstop for everything else. Intentionally high — it exists to blunt a crude
 * flood, not to shape normal traffic.
 */
const globalLimiter = rateLimit(
  limiterOptions({
    prefix: 'global',
    windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: num(process.env.RATE_LIMIT_MAX_REQUESTS, 1000),
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  }),
);

module.exports = {
  sharedStore,
  preAuthLimiter,
  authLimiter,
  aiLimiter,
  writeLimiter,
  viewLimiter,
  searchLimiter,
  globalLimiter,
  userOrIpKey,
};
