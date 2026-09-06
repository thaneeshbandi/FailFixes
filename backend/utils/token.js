/**
 * Single source of truth for JWT signing and verification.
 *
 * Previously three call sites (models/User.js, middleware/auth.js, server.js)
 * each called jsonwebtoken directly with slightly different options, so the
 * signing and verification contracts could drift. Centralising them means the
 * algorithm pin, issuer/audience and expiry are enforced identically for HTTP
 * requests and Socket.IO handshakes.
 */

const jwt = require('jsonwebtoken');

// HS256 is what this application has always used. Pinning it explicitly stops a
// token from being accepted under any other algorithm.
const ALGORITHM = 'HS256';
const ISSUER = 'failfixes';
const AUDIENCE = 'failfixes-api';

// Shortened from the previous 7d. See SECURITY notes: `protect` performs a DB
// lookup on every request, so revocation (isActive / tokenVersion) is immediate;
// the lifetime only bounds the window for a stolen token whose owner never
// triggers a revocation. Override with JWT_EXPIRE if a longer session is wanted.
const DEFAULT_EXPIRY = '2d';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // config/env.js validates this at startup; this guard covers hot-reload and
    // any code path that bypasses startup validation.
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

/**
 * @param {object} user a User document
 * @returns {string} signed JWT
 */
function signAuthToken(user) {
  return jwt.sign(
    {
      id: user._id,
      username: user.username || user.name,
      role: user.role,
      displayUsername: user.displayUsername,
      // Bumping User.tokenVersion invalidates every token issued before the bump.
      tv: user.tokenVersion || 0,
    },
    getSecret(),
    {
      algorithm: ALGORITHM,
      expiresIn: process.env.JWT_EXPIRE || DEFAULT_EXPIRY,
      issuer: ISSUER,
      audience: AUDIENCE,
    }
  );
}

/**
 * Verify a token's signature and registered claims.
 * Throws the underlying jsonwebtoken error (JsonWebTokenError / TokenExpiredError).
 */
function verifyAuthToken(token) {
  return jwt.verify(token, getSecret(), {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

/**
 * Extract a bearer token from an Authorization header value.
 * Returns null when there is nothing usable, so callers don't have to repeat
 * the 'null'/'undefined' string checks the frontend can produce.
 */
function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

/**
 * Shared account-state gate for HTTP and Socket.IO.
 * @returns {{ok: true} | {ok: false, code: string, message: string, status: number}}
 */
function checkAccountState(user, decoded) {
  if (!user) {
    return {
      ok: false,
      status: 401,
      code: 'USER_NOT_FOUND',
      message: 'User account not found. Please login again.',
    };
  }
  if (user.isActive === false) {
    return {
      ok: false,
      status: 403,
      code: 'ACCOUNT_DEACTIVATED',
      message: 'Account is deactivated.',
    };
  }
  // Tokens issued before the current tokenVersion have been revoked.
  if ((decoded.tv || 0) !== (user.tokenVersion || 0)) {
    return {
      ok: false,
      status: 401,
      code: 'TOKEN_REVOKED',
      message: 'Session has been revoked. Please login again.',
    };
  }
  return { ok: true };
}

module.exports = {
  signAuthToken,
  verifyAuthToken,
  extractBearerToken,
  checkAccountState,
  ALGORITHM,
  ISSUER,
  AUDIENCE,
  DEFAULT_EXPIRY,
};
