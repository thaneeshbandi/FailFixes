/**
 * The single Express error handler.
 *
 * Previously there were two implementations: this file (never mounted, and it
 * logged full stack traces unconditionally) and an inline handler in app.js.
 * Individual controllers also bypassed both by returning `error: err.message`
 * directly, which leaked Mongoose schema paths, cast details and upstream
 * provider messages to clients regardless of NODE_ENV.
 *
 * Contract:
 *   - clients get a stable shape: { success, message, code?, errors? }
 *   - diagnostic detail (stack, raw message) goes to the server log only
 *   - never log credentials, tokens or connection strings
 */

const isProduction = () => process.env.NODE_ENV === 'production';
const isTest = () => process.env.NODE_ENV === 'test';

/**
 * Map known error types onto a safe client response.
 * @returns {{status:number, body:object}}
 */
function classify(error) {
  // Mongoose validation — field names and messages are authored by us, so they
  // are safe to return. The offending *value* is not included.
  if (error.name === 'ValidationError' && error.errors) {
    return {
      status: 400,
      body: {
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: Object.values(error.errors).map((e) => ({
          field: e.path,
          message: e.message,
        })),
      },
    };
  }

  if (error.name === 'CastError') {
    return {
      status: 400,
      body: { success: false, message: 'Invalid ID format', code: 'INVALID_ID' },
    };
  }

  // Duplicate key: report which field collided, not the value.
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'field';
    return {
      status: 409,
      body: { success: false, message: `${field} already exists`, code: 'DUPLICATE_KEY' },
    };
  }

  if (error.name === 'JsonWebTokenError') {
    return { status: 401, body: { success: false, message: 'Invalid token', code: 'INVALID_TOKEN' } };
  }

  if (error.name === 'TokenExpiredError') {
    return { status: 401, body: { success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' } };
  }

  if (
    error.name === 'MongoError' ||
    error.name === 'MongooseError' ||
    error.name === 'MongoServerSelectionError' ||
    error.name === 'MongoNetworkError'
  ) {
    // Never surface the driver message: it can contain the host and replica set.
    return {
      status: 503,
      body: { success: false, message: 'Service temporarily unavailable', code: 'DB_UNAVAILABLE' },
    };
  }

  if (error.type === 'entity.too.large') {
    return {
      status: 413,
      body: { success: false, message: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' },
    };
  }

  // Malformed JSON from body-parser.
  if (error.type === 'entity.parse.failed' || (error instanceof SyntaxError && 'body' in error)) {
    return {
      status: 400,
      body: { success: false, message: 'Malformed JSON body', code: 'INVALID_JSON' },
    };
  }

  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    return { status: 504, body: { success: false, message: 'Request timeout', code: 'TIMEOUT' } };
  }

  // CORS rejections raised by the cors package.
  if (/not allowed by CORS/i.test(error.message || '')) {
    return { status: 403, body: { success: false, message: 'Origin not allowed', code: 'CORS_DENIED' } };
  }

  const status = error.statusCode || error.status || 500;

  // For anything unrecognised, only trust the error's own message when it was
  // deliberately raised as a client error (4xx). A 500 gets a generic message in
  // every environment — an unexpected exception's message is not vetted output.
  if (status >= 400 && status < 500 && error.expose !== false && error.message) {
    return { status, body: { success: false, message: error.message } };
  }

  return {
    status: status >= 500 ? status : 500,
    body: {
      success: false,
      message: 'Something went wrong on our end. Please try again.',
      code: 'INTERNAL_ERROR',
    },
  };
}

// eslint-disable-next-line no-unused-vars -- Express identifies handlers by arity
const errorHandler = (error, req, res, next) => {
  const { status, body } = classify(error);

  if (!isTest()) {
    // Server-side detail. Includes the stack for 5xx, which is where it is
    // actually useful; 4xx are expected and logged as one line.
    const context = {
      method: req.method,
      url: req.originalUrl,
      status,
      name: error.name,
      // req.user is set by `protect`; the id alone is enough to correlate.
      userId: req.user && req.user._id ? req.user._id.toString() : undefined,
    };

    if (status >= 500) {
      console.error('❌ Server error', context, error.message);
      console.error(error.stack);
    } else {
      console.warn('⚠️  Client error', context, error.message);
    }
  }

  // Non-production responses carry the real message to aid local debugging, but
  // never a stack trace — stacks disclose absolute filesystem paths.
  if (!isProduction() && status >= 500) {
    body.debug = error.message;
  }

  if (res.headersSent) return next(error);
  return res.status(status).json(body);
};

module.exports = { errorHandler, classify };
module.exports.default = errorHandler;
