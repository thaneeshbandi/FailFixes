const express = require('express');
const router = express.Router();

const {
  getAllStories,
  getStoryById,
  createStory,
  updateStory,
  deleteStory,
  likeStory,
  addComment,
  getComments,
  getStoriesByAuthor,
  trackStoryView
} = require('../controllers/storyController');

const { protect, optionalAuth } = require('../middleware/auth');
const { writeLimiter, viewLimiter, searchLimiter } = require('../middleware/rateLimit');
const {
  validateObjectId,
  validateStoriesQuery,
  validateStoryUpdate,
  validateAuthorUsernameParam,
  validatePagination,
} = require('../middleware/validation');

// Per-request debug logging removed: it echoed req.body/req.query on every
// call (noise in production, and a leak vector for anything sensitive a
// future endpoint accepts). morgan in app.js covers access logging.

// ========== PUBLIC ROUTES ==========
// @route   GET /api/stories
// @desc    Get all stories with filters
// @access  Public (optionalAuth for user-specific data)
// searchLimiter: the search path runs a regex across every story's content.
router.get('/', searchLimiter, validateStoriesQuery, optionalAuth, getAllStories);

// ========== AUTHOR-SPECIFIC ROUTES (BEFORE /:id) ==========
// @route   GET /api/stories/author/:authorUsername
// @desc    Get stories by specific author
// @access  Public
router.get(
  '/author/:authorUsername',
  validateAuthorUsernameParam,
  validatePagination,
  optionalAuth,
  getStoriesByAuthor
);

// ========== PROTECTED CREATE ROUTE ==========
// @route   POST /api/stories
// @desc    Create new story
// @access  Private
router.post('/', protect, writeLimiter, createStory);

// ========== STORY-SPECIFIC ACTIONS (BEFORE GENERIC /:id) ==========
// @route   POST /api/stories/:id/view
// @desc    Track story view
// @access  Public (rate limited — this is an unauthenticated counter increment)
router.post('/:id/view', viewLimiter, validateObjectId, trackStoryView);

// @route   PATCH /api/stories/:id/like
// @desc    Like/unlike a story
// @access  Private
router.patch('/:id/like', protect, writeLimiter, validateObjectId, likeStory);

// @route   POST /api/stories/:id/comment
// @desc    Add comment to story
// @access  Private
router.post('/:id/comment', protect, writeLimiter, validateObjectId, addComment);

// @route   GET /api/stories/:id/comments
// @desc    Get story comments with pagination
// @access  Public
router.get('/:id/comments', validateObjectId, validatePagination, optionalAuth, getComments);

// ========== GENERAL STORY CRUD (MUST BE LAST) ==========
// @route   GET /api/stories/:id
// @desc    Get single story by ID
// @access  Public (optionalAuth for user-specific data)
router.get('/:id', validateObjectId, optionalAuth, getStoryById);

// @route   PUT /api/stories/:id
// @desc    Update story
// @access  Private (Author only — field allowlist enforced in the controller)
router.put('/:id', protect, writeLimiter, validateObjectId, validateStoryUpdate, updateStory);

// @route   DELETE /api/stories/:id
// @desc    Delete story
// @access  Private (Author only)
router.delete('/:id', protect, writeLimiter, validateObjectId, deleteStory);

// ========== 404 HANDLER ==========
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Story route not found: ${req.method} ${req.originalUrl}`,
    hint: 'Check if the route path and HTTP method are correct'
  });
});

module.exports = router;
