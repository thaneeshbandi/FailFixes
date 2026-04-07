/* eslint-disable newline-per-chained-call */
const { body, param, query, validationResult } = require('express-validator');

// ========== ERROR HANDLER ==========
exports.handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({
        field: e.path,
        message: e.msg,
        value: e.value
      }))
    });
  }
  next();
};

// ========== AUTH VALIDATION ==========
exports.validateSignup = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  
  body('username')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('password')
    .trim()
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  exports.handleValidation
];

exports.validateLogin = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email or username is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  exports.handleValidation
];

// ========== STORY VALIDATION ==========
exports.validateStory = [
  body('title')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Title must be between 10 and 200 characters'),

  body('content')
    .trim()
    .isLength({ min: 100 })
    .withMessage('Story content must be at least 100 characters'),

  body('category')
    .isIn([
      'business', 'personal', 'education', 'health',
      'relationships', 'career', 'technology', 'creative'
    ])
    .withMessage('Please select a valid category'),

  body('tags')
    .optional({ nullable: true })
    .isArray({ max: 5 })
    .withMessage('Maximum 5 tags allowed')
    .custom(tags => {
      if (!tags) return true;
      for (const t of tags) {
        if (typeof t !== 'string' || t.length > 30) {
          throw new Error('Each tag must be a string ≤ 30 characters');
        }
      }
      return true;
    }),

  body('status')
    .optional({ checkFalsy: true })
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),

  body('metadata')
    .optional({ checkFalsy: true })
    .isObject()
    .withMessage('Metadata must be an object'),

  body('metadata.failureType')
    .optional({ checkFalsy: true })
    .isIn(['startup', 'career', 'relationship', 'health', 'education',
           'financial', 'creative', 'other'])
    .withMessage('Invalid failure type'),

  body('metadata.recoveryTime')
    .optional({ checkFalsy: true })
    .isLength({ max: 100 })
    .withMessage('Recovery time cannot exceed 100 characters'),

  body('metadata.keyLessons')
    .optional({ checkFalsy: true })
    .isArray({ max: 10 })
    .withMessage('Maximum 10 key lessons allowed'),

  body('metadata.currentStatus')
    .optional({ checkFalsy: true })
    .isIn(['recovering', 'recovered', 'thriving', 'helping_others'])
    .withMessage('Invalid current status'),

  exports.handleValidation
];

exports.validateStoryUpdate = [
  body('title')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Title must be between 10 and 200 characters'),

  body('content')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 100 })
    .withMessage('Story content must be at least 100 characters'),

  body('category')
    .optional({ checkFalsy: true })
    .isIn([
      'business', 'personal', 'education', 'health',
      'relationships', 'career', 'technology', 'creative'
    ])
    .withMessage('Please select a valid category'),

  body('tags')
    .optional({ checkFalsy: true })
    .isArray({ max: 5 })
    .withMessage('Maximum 5 tags allowed'),

  body('status')
    .optional({ checkFalsy: true })
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Status must be draft, published, or archived'),

  exports.handleValidation
];

// ========== COMMON VALIDATION ==========
exports.validateObjectId = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  exports.handleValidation
];

exports.validateStoriesQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  
  query('category')
    .optional()
    .isIn([
      'all', 'business', 'personal', 'education', 'health',
      'relationships', 'career', 'technology', 'creative'
    ])
    .withMessage('Invalid category filter'),
  
  query('sortBy')
    .optional()
    .isIn(['recent', 'popular', 'views', 'trending'])
    .withMessage('Invalid sort option'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  
  exports.handleValidation
];

// ========== USER VALIDATION ==========
exports.validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  
  body('location')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),
  
  body('website')
    .optional()
    .isURL()
    .isLength({ max: 200 })
    .withMessage('Website must be a valid URL and cannot exceed 200 characters'),
  
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object'),
  
  body('preferences.emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications preference must be boolean'),
  
  body('preferences.profileVisibility')
    .optional()
    .isIn(['public', 'private'])
    .withMessage('Profile visibility must be public or private'),
  
  exports.handleValidation
];

exports.validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
  
  exports.handleValidation
];

exports.validatePasswordReset = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  
  exports.handleValidation
];

// ========== COMMENT VALIDATION ==========
exports.validateComment = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters'),
  
  body('storyId')
    .isMongoId()
    .withMessage('Invalid story ID'),
  
  exports.handleValidation
];

// ========== SEARCH VALIDATION ==========
exports.validateSearch = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('type')
    .optional()
    .isIn(['stories', 'users', 'all'])
    .withMessage('Search type must be stories, users, or all'),
  
  exports.handleValidation
];
