/**
 * Fail-fast environment validation.
 *
 * Loaded as the very first thing by app.js (and therefore by server.js and the
 * test suite). The process must refuse to start rather than fall back to a
 * known/weak signing key, because a predictable JWT secret means any attacker
 * can mint a token for any user.
 *
 * NOTE: this module never prints the value of any secret.
 */

const MIN_JWT_SECRET_LENGTH = 32;

// Placeholder values that have appeared in this repo, in its docs, or that are
// common copy-paste defaults. Compared case-insensitively against the whole value.
const FORBIDDEN_JWT_SECRETS = new Set([
  'fallback-secret-key-change-in-production',
  'your_secret',
  'your_secret_key',
  'your_jwt_secret',
  'jwt_secret',
  'secret',
  'secretkey',
  'changeme',
  'change-me',
  'password',
  'test',
  'dev',
]);

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Reject secrets that are absent, too short, placeholders, or single-character
 * padding (e.g. "aaaaaaaa..."), which pass a naive length check.
 */
function validateJwtSecret(secret) {
  if (!secret || typeof secret !== 'string' || secret.trim() === '') {
    throw new ConfigurationError(
      'JWT_SECRET is not set. Generate one with:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"\n" +
        'and set it in the environment. The server will not start without it.'
    );
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new ConfigurationError(
      `JWT_SECRET is too short (${secret.length} characters). ` +
        `At least ${MIN_JWT_SECRET_LENGTH} characters are required; a short HS256 ` +
        'secret can be brute-forced offline from any single issued token.'
    );
  }

  if (FORBIDDEN_JWT_SECRETS.has(secret.toLowerCase())) {
    throw new ConfigurationError(
      'JWT_SECRET is a well-known placeholder value. Generate a random secret instead.'
    );
  }

  if (new Set(secret).size < 8) {
    throw new ConfigurationError(
      'JWT_SECRET has too little variety to be random. Generate a random secret instead.'
    );
  }
}

function validateMongoUri(uri) {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    throw new ConfigurationError('MONGODB_URI is not set.');
  }
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new ConfigurationError('MONGODB_URI is not a valid MongoDB connection string.');
  }
}

/**
 * Validates required configuration. Throws ConfigurationError on the first problem.
 * Callers are responsible for exiting; this keeps the module testable.
 */
function validateEnv(env = process.env) {
  validateJwtSecret(env.JWT_SECRET);
  validateMongoUri(env.MONGODB_URI);

  if (env.NODE_ENV === 'production' && !env.FRONTEND_URL) {
    // Not fatal: the static allowlist in app.js still covers the known deployments.
    console.warn(
      '⚠️  FRONTEND_URL is not set in production; CORS will rely on the static allowlist only.'
    );
  }
}

/**
 * Validate and exit the process on failure. Used at startup.
 */
function validateEnvOrExit(env = process.env) {
  try {
    validateEnv(env);
  } catch (err) {
    if (err instanceof ConfigurationError) {
      console.error('\n❌ Invalid configuration — refusing to start.');
      console.error(err.message);
      console.error('');
      process.exit(1);
    }
    throw err;
  }
}

module.exports = {
  validateEnv,
  validateEnvOrExit,
  validateJwtSecret,
  ConfigurationError,
  MIN_JWT_SECRET_LENGTH,
};
