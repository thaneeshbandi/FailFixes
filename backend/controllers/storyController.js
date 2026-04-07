const Story = require('../models/Story');
const User = require('../models/User');
const mongoose = require('mongoose');

const userViewCounts = new Map();

// ✅ GET ALL STORIES
exports.getAllStories = async (req, res) => {
  try {
    const {
      category,
      search,
      sortBy = 'recent',
      page = 1,
      limit = 9,
      authorUsername
    } = req.query;

    const query = { status: 'published' };

    if (category && category !== 'all') query.category = category;
    if (authorUsername) query.authorUsername = authorUsername;

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { content: { $regex: search.trim(), $options: 'i' } },
        { authorUsername: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    let sortOptions = {};
    switch (sortBy) {
      case 'popular':
        sortOptions = { 'stats.likes': -1, 'stats.views': -1 };
        break;
      case 'views':
        sortOptions = { 'stats.views': -1 };
        break;
      case 'trending':
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        query.createdAt = { $gte: oneWeekAgo };
        sortOptions = { 'stats.views': -1, 'stats.likes': -1 };
        break;
      case 'recent':
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 9));

    const [stories, total] = await Promise.all([
      Story.find(query)
           .populate('author', 'name username bio location stats avatar')
           .sort(sortOptions)
           .limit(limitNum)
           .skip((pageNum - 1) * limitNum)
           .lean(),
      Story.countDocuments(query)
    ]);

    // Get current user's following list if authenticated
    let followingUsernames = [];
    if (req.user) {
      const currentUser = await User.findById(req.user._id)
        .populate('following', 'username name')
        .lean();
      
      if (currentUser && currentUser.following) {
        followingUsernames = currentUser.following
          .map(user => user.username || user.name)
          .filter(Boolean);
      }
    }

    // Add follow status to stories
    const storiesWithMeta = stories.map(s => {
      const storyAuthorUsername = s.authorUsername || s.author?.username || s.author?.name;
      
      // Check if current user is following this story's author
      const isFollowing = req.user ? followingUsernames.some(
        followedUsername => followedUsername.toLowerCase() === storyAuthorUsername?.toLowerCase()
      ) : false;

      return {
        ...s,
        readTime: s.metadata?.readTime || Math.ceil((s.content || '').split(' ').length / 200) || 1,
        isLiked: req.user ? (s.likes || []).some(like => like.toString() === req.user._id.toString()) : false,
        isFollowing: isFollowing,
        displayAuthor: s.authorUsername || s.author?.username || s.author?.name || 'Anonymous',
        excerpt: s.excerpt || (s.content ? s.content.substring(0, 150) + '...' : ''),
        // ✅ Ensure stats are properly returned
        stats: {
          likes: s.likes?.length || s.stats?.likes || 0,
          comments: s.comments?.length || s.stats?.comments || 0,
          views: s.stats?.views || 0
        }
      };
    });

    res.json({
      success: true,
      stories: storiesWithMeta,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalStories: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
        limit: limitNum
      },
      filters: { category: category || 'all', search: search || '', sortBy, authorUsername }
    });
  } catch (err) {
    console.error('❌ Get stories error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching stories'
    });
  }
};

// ✅ GET STORY BY ID
exports.getStoryById = async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user ? req.user._id.toString() : null;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid story ID format' 
      });
    }

    const story = await Story.findById(storyId)
      .populate('author', 'name username bio location website stats avatar isVerified')
      .populate({
        path: 'comments.user',
        select: 'name username avatar'
      });

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    const isOwner = req.user && story.author._id.toString() === req.user._id.toString();
    const isPublished = story.status === 'published';

    if (!isPublished && !isOwner) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    const userKey = userId ? `${userId}_${storyId}` : null;
    const now = Date.now();
    let shouldIncrement = true;

    if (userId && userKey) {
      const userViewData = userViewCounts.get(userKey) || { count: 0, lastView: 0 };
      const timeSinceLastView = now - userViewData.lastView;

      if (timeSinceLastView < 5000 || userViewData.count >= 5 || isOwner) {
        shouldIncrement = false;
      } else {
        userViewCounts.set(userKey, {
          count: userViewData.count + 1,
          lastView: now
        });
      }
    }

    if (shouldIncrement) {
      await Story.findByIdAndUpdate(storyId, { $inc: { 'stats.views': 1 } });
      if (story.stats && story.stats.views !== undefined) {
        story.stats.views += 1;
      }
    }

    const isLiked = req.user ? (story.likes || []).some(like => like.toString() === req.user._id.toString()) : false;

    res.json({
      success: true,
      story: {
        ...story.toObject(),
        readTime: story.metadata?.readTime || Math.ceil((story.content || '').split(' ').length / 200),
        isLiked,
        displayAuthor: story.authorUsername || story.author?.username || story.author?.name,
        // ✅ Ensure stats are properly calculated
        stats: {
          likes: story.likes?.length || 0,
          comments: story.comments?.length || 0,
          views: story.stats?.views || 0
        }
      }
    });
  } catch (err) {
    console.error('❌ Get story error:', err);
    res.status(500).json({ success: false, message: 'Error fetching story' });
  }
};

// ✅ CREATE STORY WITH VALIDATION
exports.createStory = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      tags = [],
      status = 'published',
      metadata = {}
    } = req.body;

    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    if (title.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Title must be at least 10 characters'
      });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot exceed 200 characters'
      });
    }

    if (content.trim().length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Story content must be at least 100 characters'
      });
    }

    const validCategories = ['business', 'personal', 'education', 'health', 'relationships', 'career', 'technology', 'creative'];
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    const authorUsername = user.username || user.name || `user_${user._id.toString().slice(-6)}`;
    
    console.log('📝 Creating story with author details:', {
      userId: user._id.toString(),
      userName: user.name,
      userUsername: user.username,
      finalAuthorUsername: authorUsername,
      title: title.substring(0, 50)
    });

    const cleanMeta = {};
    if (metadata.recoveryTime) cleanMeta.recoveryTime = metadata.recoveryTime;
    if (metadata.currentStatus) cleanMeta.currentStatus = metadata.currentStatus;
    if (Array.isArray(metadata.keyLessons) && metadata.keyLessons.filter(Boolean).length) {
      cleanMeta.keyLessons = metadata.keyLessons.filter(Boolean);
    }
    if (metadata.readTime) cleanMeta.readTime = metadata.readTime;
    if (metadata.failureType) cleanMeta.failureType = metadata.failureType;

    const story = new Story({
      title: title.trim(),
      content: content.trim(),
      category,
      tags: tags.map(t => t.toLowerCase().trim()).slice(0, 5),
      author: user._id,
      authorUsername,
      status,
      metadata: cleanMeta,
      publishedAt: status === 'published' ? new Date() : undefined
    });

    const savedStory = await story.save();
    await savedStory.populate('author', 'name username bio location avatar');

    if (status === 'published') {
      await User.findByIdAndUpdate(
        user._id, 
        { $inc: { 'stats.storiesCount': 1 } }
      );
    }

    console.log('✅ Story created successfully:', {
      storyId: savedStory._id.toString(),
      authorUsername: savedStory.authorUsername,
      status: savedStory.status
    });

    res.status(201).json({
      success: true,
      message: status === 'published' 
        ? 'Story published successfully!' 
        : 'Story saved as draft!',
      story: {
        ...savedStory.toObject(),
        displayAuthor: savedStory.authorUsername,
        author: {
          id: savedStory.author._id,
          name: savedStory.author.name,
          username: savedStory.author.username,
          avatar: savedStory.author.avatar
        }
      }
    });
  } catch (err) {
    console.error('❌ Create story error:', err);
    
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creating story'
    });
  }
};

// ✅ TRACK STORY VIEW
exports.trackStoryView = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📊 Tracking view for story:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid story ID format' 
      });
    }

    const story = await Story.findByIdAndUpdate(
      id,
      { $inc: { 'stats.views': 1 } },
      { new: true }
    );

    if (!story) {
      return res.status(404).json({ 
        success: false, 
        message: 'Story not found' 
      });
    }

    console.log('✅ Story view tracked. New count:', story.stats.views);

    res.json({ 
      success: true, 
      views: story.stats.views,
      message: 'Story view tracked successfully' 
    });
  } catch (error) {
    console.error('❌ Story view tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error tracking story view',
      error: error.message 
    });
  }
};

// ✅ GET STORIES BY AUTHOR
exports.getStoriesByAuthor = async (req, res) => {
  try {
    const { authorUsername } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      sort = 'createdAt', 
      order = 'desc' 
    } = req.query;

    console.log('📚 Fetching stories for author:', authorUsername);

    const author = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${authorUsername}$`, 'i') } },
        { name: { $regex: new RegExp(`^${authorUsername}$`, 'i') } }
      ]
    });
    
    if (!author) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;

    const stories = await Story.find({ 
      $or: [
        { author: author._id },
        { authorUsername: author.username },
        { authorUsername: author.name }
      ],
      $and: [
        {
          $or: [
            { type: { $exists: false } },
            { type: 'story' },
            { type: 'fail_story' },
            { type: 'experience' }
          ]
        },
        {
          $and: [
            { category: { $ne: 'impact' } },
            { title: { $not: /impact post/i } }
          ]
        }
      ],
      status: 'published'
    })
      .populate('author', 'username name avatar bio')
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const totalStories = await Story.countDocuments({ 
      $or: [
        { author: author._id },
        { authorUsername: author.username },
        { authorUsername: author.name }
      ],
      $and: [
        {
          $or: [
            { type: { $exists: false } },
            { type: 'story' },
            { type: 'fail_story' },
            { type: 'experience' }
          ]
        },
        {
          $and: [
            { category: { $ne: 'impact' } },
            { title: { $not: /impact post/i } }
          ]
        }
      ],
      status: 'published'
    });

    console.log(`✅ Found ${stories.length} stories for ${authorUsername}`);

    res.json({
      success: true,
      stories,
      pagination: {
        currentPage: parseInt(page),
        totalStories,
        totalPages: Math.ceil(totalStories / parseInt(limit)),
        hasNext: page * limit < totalStories,
        hasPrev: page > 1
      },
      author: {
        _id: author._id,
        username: author.username,
        name: author.name
      }
    });
  } catch (error) {
    console.error('❌ Get stories by author error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching stories',
      error: error.message 
    });
  }
};

// ✅ LIKE STORY WITH PREFERENCE TRACKING
exports.likeStory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required to like stories'
      });
    }

    const userId = req.user._id;
    const storyId = req.params.id;

    console.log('👍 Like story request:', { userId: userId.toString(), storyId });

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid story ID format'
      });
    }

    // ✅ Get full story with category and tags for preference tracking
    const story = await Story.findById(storyId)
      .select('_id title category tags status author likes stats');
    
    if (!story) {
      return res.status(404).json({ 
        success: false, 
        message: 'Story not found'
      });
    }

    if (story.status !== 'published') {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot like unpublished stories'
      });
    }

    // Initialize arrays if they don't exist
    if (!story.likes) {
      story.likes = [];
    }
    if (!story.stats) {
      story.stats = { views: 0, likes: 0, comments: 0 };
    }

    const likeIndex = story.likes.findIndex(id => id.toString() === userId.toString());
    let isLiked;
    let message;

    if (likeIndex === -1) {
      // ✅ ADDING LIKE
      story.likes.push(userId);
      isLiked = true;
      message = 'Story liked';

      console.log('➕ Adding like. Story data:', {
        category: story.category,
        tags: story.tags
      });

      // ✅ UPDATE USER PREFERENCES BASED ON LIKED STORY
      try {
        const user = await User.findById(userId);
        if (user) {
          await user.updatePreferencesFromLike(story);
          console.log('✅ User preferences updated after like');
        }
      } catch (prefError) {
        console.error('⚠️ Error updating preferences (non-critical):', prefError);
      }

    } else {
      // ✅ REMOVING LIKE
      story.likes.splice(likeIndex, 1);
      isLiked = false;
      message = 'Like removed';

      console.log('➖ Removing like');

      // ✅ REMOVE FROM USER'S LIKED STORIES
      try {
        await User.findByIdAndUpdate(userId, {
          $pull: { likedStories: storyId }
        });
        console.log('✅ Removed from liked stories');
      } catch (removeError) {
        console.error('⚠️ Error removing from liked stories (non-critical):', removeError);
      }
    }

    // ✅ Update stats
    story.stats.likes = story.likes.length;
    await story.save();

    console.log('✅ Story saved. New like count:', story.stats.likes);

    return res.json({
      success: true,
      message,
      isLiked,
      likesCount: story.stats.likes
    });
  } catch (err) {
    console.error('❌ Like story error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error toggling like',
      error: err.message
    });
  }
};

// ✅ ADD COMMENT
exports.addComment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required to add comments'
      });
    }

    const userId = req.user._id;
    const storyId = req.params.id;
    const { content } = req.body;

    console.log('💬 Add comment request:', { userId: userId.toString(), storyId, contentLength: content?.length });

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Comment content is required' 
      });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Comment is too long (maximum 1000 characters)' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid story ID format' 
      });
    }

    const story = await Story.findById(storyId)
      .select('_id title status comments stats');
    
    if (!story) {
      return res.status(404).json({ 
        success: false, 
        message: 'Story not found' 
      });
    }

    if (story.status !== 'published') {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot comment on unpublished stories' 
      });
    }

    // Initialize if they don't exist
    if (!story.comments) {
      story.comments = [];
    }
    if (!story.stats) {
      story.stats = { views: 0, likes: 0, comments: 0 };
    }

    const newComment = {
      user: userId,
      content: content.trim(),
      createdAt: new Date()
    };

    story.comments.push(newComment);
    story.stats.comments = story.comments.length;
    
    await story.save();

    console.log('✅ Comment saved. New comment count:', story.stats.comments);

    // Populate user details
    await story.populate({
      path: 'comments.user',
      select: 'name username avatar'
    });

    const addedComment = story.comments[story.comments.length - 1];

    // Fallback if population fails
    if (!addedComment.user || !addedComment.user.name) {
      addedComment.user = {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        avatar: req.user.avatar
      };
    }

    console.log('✅ Comment added successfully');

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: addedComment,
      commentsCount: story.stats.comments
    });
  } catch (err) {
    console.error('❌ Add comment error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding comment',
      error: err.message
    });
  }
};

// ✅ UPDATE STORY WITH VALIDATION
exports.updateStory = async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user._id;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid story ID format' 
      });
    }

    const story = await Story.findById(storyId);
    
    if (!story) {
      return res.status(404).json({ 
        success: false, 
        message: 'Story not found' 
      });
    }

    if (story.author.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this story' 
      });
    }

    const updatedStory = await Story.findByIdAndUpdate(
      storyId,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('author', 'name username avatar');

    res.json({
      success: true,
      message: 'Story updated successfully',
      story: updatedStory
    });
  } catch (err) {
    console.error('❌ Update story error:', err);
    
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ')
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error updating story' 
    });
  }
};

// ✅ DELETE STORY
exports.deleteStory = async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid story ID format' 
      });
    }

    const story = await Story.findById(storyId);
    
    if (!story) {
      return res.status(404).json({ 
        success: false, 
        message: 'Story not found' 
      });
    }

    if (story.author.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this story' 
      });
    }

    await Story.findByIdAndDelete(storyId);

    if (story.status === 'published') {
      await User.findByIdAndUpdate(
        userId,
        { $inc: { 'stats.storiesCount': -1 } }
      );
    }

    res.json({
      success: true,
      message: 'Story deleted successfully'
    });
  } catch (err) {
    console.error('❌ Delete story error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting story' 
    });
  }
};

// ✅ GET COMMENTS
exports.getComments = async (req, res) => {
  try {
    const storyId = req.params.id;
    const { page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid story ID format' 
      });
    }

    const story = await Story.findById(storyId)
      .populate({
        path: 'comments.user',
        select: 'name username avatar'
      })
      .select('comments');

    if (!story) {
      return res.status(404).json({ 
        success: false, 
        message: 'Story not found' 
      });
    }

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const comments = story.comments.slice(startIndex, endIndex);

    res.json({ 
      success: true, 
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalComments: story.comments.length,
        totalPages: Math.ceil(story.comments.length / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('❌ Get comments error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching comments' 
    });
  }
};
