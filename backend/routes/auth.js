// routes/auth.js
const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getMe,
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const {
  validateSignup,
  validateLogin,
} = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimit');

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

// ⛔ verify-email route removed

module.exports = router;
