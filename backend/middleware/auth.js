const User = require('../models/User');
const {
  verifyAuthToken,
  extractBearerToken,
  checkAccountState,
} = require('../utils/token');

// NOTE ON LOGGING: this middleware previously logged the token length, whether
// JWT_SECRET was configured, the decoded user id and the authenticated user's
// name/username on *every* request. That is both noisy and a slow leak of
// session and identity data into the log stream. Only genuine failures are
// logged now, and never the token itself.

// ✅ MAIN AUTH MIDDLEWARE (REQUIRED)
const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.header('Authorization'));

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login.',
        code: 'NO_TOKEN',
      });
    }

    let decoded;
    try {
      decoded = verifyAuthToken(token);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.',
          code: 'TOKEN_EXPIRED',
        });
      }

      if (jwtError.name === 'JsonWebTokenError' || jwtError.name === 'NotBeforeError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please login again.',
          code: 'INVALID_TOKEN',
        });
      }

      throw jwtError;
    }

    const user = await User.findById(decoded.id).select('-password');

    // Covers: deleted account, deactivated account, and revoked sessions
    // (tokenVersion bump). Because this runs on every request, revocation and
    // deactivation take effect immediately rather than at token expiry.
    const state = checkAccountState(user, decoded);
    if (!state.ok) {
      return res.status(state.status).json({
        success: false,
        message: state.message,
        code: state.code,
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
      code: 'AUTH_ERROR',
    });
  }
};

// ✅ OPTIONAL AUTH MIDDLEWARE (doesn't fail if no token)
// Used by public endpoints that enrich their response when a caller happens to
// be logged in (isLiked / isFollowing). A bad token is simply ignored.
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.header('Authorization'));
    if (!token) return next();

    const decoded = verifyAuthToken(token);
    const user = await User.findById(decoded.id).select('-password');

    // Same account-state rules as `protect`: a deactivated or revoked session
    // must not receive personalised data either.
    if (checkAccountState(user, decoded).ok) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Don't fail, just proceed without user.
    next();
  }
};

// ✅ Export both names for compatibility
module.exports = {
  auth: protect,
  protect,
  optionalAuth,
};
