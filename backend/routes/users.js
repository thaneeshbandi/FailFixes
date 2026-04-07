const express = require('express');
const router = express.Router();

const {
  followUser,
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

router.use((req, res, next) => {
  console.log(`\n👥 USER ROUTE: ${req.method} ${req.originalUrl}`);
  console.log('Route params:', req.params);
  console.log('Route query:', req.query);
  console.log('Route body:', req.body);
  next();
});

router.post('/:username/follow', auth, followUser);
router.get('/dashboard', auth, getUserDashboard);
router.get('/suggested', auth, getSuggestedUsers);
router.get('/profile/:username', optionalAuth, getUserProfileByUsername);
router.get('/me/feed', auth, getUserFeed);
router.get('/me/stats', auth, getUserStats);
router.get('/me/stories', auth, getUserStories);
router.get('/me/analytics', auth, getUserAnalytics);
router.get('/me/liked', auth, getLikedStories);
router.get('/me/activity', auth, getUserActivity);
router.get('/me/profile', auth, getUserProfile);
router.put('/me/profile', auth, updateUserProfile);
router.get('/:username/followers', optionalAuth, getUserFollowers);
router.get('/:username/following', optionalAuth, getUserFollowing);
router.get('/me/trends', auth, getViewTrends);
router.get('/me/engagement', auth, getEngagementMetrics);

module.exports = router;
