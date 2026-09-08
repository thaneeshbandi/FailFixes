const express = require('express');
const router = express.Router();

const {
  followUser,
  trackProfileView,
  getUserDashboard,
  getSuggestedUsers,
  getUserProfileByUsername,
  getUserFeed,
  getUserStats,
  getUserStories,
  getLikedStories,
  getUserProfile,
  updateUserProfile,
  getUserFollowers,
  getUserFollowing,
  searchUsers,
} = require('../controllers/userController');

const { auth, optionalAuth } = require('../middleware/auth');
const { writeLimiter, searchLimiter } = require('../middleware/rateLimit');
const {
  validateProfileUpdate,
  validateUsernameParam,
  validateUserIdParam,
  validatePagination,
  validateSearch,
} = require('../middleware/validation');

// Per-request debug logging removed: it echoed req.body/req.query on every
// call (noise in production, and a leak vector for anything sensitive a
// future endpoint accepts). morgan in app.js covers access logging.

// NOTE: the '/me/*', '/dashboard', '/suggested' and '/search' routes are
// declared before the '/:username/*' patterns below so a user literally named
// "me" or "search" cannot shadow them. Express matches in declaration order.

router.post('/:username/follow', auth, writeLimiter, validateUsernameParam, followUser);
router.get('/dashboard', auth, getUserDashboard);
router.get('/suggested', auth, searchLimiter, getSuggestedUsers);

// GET /api/users/search?q=... — the controller existed but was never mounted,
// so the "start a chat with…" people-picker in the UI always received a 404.
router.get('/search', auth, searchLimiter, validateSearch, searchUsers);

router.post('/profile/:userId/view', auth, writeLimiter, validateUserIdParam, trackProfileView);
router.get('/profile/:username', validateUsernameParam, optionalAuth, getUserProfileByUsername);
router.get('/me/feed', auth, validatePagination, getUserFeed);
router.get('/me/stats', auth, getUserStats);
router.get('/me/stories', auth, validatePagination, getUserStories);
router.get('/me/liked', auth, validatePagination, getLikedStories);
router.get('/me/profile', auth, getUserProfile);
// Field allowlist is enforced in the controller (utils/allowedUpdates.js);
// validateProfileUpdate additionally type/length-checks the allowed fields.
router.put('/me/profile', auth, writeLimiter, validateProfileUpdate, updateUserProfile);
router.get('/:username/followers', validateUsernameParam, validatePagination, optionalAuth, getUserFollowers);
router.get('/:username/following', validateUsernameParam, validatePagination, optionalAuth, getUserFollowing);

// REMOVED: /me/analytics, /me/activity, /me/trends, /me/engagement.
// All four returned hardcoded empty objects — there is no analytics data model
// behind them. Shipping an endpoint that always answers `{ trends: [] }` is
// worse than not shipping it: it looks implemented to a caller and to a reader.

module.exports = router;
