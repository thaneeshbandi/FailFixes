/**
 * Single allowlist of browser origins, shared by the Express CORS middleware
 * and the Socket.IO server.
 *
 * Two problems this fixes:
 *
 * 1. The two lists had drifted. `https://fail-fixes.vercel.app` was allowed for
 *    the REST API but missing from the Socket.IO list, so real-time chat could
 *    only work from the Vercel deployment if FRONTEND_URL happened to be set.
 *
 * 2. The Express origin callback ended in
 *      callback(null, process.env.NODE_ENV !== "production")
 *    i.e. it *allowed* any unknown origin unless NODE_ENV was exactly
 *    "production". A missing or misspelled NODE_ENV on the host silently turned
 *    the allowlist off while `credentials: true` stayed on. It now fails closed.
 */

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
];

const PROD_ORIGINS = [
  'https://failfixes-frontend.onrender.com',
  'https://failfixes.onrender.com',
  'https://fail-fixes.vercel.app',
];

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Extra origins from the environment, comma-separated.
 * Supports both FRONTEND_URL (already used by this app) and CORS_ORIGIN
 * (referenced by config/config.js).
 */
function envOrigins() {
  return [process.env.FRONTEND_URL, ...(process.env.CORS_ORIGIN || '').split(',')]
    .map((o) => (o || '').trim())
    .filter(Boolean);
}

/**
 * @returns {string[]} the effective allowlist for the current environment.
 * Localhost origins are only allowed outside production.
 */
function getAllowedOrigins() {
  return [
    ...PROD_ORIGINS,
    ...(isProduction() ? [] : DEV_ORIGINS),
    ...envOrigins(),
  ].filter((v, i, a) => a.indexOf(v) === i);
}

/**
 * Origin callback for the `cors` package.
 *
 * A request with no Origin header (curl, server-to-server, same-origin
 * navigation, health checks) is allowed: CORS is a browser control and such
 * requests are not subject to it. Unknown browser origins are refused in every
 * environment — `callback(null, false)` omits the CORS headers rather than
 * throwing, so the request still reaches the route and the browser is the one
 * that blocks reading the response.
 */
function corsOriginCallback(origin, callback) {
  if (!origin) return callback(null, true);

  if (getAllowedOrigins().includes(origin)) {
    return callback(null, true);
  }

  if (!isProduction()) {
    console.warn('⚠️  CORS: refused origin', origin);
  }
  return callback(null, false);
}

const corsOptions = {
  origin: corsOriginCallback,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-Response-Time', 'X-Cache-Status'],
  optionsSuccessStatus: 204,
};

module.exports = {
  getAllowedOrigins,
  corsOriginCallback,
  corsOptions,
  DEV_ORIGINS,
  PROD_ORIGINS,
};
