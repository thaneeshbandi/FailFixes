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
  getUserAnalytics,
  getLikedStories,
  getUserActivity,
  getUserProfile,
  updateUserProfile,
  getUserFollowers,
  getUserFollowing,
  getViewTrends,
  getEngagementMetrics
} = require('../controllers/userController');

const { auth, optionalAuth } = require('../middleware/auth');
const { writeLimiter, searchLimiter } = require('../middleware/rateLimit');
const {
  validateProfileUpdate,
  validateUsernameParam,
  validateUserIdParam,
  validatePagination,
} = require('../middleware/validation');

// Per-request debug logging removed: it echoed req.body/req.query on every
// call (noise in production, and a leak vector for anything sensitive a
// future endpoint accepts). morgan in app.js covers access logging.

// NOTE: the '/me/*' and '/dashboard' routes are declared before the
// '/:username/*' patterns below so a user literally named "me" cannot shadow
// them. Express matches in declaration order.

router.post('/:username/follow', auth, writeLimiter, validateUsernameParam, followUser);
router.get('/dashboard', auth, getUserDashboard);
router.get('/suggested', auth, searchLimiter, getSuggestedUsers);
router.post('/profile/:userId/view', auth, writeLimiter, validateUserIdParam, trackProfileView);
router.get('/profile/:username', validateUsernameParam, optionalAuth, getUserProfileByUsername);
router.get('/me/feed', auth, validatePagination, getUserFeed);
router.get('/me/stats', auth, getUserStats);
router.get('/me/stories', auth, validatePagination, getUserStories);
router.get('/me/analytics', auth, getUserAnalytics);
router.get('/me/liked', auth, getLikedStories);
router.get('/me/activity', auth, getUserActivity);
router.get('/me/profile', auth, getUserProfile);
// Field allowlist is enforced in the controller (utils/allowedUpdates.js);
// validateProfileUpdate additionally type/length-checks the allowed fields.
router.put('/me/profile', auth, writeLimiter, validateProfileUpdate, updateUserProfile);
router.get('/:username/followers', validateUsernameParam, validatePagination, optionalAuth, getUserFollowers);
router.get('/:username/following', validateUsernameParam, validatePagination, optionalAuth, getUserFollowing);
router.get('/me/trends', auth, getViewTrends);
router.get('/me/engagement', auth, getEngagementMetrics);

module.exports = router;
