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

// 🎯 MIDDLEWARE LOGGING
router.use((req, res, next) => {
  console.log(`\n📚 STORY ROUTE: ${req.method} ${req.originalUrl}`);
  console.log('Route Path:', req.route?.path || 'matching...');
  console.log('Params:', req.params);
  console.log('Query:', req.query);
  next();
});

// ========== PUBLIC ROUTES ==========
// @route   GET /api/stories
// @desc    Get all stories with filters
// @access  Public (optionalAuth for user-specific data)
router.get('/', optionalAuth, getAllStories);

// ========== AUTHOR-SPECIFIC ROUTES (BEFORE /:id) ==========
// @route   GET /api/stories/author/:authorUsername
// @desc    Get stories by specific author
// @access  Public
router.get('/author/:authorUsername', optionalAuth, getStoriesByAuthor);

// ========== PROTECTED CREATE ROUTE ==========
// @route   POST /api/stories
// @desc    Create new story
// @access  Private
router.post('/', protect, createStory);

// ========== STORY-SPECIFIC ACTIONS (BEFORE GENERIC /:id) ==========
// @route   POST /api/stories/:id/view
// @desc    Track story view
// @access  Public
router.post('/:id/view', trackStoryView);

// @route   PATCH /api/stories/:id/like
// @desc    Like/unlike a story
// @access  Private
router.patch('/:id/like', protect, (req, res, next) => {
  console.log('✅ LIKE ROUTE MATCHED! Story ID:', req.params.id);
  next();
}, likeStory);

// @route   POST /api/stories/:id/comment
// @desc    Add comment to story
// @access  Private
router.post('/:id/comment', protect, (req, res, next) => {
  console.log('✅ COMMENT ROUTE MATCHED! Story ID:', req.params.id);
  next();
}, addComment);

// @route   GET /api/stories/:id/comments
// @desc    Get story comments with pagination
// @access  Public
router.get('/:id/comments', optionalAuth, getComments);

// ========== GENERAL STORY CRUD (MUST BE LAST) ==========
// @route   GET /api/stories/:id
// @desc    Get single story by ID
// @access  Public (optionalAuth for user-specific data)
router.get('/:id', optionalAuth, getStoryById);

// @route   PUT /api/stories/:id
// @desc    Update story
// @access  Private (Author only)
router.put('/:id', protect, updateStory);

// @route   DELETE /api/stories/:id
// @desc    Delete story
// @access  Private (Author only)
router.delete('/:id', protect, deleteStory);

// ========== 404 HANDLER ==========
router.use((req, res) => {
  console.log(`\n❌ 404: ${req.method} ${req.originalUrl} not found`);
  console.log('📋 Available Story Routes:');
  console.log('  GET    /api/stories');
  console.log('  GET    /api/stories/author/:authorUsername');
  console.log('  POST   /api/stories');
  console.log('  GET    /api/stories/:id');
  console.log('  PUT    /api/stories/:id');
  console.log('  DELETE /api/stories/:id');
  console.log('  POST   /api/stories/:id/view');
  console.log('  PATCH  /api/stories/:id/like ⚠️');
  console.log('  POST   /api/stories/:id/comment');
  console.log('  GET    /api/stories/:id/comments');
  
  res.status(404).json({
    success: false,
    message: `Story route not found: ${req.method} ${req.originalUrl}`,
    hint: 'Check if the route path and HTTP method are correct'
  });
});

console.log('✅ Stories routes loaded successfully');

module.exports = router;
