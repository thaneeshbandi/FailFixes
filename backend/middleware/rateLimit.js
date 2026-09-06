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
 */

const rateLimit = require('express-rate-limit');

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

function build({ windowMs, max, message, code, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // RateLimit-* headers
    legacyHeaders: false,
    skip: skipInTests,
    keyGenerator: keyGenerator || ((req) => `ip:${req.ip}`),
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message,
        code,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}

/**
 * Login / registration. Deliberately tight: these are the credential-guessing
 * endpoints and each login runs a cost-12 bcrypt comparison.
 */
const authLimiter = build({
  windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: num(process.env.AUTH_RATE_LIMIT_MAX, 10),
  message: 'Too many authentication attempts. Please try again later.',
  code: 'RATE_LIMITED_AUTH',
});

/**
 * LLM generation. The tightest budget in the app — this is the denial-of-wallet
 * surface. Keyed per user (the route requires auth).
 */
const aiLimiter = build({
  windowMs: num(process.env.AI_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  max: num(process.env.AI_RATE_LIMIT_MAX, 20),
  message: 'AI generation limit reached. Please try again later.',
  code: 'RATE_LIMITED_AI',
  keyGenerator: userOrIpKey,
});

/** Authenticated writes: create/update/delete story, comment, follow. */
const writeLimiter = build({
  windowMs: num(process.env.WRITE_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: num(process.env.WRITE_RATE_LIMIT_MAX, 100),
  message: 'Too many write requests. Please slow down.',
  code: 'RATE_LIMITED_WRITE',
  keyGenerator: userOrIpKey,
});

/**
 * Unauthenticated analytics pings. Generous (a browsing session fires several)
 * but bounded, so view counts can't be inflated without limit.
 */
const viewLimiter = build({
  windowMs: num(process.env.VIEW_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000),
  max: num(process.env.VIEW_RATE_LIMIT_MAX, 120),
  message: 'Too many requests.',
  code: 'RATE_LIMITED',
});

/**
 * Search / listing. Cheaper than a write but the regex path still touches every
 * story document, so it gets its own budget.
 */
const searchLimiter = build({
  windowMs: num(process.env.SEARCH_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000),
  max: num(process.env.SEARCH_RATE_LIMIT_MAX, 100),
  message: 'Too many search requests. Please slow down.',
  code: 'RATE_LIMITED_SEARCH',
  keyGenerator: userOrIpKey,
});

/**
 * Backstop for everything else. Intentionally high — it exists to blunt a crude
 * flood, not to shape normal traffic.
 */
const globalLimiter = build({
  windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: num(process.env.RATE_LIMIT_MAX_REQUESTS, 1000),
  message: 'Too many requests. Please try again later.',
  code: 'RATE_LIMITED',
});

module.exports = {
  authLimiter,
  aiLimiter,
  writeLimiter,
  viewLimiter,
  searchLimiter,
  globalLimiter,
  userOrIpKey,
};
