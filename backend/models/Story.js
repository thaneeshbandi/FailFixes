const mongoose = require('mongoose');

// 🎯 COMMENT SCHEMA
const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Comment must have an author']
  },
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 🎯 MAIN STORY SCHEMA
const storySchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Story title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
    minlength: [10, 'Title must be at least 10 characters']
  },
  content: { 
    type: String, 
    required: [true, 'Story content is required'],
    minlength: [100, 'Story content must be at least 100 characters']
  },
  excerpt: { 
    type: String, 
    maxlength: [500, 'Excerpt cannot exceed 500 characters'] 
  },
  slug: { 
    type: String, 
    unique: true, 
    lowercase: true,
    sparse: true
  },
  category: { 
    type: String, 
    required: [true, 'Story category is required'],
    enum: {
      values: ['business', 'personal', 'education', 'health', 'relationships', 'career', 'technology', 'creative'],
      message: '{VALUE} is not a valid category'
    }
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  
  // 🎯 AUTHOR INFORMATION (Dual approach for reliability)
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Story must have an author']
  },
  authorUsername: {
    type: String,
    required: [true, 'Author username is required'],
    trim: true,
    index: true
  },
  
  // 🎯 PUBLICATION STATUS
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'published' 
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  featured: { 
    type: Boolean, 
    default: false 
  },
  
  // 🎯 ENGAGEMENT ARRAYS
  comments: [commentSchema],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // 🎯 STATISTICS
  stats: {
    views: { type: Number, default: 0, min: 0 },
    likes: { type: Number, default: 0, min: 0 },
    comments: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
    bookmarks: { type: Number, default: 0, min: 0 }
  },
  
  // 🎯 STORY METADATA
  metadata: {
    failureType: {
      type: String,
      enum: ['startup', 'career', 'relationship', 'health', 'education', 'financial', 'creative', 'other']
    },
    recoveryTime: { 
      type: String,
      enum: ['1 month', '3 months', '6 months', '1 year', '2 years', '3+ years']
    },
    currentStatus: {
      type: String,
      enum: ['recovering', 'recovered', 'thriving', 'helping_others']
    },
    keyLessons: [{ 
      type: String, 
      maxlength: [200, 'Key lesson cannot exceed 200 characters'] 
    }],
    readTime: { 
      type: Number, 
      default: 1, 
      min: 1 
    }
  },
  
  // 🎯 TIMESTAMPS
  publishedAt: { 
    type: Date, 
    default: null 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🎯 INDEXES FOR PERFORMANCE
storySchema.index({ authorUsername: 1, createdAt: -1 });
storySchema.index({ author: 1, createdAt: -1 });
storySchema.index({ category: 1, status: 1 });
storySchema.index({ status: 1, moderationStatus: 1 });
storySchema.index({ tags: 1 });
storySchema.index({ 'stats.views': -1 });
storySchema.index({ 'stats.likes': -1 });
storySchema.index({ 'stats.comments': -1 });
storySchema.index({ slug: 1 });
storySchema.index({ publishedAt: -1 });
storySchema.index({ featured: 1, 'stats.views': -1 });
storySchema.index({ likes: 1 });
storySchema.index({ bookmarks: 1 });

// 🎯 TEXT SEARCH INDEX
storySchema.index({
  title: 'text',
  content: 'text',
  tags: 'text',
  authorUsername: 'text'
});

// 🎯 VIRTUAL FIELDS
storySchema.virtual('isLikedBy').get(function() {
  return (userId) => this.likes.includes(userId);
});

storySchema.virtual('isBookmarkedBy').get(function() {
  return (userId) => this.bookmarks.includes(userId);
});

storySchema.virtual('recentComments').get(function() {
  return this.comments
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
});

storySchema.virtual('displayAuthor').get(function() {
  return this.authorUsername;
});

// 🎯 PRE-SAVE MIDDLEWARE
storySchema.pre('save', function(next) {
  // Generate unique slug from title
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .trim()
      + '-' + Math.random().toString(36).substring(2, 8);
  }
  
  // Generate excerpt if not provided
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 200).trim();
    if (this.content.length > 200) {
      this.excerpt += '...';
    }
  }
  
  // Calculate read time based on word count
  if (this.content) {
    const wordsPerMinute = 200;
    const wordCount = this.content.trim().split(/\s+/).length;
    this.metadata.readTime = Math.ceil(wordCount / wordsPerMinute) || 1;
  }
  
  // Set published date when publishing
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Update stats counts based on arrays
  if (this.isModified('likes')) {
    this.stats.likes = this.likes.length;
  }
  
  if (this.isModified('comments')) {
    this.stats.comments = this.comments.length;
  }
  
  if (this.isModified('bookmarks')) {
    this.stats.bookmarks = this.bookmarks.length;
  }
  
  next();
});

// 🎯 INSTANCE METHODS
storySchema.methods.isLikedByUser = function(userId) {
  return this.likes.some(likeId => likeId.toString() === userId.toString());
};

storySchema.methods.isBookmarkedByUser = function(userId) {
  return this.bookmarks.some(bookmarkId => bookmarkId.toString() === userId.toString());
};

storySchema.methods.toggleLike = function(userId) {
  const likeIndex = this.likes.findIndex(likeId => likeId.toString() === userId.toString());
  
  if (likeIndex === -1) {
    this.likes.push(userId);
    this.stats.likes = this.likes.length;
    return { liked: true, count: this.stats.likes };
  } else {
    this.likes.splice(likeIndex, 1);
    this.stats.likes = this.likes.length;
    return { liked: false, count: this.stats.likes };
  }
};

storySchema.methods.toggleBookmark = function(userId) {
  const bookmarkIndex = this.bookmarks.findIndex(bookmarkId => bookmarkId.toString() === userId.toString());
  
  if (bookmarkIndex === -1) {
    this.bookmarks.push(userId);
    this.stats.bookmarks = this.bookmarks.length;
    return { bookmarked: true, count: this.stats.bookmarks };
  } else {
    this.bookmarks.splice(bookmarkIndex, 1);
    this.stats.bookmarks = this.bookmarks.length;
    return { bookmarked: false, count: this.stats.bookmarks };
  }
};

storySchema.methods.addComment = function(userId, content) {
  const comment = {
    user: userId,
    content: content.trim(),
    createdAt: new Date()
  };
  
  this.comments.push(comment);
  this.stats.comments = this.comments.length;
  return comment;
};

storySchema.methods.incrementViews = function() {
  this.stats.views += 1;
  return this.save();
};

storySchema.methods.canBeEditedBy = function(userId) {
  return this.author.toString() === userId.toString();
};

// 🎯 STATIC METHODS
storySchema.statics.findByAuthorUsername = function(authorUsername, options = {}) {
  const query = { 
    authorUsername,
    status: options.status || 'published',
    moderationStatus: 'approved'
  };
  
  return this.find(query)
    .populate('author', 'name username bio avatar stats')
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 10);
};

storySchema.statics.findTrending = function(limit = 10) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return this.find({
    createdAt: { $gte: oneWeekAgo },
    status: 'published',
    moderationStatus: 'approved'
  })
  .sort({ 'stats.likes': -1, 'stats.views': -1 })
  .limit(limit)
  .populate('author', 'name username avatar');
};

storySchema.statics.findMostLiked = function(timeframe = 'all', limit = 10) {
  const query = {
    status: 'published',
    moderationStatus: 'approved'
  };
  
  if (timeframe !== 'all') {
    const timeframes = {
      'week': 7,
      'month': 30,
      'year': 365
    };
    
    const days = timeframes[timeframe] || 30;
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    query.createdAt = { $gte: dateThreshold };
  }
  
  return this.find(query)
    .sort({ 'stats.likes': -1, 'stats.views': -1 })
    .limit(limit)
    .populate('author', 'name username avatar');
};

storySchema.statics.findByCategory = function(category, sortBy = 'recent', limit = 10) {
  const query = {
    category,
    status: 'published',
    moderationStatus: 'approved'
  };
  
  let sortOptions = {};
  switch (sortBy) {
    case 'popular':
      sortOptions = { 'stats.likes': -1, 'stats.views': -1 };
      break;
    case 'views':
      sortOptions = { 'stats.views': -1 };
      break;
    case 'recent':
    default:
      sortOptions = { publishedAt: -1, createdAt: -1 };
      break;
  }
  
  return this.find(query)
    .sort(sortOptions)
    .limit(limit)
    .populate('author', 'name username avatar');
};

storySchema.statics.searchStories = function(searchTerm, options = {}) {
  const query = {
    $text: { $search: searchTerm },
    status: 'published',
    moderationStatus: 'approved'
  };
  
  if (options.category) {
    query.category = options.category;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20)
    .populate('author', 'name username avatar');
};

storySchema.statics.getFeedForUser = function(followingUsernames, options = {}) {
  return this.find({
    authorUsername: { $in: followingUsernames },
    status: 'published',
    moderationStatus: 'approved'
  })
  .populate('author', 'name username bio avatar')
  .sort({ createdAt: -1 })
  .limit(options.limit || 20)
  .skip(options.skip || 0);
};

module.exports = mongoose.model('Story', storySchema);
