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

// Add logging middleware for debugging
router.use((req, res, next) => {
  console.log(`\n🔐 AUTH ROUTE: ${req.method} ${req.originalUrl}`);
  console.log('Headers:', {
    'content-type': req.headers['content-type'],
    authorization: req.headers.authorization || 'None',
    origin: req.headers.origin,
  });
  console.log('Body:', req.body);
  console.log('Params:', req.params);
  console.log('Query:', req.query);
  next();
});

// POST /api/auth/register - Register new user (for your frontend)
router.post('/register', validateSignup, signup);

// POST /api/auth/signup - Alternative register route
router.post('/signup', validateSignup, signup);

// POST /api/auth/login - Login user
router.post('/login', validateLogin, login);

// GET /api/auth/me - Get current user info
router.get('/me', auth, getMe);

// ⛔ verify-email route removed

module.exports = router;
