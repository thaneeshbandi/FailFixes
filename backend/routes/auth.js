// routes/auth.js
const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getMe,
  logout,
  changePassword,
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const {
  validateSignup,
  validateLogin,
  validatePasswordChange,
} = require('../middleware/validation');
const { authLimiter, writeLimiter } = require('../middleware/rateLimit');

// NOTE: a debug middleware previously logged `req.headers.authorization` and
// `req.body` on every auth request, writing raw bearer tokens and cleartext
// passwords into the production log stream. Auth traffic is already covered by
// the morgan access log in app.js, so nothing request-specific is logged here.

// POST /api/auth/register - Register new user (for your frontend)
router.post('/register', authLimiter, validateSignup, signup);

// POST /api/auth/signup - Alternative register route
router.post('/signup', authLimiter, validateSignup, signup);

// POST /api/auth/login - Login user
router.post('/login', authLimiter, validateLogin, login);

// GET /api/auth/me - Get current user info
router.get('/me', auth, getMe);

// POST /api/auth/logout - End the session by bumping tokenVersion.
// This is what makes the tokenVersion check in utils/token.js reachable: before
// this route existed the field was compared on every request but never changed,
// so no token could ever actually be revoked.
// writeLimiter, not authLimiter: this route runs AFTER `auth`, so
// writeLimiter's userOrIpKey resolves to the user id and the budget is
// per-account. authLimiter is IP-keyed (10/15min), which behind a shared
// NAT would let a handful of logouts lock the endpoint for everyone there.
router.post('/logout', auth, writeLimiter, logout);

// PUT /api/auth/change-password - Change password and revoke other sessions.
// authLimiter (not writeLimiter) because this endpoint verifies a credential
// with bcrypt, so it belongs in the same abuse budget as login.
router.put('/change-password', auth, authLimiter, validatePasswordChange, changePassword);

// ⛔ verify-email route removed

module.exports = router;
