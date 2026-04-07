const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email',
      ],
    },
    
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          if (v == null || v === '') return true;
          return /^[a-zA-Z0-9_]+$/.test(v) && v.length >= 3 && v.length <= 20;
        },
        message: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
      }
    },
    
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },
    
    location: {
      type: String,
      maxlength: [100, 'Location cannot exceed 100 characters'],
      default: '',
    },
    
    website: {
      type: String,
      maxlength: [200, 'Website URL cannot exceed 200 characters'],
      default: '',
    },
    
    avatar: {
      type: String,
      default: '',
    },
    
    isActive: {
      type: Boolean,
      default: true,
    },
    
    isVerified: {
      type: Boolean,
      default: false,
    },
    
    emailVerificationToken: {
      type: String,
      default: null,
    },
    
    emailVerificationExpires: {
      type: Date,
      default: null,
    },
    
    allowAnonymous: {
      type: Boolean,
      default: false,
    },
    
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
    },
    
    stats: {
      storiesCount: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      totalLikes: { type: Number, default: 0 },
      totalComments: { type: Number, default: 0 },
      followersCount: { type: Number, default: 0 },
      followingCount: { type: Number, default: 0 },
      profileViews: { type: Number, default: 0 },
    },
    
    followers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    
    following: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    
    // ✅ NEW: Track liked stories for content-based recommendations
    likedStories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story',
    }],
    
    // ✅ NEW: User preferences for better recommendations
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      profileVisibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public',
      },
      showEmail: { type: Boolean, default: false },
      favoriteCategories: [String], // Track favorite story categories
      favoriteTags: [String], // Track favorite tags
    },
    
    lastLogin: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ========== VIRTUALS ==========
userSchema.virtual('displayUsername').get(function () {
  return this.username || this.name || `user_${this._id.toString().slice(-6)}`;
});

userSchema.virtual('fullDisplayName').get(function () {
  return this.name + (this.username ? ` (@${this.username})` : '');
});

userSchema.virtual('isFollowable').get(function () {
  return this.preferences.profileVisibility === 'public';
});

// ========== INDEXES ==========
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ name: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'stats.followersCount': -1 });
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });
userSchema.index({ likedStories: 1 }); // ✅ NEW
userSchema.index({ 'preferences.favoriteCategories': 1 }); // ✅ NEW

// ========== PRE-SAVE MIDDLEWARE ==========
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(12);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
      return next(err);
    }
  }

  if (this.isModified('followers')) {
    this.stats.followersCount = this.followers.length;
  }
  if (this.isModified('following')) {
    this.stats.followingCount = this.following.length;
  }

  next();
});

// ========== INSTANCE METHODS ==========
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function () {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign(
    {
      id: this._id,
      username: this.username || this.name,
      role: this.role,
      displayUsername: this.displayUsername,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

userSchema.methods.isFollowing = function (userId) {
  return this.following.some(
    (followId) => followId.toString() === userId.toString()
  );
};

userSchema.methods.hasFollower = function (userId) {
  return this.followers.some(
    (followId) => followId.toString() === userId.toString()
  );
};

userSchema.methods.follow = function (userId) {
  if (!this.isFollowing(userId)) {
    this.following.push(userId);
    this.stats.followingCount = this.following.length;
  }
};

userSchema.methods.unfollow = function (userId) {
  const index = this.following.findIndex(
    (followId) => followId.toString() === userId.toString()
  );
  if (index > -1) {
    this.following.splice(index, 1);
    this.stats.followingCount = this.following.length;
  }
};

userSchema.methods.addFollower = function (userId) {
  if (!this.hasFollower(userId)) {
    this.followers.push(userId);
    this.stats.followersCount = this.followers.length;
  }
};

userSchema.methods.removeFollower = function (userId) {
  const index = this.followers.findIndex(
    (followId) => followId.toString() === userId.toString()
  );
  if (index > -1) {
    this.followers.splice(index, 1);
    this.stats.followersCount = this.followers.length;
  }
};

// ✅ NEW: Update preferences from liked story
userSchema.methods.updatePreferencesFromLike = async function(story) {
  if (!this.preferences) {
    this.preferences = { favoriteCategories: [], favoriteTags: [] };
  }
  
  // Add story to liked stories
  if (!this.likedStories) {
    this.likedStories = [];
  }
  if (!this.likedStories.includes(story._id)) {
    this.likedStories.push(story._id);
  }
  
  // Track favorite categories
  if (story.category && !this.preferences.favoriteCategories.includes(story.category)) {
    if (!this.preferences.favoriteCategories) {
      this.preferences.favoriteCategories = [];
    }
    this.preferences.favoriteCategories.push(story.category);
  }
  
  // Track favorite tags
  if (story.tags && Array.isArray(story.tags)) {
    if (!this.preferences.favoriteTags) {
      this.preferences.favoriteTags = [];
    }
    story.tags.forEach(tag => {
      if (!this.preferences.favoriteTags.includes(tag)) {
        this.preferences.favoriteTags.push(tag);
      }
    });
  }
  
  await this.save();
};

// ========== STATIC METHODS ==========
userSchema.statics.findByUsername = function (username) {
  return this.findOne({
    $or: [{ username: username.toLowerCase() }, { name: username }],
  });
};

// ✅ ENHANCED: Graph-based user suggestions
userSchema.statics.findSuggestedUsers = async function (currentUserId, limit = 10) {
  const Story = mongoose.model('Story');
  
  try {
    // Get current user with their network
    const currentUser = await this.findById(currentUserId)
      .select('following likedStories preferences')
      .lean();
    
    if (!currentUser) {
      return [];
    }
    
    const followingIds = currentUser.following || [];
    const suggestions = new Map();
    
    // === STRATEGY 1: Friends of Friends (Social Graph) ===
    const friendsOfFriends = await this.aggregate([
      { $match: { _id: currentUserId } },
      {
        $graphLookup: {
          from: 'users',
          startWith: '$following',
          connectFromField: 'following',
          connectToField: '_id',
          as: 'friendsOfFriends',
          maxDepth: 1,
          depthField: 'depth'
        }
      },
      { $unwind: '$friendsOfFriends' },
      {
        $match: {
          'friendsOfFriends._id': { 
            $ne: currentUserId,
            $nin: followingIds 
          }
        }
      },
      {
        $project: {
          userId: '$friendsOfFriends._id',
          username: '$friendsOfFriends.username',
          name: '$friendsOfFriends.name',
          avatar: '$friendsOfFriends.avatar',
          bio: '$friendsOfFriends.bio',
          stats: '$friendsOfFriends.stats',
          score: 5,
          reason: 'friends_of_friends'
        }
      },
      { $limit: 20 }
    ]);
    
    friendsOfFriends.forEach(user => {
      if (!suggestions.has(user.userId.toString())) {
        suggestions.set(user.userId.toString(), {
          ...user,
          reasons: [user.reason]
        });
      } else {
        const existing = suggestions.get(user.userId.toString());
        existing.score += user.score;
        existing.reasons.push(user.reason);
      }
    });
    
    // === STRATEGY 2: Similar Interests (Content-Based) ===
    if (currentUser.likedStories && currentUser.likedStories.length > 0) {
      const likedStories = await Story.find({
        _id: { $in: currentUser.likedStories }
      }).select('category tags likes').lean();
      
      const likedCategories = [...new Set(likedStories.map(s => s.category))];
      const likedTags = [...new Set(likedStories.flatMap(s => s.tags || []))];
      
      // Find users who liked similar categories
      const similarUsers = await Story.aggregate([
        {
          $match: {
            $or: [
              { category: { $in: likedCategories } },
              { tags: { $in: likedTags } }
            ]
          }
        },
        { $unwind: '$likes' },
        {
          $match: {
            likes: { 
              $ne: currentUserId,
              $nin: followingIds 
            }
          }
        },
        {
          $group: {
            _id: '$likes',
            matchCount: { $sum: 1 }
          }
        },
        { $sort: { matchCount: -1 } },
        { $limit: 20 }
      ]);
      
      for (const match of similarUsers) {
        const user = await this.findById(match._id)
          .select('username name avatar bio stats')
          .lean();
        
        if (user) {
          const userId = user._id.toString();
          if (!suggestions.has(userId)) {
            suggestions.set(userId, {
              userId: user._id,
              username: user.username,
              name: user.name,
              avatar: user.avatar,
              bio: user.bio,
              stats: user.stats,
              score: match.matchCount * 3,
              reasons: ['similar_interests']
            });
          } else {
            const existing = suggestions.get(userId);
            existing.score += match.matchCount * 3;
            existing.reasons.push('similar_interests');
          }
        }
      }
    }
    
    // === STRATEGY 3: Trending Users ===
    const trendingUsers = await this.find({
      _id: { 
        $ne: currentUserId,
        $nin: followingIds 
      },
      isActive: true,
      'preferences.profileVisibility': 'public'
    })
    .sort({ 'stats.followersCount': -1, createdAt: -1 })
    .limit(10)
    .select('username name avatar bio stats')
    .lean();
    
    trendingUsers.forEach(user => {
      const userId = user._id.toString();
      if (!suggestions.has(userId)) {
        suggestions.set(userId, {
          userId: user._id,
          username: user.username,
          name: user.name,
          avatar: user.avatar,
          bio: user.bio,
          stats: user.stats,
          score: 2,
          reasons: ['trending']
        });
      } else {
        const existing = suggestions.get(userId);
        existing.score += 2;
        existing.reasons.push('trending');
      }
    });
    
    // Convert to array and sort by score
    const rankedSuggestions = Array.from(suggestions.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(user => ({
        ...user,
        displayUsername: user.username || user.name || `user_${user.userId.toString().slice(-6)}`,
        followersCount: user.stats?.followersCount || 0,
        followingCount: user.stats?.followingCount || 0,
        isFollowing: false,
        canFollow: true
      }));
    
    return rankedSuggestions;
    
  } catch (error) {
    console.error('❌ Error finding suggested users:', error);
    // Fallback to basic suggestions
    return this.find({
      _id: { $ne: currentUserId },
      isActive: true,
      'preferences.profileVisibility': 'public',
    })
      .sort({ 'stats.followersCount': -1, createdAt: -1 })
      .limit(limit)
      .select('name username bio avatar stats')
      .lean();
  }
};

module.exports = mongoose.model('User', userSchema);
