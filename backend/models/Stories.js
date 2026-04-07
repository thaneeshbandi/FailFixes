const mongoose = require('mongoose');

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
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Story must have an author']
  },
  // ✅ ADD: Author username for easier queries
  authorUsername: {
    type: String,
    trim: true,
    index: true
  },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'published' 
  },
  featured: { type: Boolean, default: false },
  trending: { type: Boolean, default: false },
  
  // ✅ LIKES ARRAY - Store user IDs who liked
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // ✅ COMMENTS ARRAY - Embedded comments
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  stats: {
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    bookmarks: { type: Number, default: 0 }
  },
  metadata: {
    failureType: {
      type: String,
      enum: ['startup', 'career', 'relationship', 'health', 'education', 'financial', 'creative', 'other']
    },
    recoveryTime: { 
      type: String, 
      maxlength: [100, 'Recovery time cannot exceed 100 characters'] 
    },
    keyLessons: [{ 
      type: String, 
      maxlength: [500, 'Key lesson cannot exceed 500 characters'] 
    }],
    currentStatus: {
      type: String,
      enum: ['recovering', 'recovered', 'thriving', 'helping_others']
    },
    readTime: { type: Number, default: 1 }
  },
  publishedAt: { type: Date, default: null },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  
  // ✅ COVER IMAGE (optional)
  coverImage: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ========== INDEXES ==========
storySchema.index({ author: 1, createdAt: -1 });
storySchema.index({ authorUsername: 1, createdAt: -1 }); // ✅ NEW
storySchema.index({ category: 1, status: 1 });
storySchema.index({ tags: 1 });
storySchema.index({ 'stats.views': -1 });
storySchema.index({ 'stats.likes': -1 });
storySchema.index({ slug: 1 });
storySchema.index({ publishedAt: -1 });
storySchema.index({ likes: 1 }); // ✅ NEW - For likes queries
storySchema.index({ 'comments.user': 1 }); // ✅ NEW - For comment queries

// Text search index
storySchema.index({
  title: 'text',
  content: 'text',
  tags: 'text',
  'metadata.keyLessons': 'text'
});

// ========== VIRTUALS ==========
// ✅ Virtual for like count
storySchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// ✅ Virtual for comment count
storySchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// ========== PRE-SAVE MIDDLEWARE ==========
storySchema.pre('save', function(next) {
  // Generate slug from title
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).substring(2, 8);
  }
  
  // Generate excerpt if not provided
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 200) + '...';
  }
  
  // Calculate read time
  if (this.content) {
    const wordsPerMinute = 200;
    const wordCount = this.content.trim().split(/\s+/).length;
    this.metadata.readTime = Math.ceil(wordCount / wordsPerMinute) || 1;
  }
  
  // Set published date
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // ✅ Sync stats with arrays
  if (this.isModified('likes')) {
    this.stats.likes = this.likes ? this.likes.length : 0;
  }
  
  if (this.isModified('comments')) {
    this.stats.comments = this.comments ? this.comments.length : 0;
  }
  
  next();
});

// ========== INSTANCE METHODS ==========
// ✅ Check if user liked the story
storySchema.methods.isLikedBy = function(userId) {
  if (!this.likes || !userId) return false;
  return this.likes.some(like => like.toString() === userId.toString());
};

// ✅ Add like
storySchema.methods.addLike = function(userId) {
  if (!this.likes) this.likes = [];
  if (!this.isLikedBy(userId)) {
    this.likes.push(userId);
    this.stats.likes = this.likes.length;
  }
};

// ✅ Remove like
storySchema.methods.removeLike = function(userId) {
  if (!this.likes) return;
  const index = this.likes.findIndex(like => like.toString() === userId.toString());
  if (index > -1) {
    this.likes.splice(index, 1);
    this.stats.likes = this.likes.length;
  }
};

// ✅ Add comment
storySchema.methods.addComment = function(userId, content) {
  if (!this.comments) this.comments = [];
  const comment = {
    user: userId,
    content: content.trim(),
    createdAt: new Date()
  };
  this.comments.push(comment);
  this.stats.comments = this.comments.length;
  return comment;
};

// ✅ Remove comment
storySchema.methods.removeComment = function(commentId) {
  if (!this.comments) return false;
  const index = this.comments.findIndex(c => c._id.toString() === commentId.toString());
  if (index > -1) {
    this.comments.splice(index, 1);
    this.stats.comments = this.comments.length;
    return true;
  }
  return false;
};

// ✅ Increment view count
storySchema.methods.incrementViews = async function() {
  this.stats.views += 1;
  await this.save();
  return this.stats.views;
};

// ========== STATIC METHODS ==========
// ✅ Find stories by author username
storySchema.statics.findByAuthorUsername = function(username) {
  return this.find({ 
    authorUsername: username,
    status: 'published'
  }).sort({ createdAt: -1 });
};

// ✅ Find trending stories
storySchema.statics.findTrending = function(limit = 10) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.find({
    status: 'published',
    createdAt: { $gte: oneWeekAgo }
  })
  .sort({ 'stats.views': -1, 'stats.likes': -1 })
  .limit(limit);
};

// ✅ Find popular stories
storySchema.statics.findPopular = function(limit = 10) {
  return this.find({ status: 'published' })
    .sort({ 'stats.likes': -1, 'stats.views': -1 })
    .limit(limit);
};

// ✅ Search stories
storySchema.statics.searchStories = function(searchTerm, options = {}) {
  const query = {
    status: 'published',
    $text: { $search: searchTerm }
  };
  
  if (options.category) {
    query.category = options.category;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20);
};

module.exports = mongoose.model('Story', storySchema);
