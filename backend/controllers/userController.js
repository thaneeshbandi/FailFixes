const User = require('../models/User');
const Story = require('../models/Story');
const { buildAllowedUpdate, PROFILE_UPDATE_SPEC, summariseRejected } = require('../utils/allowedUpdates');
const {
  exactInsensitive,
  containsInsensitive,
  asEnum,
  asBoundedInt,
} = require('../utils/queryHelpers');

const VALID_STORY_STATUSES = ['draft', 'published', 'archived'];
const VALID_USER_STORY_SORTS = ['createdAt', 'publishedAt', 'title', 'stats.views', 'stats.likes'];

/**
 * The "stories authored by this user" filter, which was duplicated verbatim in
 * getUserDashboard / getUserStats / getUserStories / getUserProfileByUsername.
 */
function buildUserStoryFilter(userId, username) {
  return {
    $or: [{ author: userId }, { authorUsername: username }],
    $and: [
      {
        $or: [
          { type: { $exists: false } },
          { type: 'story' },
          { type: 'fail_story' },
        ],
      },
      { category: { $ne: 'impact' } },
    ],
  };
}

// 🎯 BULLETPROOF FOLLOW FUNCTION

// NOTE: a second, graph-based getSuggestedUsers (User.findSuggestedUsers with
// $graphLookup: friends-of-friends + similar-interests + trending) was defined
// here. It was dead code — the simpler implementation further down in this file
// redefined `exports.getSuggestedUsers` and silently won, so the graph version
// never executed. Removed to leave one reachable implementation. The model
// static User.findSuggestedUsers is retained if you want to switch to it.

exports.followUser = async (req, res) => {
  const startTime = Date.now();
  console.log('\n=== FOLLOW USER CONTROLLER START ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Request Method:', req.method);
  console.log('Request URL:', req.originalUrl);
  console.log('Request Params:', JSON.stringify(req.params, null, 2));

  try {
    if (!req.user) {
      console.error('❌ STEP 1 FAILED: No authenticated user');
      return res.status(401).json({
        success: false,
        message: 'Authentication required to follow users',
        code: 'NO_AUTH'
      });
    }

    const currentUserId = req.user._id;
    const { username } = req.params;
    
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      console.error('❌ STEP 2 FAILED: Invalid username parameter:', username);
      return res.status(400).json({
        success: false,
        message: 'Username parameter is required and must be a valid string',
        code: 'INVALID_USERNAME_PARAM'
      });
    }

    const targetUsername = username.trim();
    const currentUsername = req.user.username || req.user.name || '';
    
    if (targetUsername.toLowerCase() === currentUsername.toLowerCase()) {
      console.error('❌ STEP 3 FAILED: Self-follow attempt');
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself',
        code: 'SELF_FOLLOW_ATTEMPT'
      });
    }

    // Escaped exact match: `targetUsername` used to be interpolated raw into a
    // RegExp, so `.*` matched an arbitrary user and a backtracking pattern was a
    // cheap DoS.
    const targetPattern = exactInsensitive(targetUsername);
    const userToFollow = await User.findOne({
      $or: [
        { username: targetPattern },
        { name: targetPattern }
      ]
    }).select('_id username name followers following stats');

    if (!userToFollow) {
      console.error('❌ STEP 4 FAILED: Target user not found:', targetUsername);
      return res.status(404).json({
        success: false,
        message: `User '${targetUsername}' not found`,
        code: 'USER_NOT_FOUND'
      });
    }

    if (userToFollow._id.toString() === currentUserId.toString()) {
      console.error('❌ STEP 5 FAILED: Self-follow detected by ID match');
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself',
        code: 'SELF_FOLLOW_ID_MATCH'
      });
    }

    if (!userToFollow.followers) {
      userToFollow.followers = [];
    }

    const isCurrentlyFollowing = userToFollow.followers.some(
      followerId => followerId.toString() === currentUserId.toString()
    );

    let action, message, newFollowStatus;

    if (isCurrentlyFollowing) {
      await Promise.all([
        User.findByIdAndUpdate(userToFollow._id, {
          $pull: { followers: currentUserId },
          $inc: { 'stats.followersCount': -1 }
        }),
        User.findByIdAndUpdate(currentUserId, {
          $pull: { following: userToFollow._id },
          $inc: { 'stats.followingCount': -1 }
        })
      ]);

      action = 'unfollowed';
      message = `Unfollowed ${userToFollow.username || userToFollow.name}`;
      newFollowStatus = false;
    } else {
      await Promise.all([
        User.findByIdAndUpdate(userToFollow._id, {
          $addToSet: { followers: currentUserId },
          $inc: { 'stats.followersCount': 1 }
        }),
        User.findByIdAndUpdate(currentUserId, {
          $addToSet: { following: userToFollow._id },
          $inc: { 'stats.followingCount': 1 }
        })
      ]);

      action = 'followed';
      message = `Now following ${userToFollow.username || userToFollow.name}`;
      newFollowStatus = true;
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ ${action.toUpperCase()} operation successful`);
    console.log('=== FOLLOW USER CONTROLLER END ===\n');

    return res.status(200).json({
      success: true,
      message: message,
      isFollowing: newFollowStatus,
      action: action,
      user: {
        id: userToFollow._id.toString(),
        username: userToFollow.username,
        name: userToFollow.name
      },
      executionTime: executionTime
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('\n❌ FOLLOW USER ERROR:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error during follow operation',
      code: 'FOLLOW_OPERATION_ERROR',
      executionTime: executionTime
    });
  }
};

// ✅ ADD: Track profile view
exports.trackProfileView = async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user?.id || req.user?._id;

    console.log('📊 Tracking profile view:', { userId, viewerId });

    if (!viewerId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Don't track views on own profile
    if (userId === viewerId.toString()) {
      return res.json({ 
        success: true, 
        message: 'Own profile view not tracked' 
      });
    }

    // Update profile view count
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { profileViews: 1 } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    console.log('✅ Profile view tracked. New count:', user.profileViews);

    res.json({ 
      success: true, 
      views: user.profileViews,
      message: 'Profile view tracked successfully' 
    });
  } catch (error) {
    console.error('❌ Profile view tracking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error tracking profile view',
    });
  }
};

// ✅ IMPROVED: Get user profile by username with comprehensive stats
exports.getUserProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id || req.user?._id;

    console.log('👤 Fetching profile for username:', username);

    // Find user by username with case-insensitive search
    const usernamePattern = exactInsensitive(username);
    const user = await User.findOne({
      $or: [
        { username: usernamePattern },
        { name: usernamePattern }
      ]
    })
      .select('-password -email')
      .lean();

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Get story statistics with proper filtering
    const storiesCount = await Story.countDocuments({ 
      $or: [
        { author: user._id },
        { authorUsername: user.username },
        { authorUsername: user.name }
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
        { category: { $ne: 'impact' } },
        { status: 'published' }
      ]
    });

    // Calculate total story views
    const totalStoryViews = await Story.aggregate([
      {
        $match: { 
          $or: [
            { author: user._id },
            { authorUsername: user.username },
            { authorUsername: user.name }
          ],
          $and: [
            {
              $or: [
                { type: { $exists: false } },
                { type: 'story' },
                { type: 'fail_story' }
              ]
            },
            { category: { $ne: 'impact' } },
            { status: 'published' }
          ]
        }
      },
      {
        $group: { 
          _id: null, 
          total: { $sum: '$views' } 
        }
      }
    ]);

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUserId && currentUserId.toString() !== user._id.toString()) {
      const currentUser = await User.findById(currentUserId);
      isFollowing = currentUser?.following?.some(
        followingId => followingId.toString() === user._id.toString()
      ) || false;
    }

    // Build comprehensive user profile
    const userProfile = {
      _id: user._id,
      id: user._id,
      name: user.name,
      username: user.username,
      displayUsername: user.username || user.name || `user_${user._id.toString().slice(-6)}`,
      bio: user.bio || '',
      avatar: user.avatar,
      location: user.location,
      createdAt: user.createdAt,
      
      // Stats
      storiesCount,
      totalStoryViews: totalStoryViews[0]?.total || 0,
      followersCount: user.followers?.length || user.stats?.followersCount || 0,
      followingCount: user.following?.length || user.stats?.followingCount || 0,
      profileViews: user.profileViews || user.stats?.profileViews || 0,
      
      // Relationship status
      isFollowing,
      canFollow: currentUserId && currentUserId.toString() !== user._id.toString(),
      
      // Additional metadata
      memberSince: user.createdAt,
      stats: {
        storiesCount,
        followersCount: user.followers?.length || user.stats?.followersCount || 0,
        followingCount: user.following?.length || user.stats?.followingCount || 0,
        totalViews: totalStoryViews[0]?.total || 0,
        profileViews: user.profileViews || 0
      }
    };

    console.log('✅ Profile fetched successfully:', {
      username,
      storiesCount,
      totalStoryViews: totalStoryViews[0]?.total || 0,
      followersCount: userProfile.followersCount,
      isFollowing
    });

    res.json({
      success: true,
      profile: userProfile,
      user: userProfile // For backward compatibility
    });
  } catch (error) {
    console.error('❌ Get user profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user profile',
    });
  }
};

// ✅ ADD: Search users
exports.searchUsers = async (req, res) => {
  try {
    const { q, limit = 10, page = 1 } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json({ 
        success: true, 
        users: [], 
        total: 0,
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          hasNext: false
        }
      });
    }

    const searchQuery = q.trim();
    const searchRegex = containsInsensitive(searchQuery, 100);
    
    const users = await User.find({
      $or: [
        { username: searchRegex },
        { name: searchRegex },
        { bio: searchRegex }
      ]
    })
      .select('username name avatar bio stats followersCount followingCount createdAt')
      .sort({ 'stats.followersCount': -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await User.countDocuments({
      $or: [
        { username: searchRegex },
        { name: searchRegex },
        { bio: searchRegex }
      ]
    });

    const enhancedUsers = users.map(user => ({
      ...user,
      displayUsername: user.username || user.name || `user_${user._id.toString().slice(-6)}`,
      followersCount: user.followersCount || user.stats?.followersCount || 0,
      followingCount: user.followingCount || user.stats?.followingCount || 0
    }));

    res.json({
      success: true,
      users: enhancedUsers,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('❌ Search users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error searching users',
    });
  }
};

// 🎯 ENHANCED: Get user feed with follow status included
exports.getUserFeed = async (req, res) => {
  console.log('\n📰 === USER FEED WITH FOLLOW STATUS ===');
  
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user._id;
    
    console.log('Feed request details:', {
      userId: userId.toString(),
      page: page,
      limit: limit,
      timestamp: new Date().toISOString()
    });
    
    // Get current user with following list
    const currentUser = await User.findById(userId)
      .populate('following', 'username name _id')
      .lean();
    
    if (!currentUser) {
      console.error('❌ Current user not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const followingIds = currentUser.following || [];
    console.log('✅ Following data:', {
      followingCount: followingIds.length,
      followingUsers: followingIds.map(u => ({
        id: u._id.toString(),
        username: u.username,
        name: u.name
      }))
    });
    
    if (followingIds.length === 0) {
      console.log('👥 User is not following anyone - returning empty feed');
      return res.json({
        success: true,
        stories: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalStories: 0,
          hasNext: false,
          hasPrev: false
        },
        debug: {
          followingCount: 0,
          followedUsersFound: 0,
          validUsernames: 0,
          storiesFound: 0
        },
        message: 'Follow some users to see their stories in your feed!'
      });
    }
    
    // Extract usernames for story lookup
    const followedUsernames = followingIds
      .map(user => user.username || user.name)
      .filter(username => username && username.trim().length > 0);
    
    console.log('✅ Username variations:', {
      uniqueUsernames: followedUsernames.length,
      usernames: followedUsernames
    });
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Query stories with multiple strategies
    let stories = [];
    let total = 0;
    
    // Strategy 1: Query by authorUsername
    console.log('🔄 Strategy 1: Query by authorUsername...');
    stories = await Story.find({
      authorUsername: { $in: followedUsernames },
      status: 'published',
      $and: [
        {
          $or: [
            { type: { $exists: false } },
            { type: 'story' },
            { type: 'fail_story' }
          ]
        },
        { category: { $ne: 'impact' } }
      ]
    })
    .populate('author', 'name username bio avatar')
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum)
    .lean();
    
    console.log('📊 Strategy 1 results:', {
      storiesFound: stories.length,
      queryUsernames: followedUsernames
    });
    
    // Strategy 2: If no stories found, query by author ObjectId
    if (stories.length === 0) {
      console.log('🔄 Strategy 2: Query by author ObjectId...');
      const followingObjectIds = followingIds.map(u => u._id);
      
      stories = await Story.find({
        author: { $in: followingObjectIds },
        status: 'published',
        $and: [
          {
            $or: [
              { type: { $exists: false } },
              { type: 'story' },
              { type: 'fail_story' }
            ]
          },
          { category: { $ne: 'impact' } }
        ]
      })
      .populate('author', 'name username bio avatar')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();
      
      console.log('📊 Strategy 2 results:', {
        storiesFound: stories.length,
        queryObjectIds: followingObjectIds.map(id => id.toString())
      });
    }

    // Get total count for pagination
    if (stories.length > 0) {
      total = await Story.countDocuments({
        $or: [
          { 
            authorUsername: { $in: followedUsernames },
            $and: [
              {
                $or: [
                  { type: { $exists: false } },
                  { type: 'story' },
                  { type: 'fail_story' }
                ]
              },
              { category: { $ne: 'impact' } }
            ]
          },
          { 
            author: { $in: followingIds.map(u => u._id) },
            $and: [
              {
                $or: [
                  { type: { $exists: false } },
                  { type: 'story' },
                  { type: 'fail_story' }
                ]
              },
              { category: { $ne: 'impact' } }
            ]
          }
        ],
        status: 'published'
      });
    }

    // 🎯 CRITICAL: Add isFollowing status to each story
    const storiesWithFollowStatus = stories.map(story => {
      const storyAuthorUsername = story.authorUsername || story.author?.username;
      
      // Check if current user is following this story's author
      const isFollowing = followingIds.some(followedUser => {
        const followedUsername = followedUser.username || followedUser.name;
        return followedUsername && 
               followedUsername.toLowerCase() === storyAuthorUsername?.toLowerCase();
      });

      return {
        ...story,
        isFollowing: isFollowing, // 🎯 ADD THIS FIELD
        readTime: story.metadata?.readTime || Math.ceil((story.content || '').split(' ').length / 200) || 1,
        isLiked: story.likes ? story.likes.some(like => like.toString() === userId.toString()) : false,
        displayAuthor: storyAuthorUsername,
        excerpt: story.content ? story.content.substring(0, 150) + '...' : ''
      };
    });

    const response = {
      success: true,
      stories: storiesWithFollowStatus, // 🎯 RETURN STORIES WITH FOLLOW STATUS
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalStories: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      },
      debug: {
        followingCount: followingIds.length,
        followedUsersFound: followingIds.length,
        usernameVariations: followedUsernames.length,
        uniqueUsernames: followedUsernames.length,
        storiesFound: stories.length,
        totalStoriesInDB: total
      }
    };

    console.log('🏁 === USER FEED END ===\n');
    res.json(response);

  } catch (err) {
    console.error('\n❌ === USER FEED ERROR ===');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);

    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user feed',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

// ✅ IMPROVED: Dashboard functionality with comprehensive stats
exports.getUserDashboard = async (req, res) => {
  try {
    console.log('📊 Dashboard request for user:', req.user._id.toString());
    
    const userId = req.user._id;
    const userUsername = req.user.username || req.user.name || `user_${userId.toString().slice(-6)}`;

    const user = await User.findById(userId)
      .select('name username stats createdAt bio avatar followers following profileViews')
      .populate('followers', 'name username avatar bio stats')
      .populate('following', 'name username avatar bio stats')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const storyFilter = buildUserStoryFilter(userId, userUsername);

    // Counters aggregated in MongoDB, and only the 5 most recent stories are
    // fetched. This previously loaded every story the user had written (full
    // `content` on each) and did the arithmetic, sort and slice in Node.
    const [aggResult, recentDocs] = await Promise.all([
      Story.aggregate([
        { $match: storyFilter },
        {
          $group: {
            _id: null,
            totalStories: { $sum: 1 },
            publishedStories: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
            draftStories: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
            totalViews: {
              $sum: { $ifNull: ['$views', { $ifNull: ['$stats.views', 0] }] },
            },
            totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
            totalComments: { $sum: { $size: { $ifNull: ['$comments', []] } } },
          },
        },
      ]),
      Story.find(storyFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        // Only the first 120 characters of content are needed for the excerpt.
        .select({
          title: 1, status: 1, views: 1, 'stats.views': 1, likes: 1,
          'stats.likes': 1, comments: 1, 'stats.comments': 1,
          createdAt: 1, category: 1,
          content: { $substrCP: [{ $ifNull: ['$content', ''] }, 0, 120] },
        })
        .lean(),
    ]);

    const agg = aggResult[0] || {};
    const totalStories = agg.totalStories || 0;
    const publishedStories = agg.publishedStories || 0;
    const draftStories = agg.draftStories || 0;
    const totalViews = agg.totalViews || 0;
    const totalLikes = agg.totalLikes || 0;
    const totalComments = agg.totalComments || 0;

    const recentStories = recentDocs.map(story => ({
      id: story._id.toString(),
      title: story.title,
      status: story.status,
      views: story.views || story.stats?.views || 0,
      likes: story.likes?.length || story.stats?.likes || 0,
      comments: story.comments?.length || story.stats?.comments || 0,
      createdAt: story.createdAt,
      category: story.category,
      excerpt: story.content ? story.content.substring(0, 100) + '...' : ''
    }));

    const recentFollowers = (user.followers || [])
      .slice(-5)
      .reverse()
      .map(follower => ({
        id: follower._id,
        name: follower.name,
        username: follower.username || follower.name,
        displayUsername: follower.username || follower.name || `user_${follower._id.toString().slice(-6)}`,
        avatar: follower.avatar,
        stats: follower.stats
      }));

    const recentFollowing = (user.following || [])
      .slice(-5)
      .reverse()
      .map(followed => ({
        id: followed._id,
        name: followed.name,
        username: followed.username || followed.name,
        displayUsername: followed.username || followed.name || `user_${followed._id.toString().slice(-6)}`,
        avatar: followed.avatar,
        stats: followed.stats
      }));

    const currentFollowersCount = user.followers?.length || user.stats?.followersCount || 0;
    const currentFollowingCount = user.following?.length || user.stats?.followingCount || 0;
    const currentProfileViews = user.profileViews || user.stats?.profileViews || 0;

    res.json({
      success: true,
      dashboard: {
        user: {
          id: user._id,
          name: user.name,
          username: user.username || user.name,
          displayUsername: userUsername,
          memberSince: user.createdAt,
          bio: user.bio,
          avatar: user.avatar
        },
        stats: {
          storiesShared: totalStories,
          published: publishedStories,
          drafts: draftStories,
          totalViews: totalViews,
          totalLikes: totalLikes,
          heartsReceived: totalLikes,
          totalComments: totalComments,
          followersCount: currentFollowersCount,
          followingCount: currentFollowingCount,
          profileViews: currentProfileViews
        },
        recentStories,
        recentFollowers,
        recentFollowing,
        growth: {
          viewsGrowth: 0,
          followersGrowth: 0,
          storiesGrowth: 0,
          isPositive: true
        }
      }
    });

  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching dashboard data',
    });
  }
};

// ✅ IMPROVED: Get suggested users
exports.getSuggestedUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { limit = 10 } = req.query;
    
    // Get current user's following list
    const currentUser = await User.findById(currentUserId).select('following');
    const followingIds = currentUser?.following || [];
    
    const suggestedUsers = await User.find({
      _id: { 
        $ne: currentUserId,
        $nin: followingIds // Exclude users already being followed
      }
    })
    .select('name username bio avatar stats createdAt followersCount followingCount')
    .sort({ 
      followersCount: -1, 
      'stats.followersCount': -1, 
      createdAt: -1 
    })
    .limit(parseInt(limit))
    .lean();

    const enhancedUsers = suggestedUsers.map(user => ({
      ...user,
      displayUsername: user.username || user.name || `user_${user._id.toString().slice(-6)}`,
      isFollowing: false,
      followersCount: user.followersCount || user.stats?.followersCount || 0,
      followingCount: user.followingCount || user.stats?.followingCount || 0,
      canFollow: true
    }));

    res.json({
      success: true,
      users: enhancedUsers,
      total: enhancedUsers.length
    });
  } catch (err) {
    console.error('❌ Get suggested users error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching suggested users',
    });
  }
};

// ✅ IMPROVED: Get user stats
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userUsername = req.user.username || req.user.name;

    // Get user with populated data
    const user = await User.findById(userId)
      .select('stats followers following profileViews')
      .lean();

    // Aggregate the counters in MongoDB. This previously loaded every story the
    // user has ever written — full `content` included — just to run reduce().
    const [agg] = await Story.aggregate([
      { $match: buildUserStoryFilter(userId, userUsername) },
      {
        $group: {
          _id: null,
          storiesCount: { $sum: 1 },
          publishedStories: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
          draftStories: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          // BEHAVIOUR FIX: this summed a top-level `views` field that does not
          // exist on the Story schema (views live at `stats.views`), so
          // /api/users/me/stats always reported totalViews: 0 while
          // /api/users/dashboard reported the real figure. Now consistent.
          totalViews: { $sum: { $ifNull: ['$views', { $ifNull: ['$stats.views', 0] }] } },
          totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
          totalComments: { $sum: { $size: { $ifNull: ['$comments', []] } } },
        },
      },
    ]);

    const stats = {
      storiesCount: agg?.storiesCount || 0,
      publishedStories: agg?.publishedStories || 0,
      draftStories: agg?.draftStories || 0,
      totalViews: agg?.totalViews || 0,
      totalLikes: agg?.totalLikes || 0,
      totalComments: agg?.totalComments || 0,
      followersCount: user.followers?.length || user.stats?.followersCount || 0,
      followingCount: user.following?.length || user.stats?.followingCount || 0,
      profileViews: user.profileViews || user.stats?.profileViews || 0
    };

    res.json({ 
      success: true, 
      stats 
    });
  } catch (err) {
    console.error('❌ Get user stats error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user stats',
    });
  }
};

// ✅ IMPROVED: Get user stories
exports.getUserStories = async (req, res) => {
  try {
    const userId = req.user._id;
    const userUsername = req.user.username || req.user.name;
    const { page = 1, limit = 10, status = 'all', sort = 'createdAt' } = req.query;

    let query = {
      $or: [
        { author: userId },
        { authorUsername: userUsername }
      ],
      $and: [
        {
          $or: [
            { type: { $exists: false } },
            { type: 'story' },
            { type: 'fail_story' }
          ]
        },
        { category: { $ne: 'impact' } }
      ]
    };

    // `?status[$ne]=x` used to become a MongoDB operator; `?sort=<anything>`
    // used to become an arbitrary sort key.
    const statusFilter = asEnum(status, VALID_STORY_STATUSES);
    if (statusFilter) {
      query.status = statusFilter;
    }

    const pageNum = asBoundedInt(page, { min: 1, max: 10000, fallback: 1 });
    const limitNum = asBoundedInt(limit, { min: 1, max: 50, fallback: 10 });
    const sortField = asEnum(sort, VALID_USER_STORY_SORTS, 'createdAt');

    const stories = await Story.find(query)
      .sort({ [sortField]: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const totalStories = await Story.countDocuments(query);

    const enhancedStories = stories.map(story => ({
      ...story,
      views: story.views || 0,
      likes: story.likes?.length || 0,
      comments: story.comments?.length || 0,
      readTime: Math.ceil((story.content || '').split(' ').length / 200) || 1
    }));

    res.json({ 
      success: true, 
      stories: enhancedStories,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalStories / limitNum),
        totalStories,
        hasNext: pageNum * limitNum < totalStories,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error('❌ Get user stories error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user stories',
    });
  }
};

// ✅ IMPROVED: Get user followers
exports.getUserFollowers = async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = asBoundedInt(page, { min: 1, max: 10000, fallback: 1 });
    const limitNum = asBoundedInt(limit, { min: 1, max: 50, fallback: 20 });

    // Two reads on purpose. `populate` with a limit truncates the array, so the
    // previous code's `user.followers.length` could never exceed the page size —
    // totalPages was always 1. Read the true count from the unpopulated doc.
    const counts = await User.findOne({
      $or: [{ username }, { name: username }]
    })
      .select('followers')
      .lean();

    if (!counts) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    const totalFollowers = (counts.followers || []).length;

    const user = await User.findById(counts._id)
      .populate({
        path: 'followers',
        select: 'name username bio avatar stats createdAt',
        options: {
          limit: limitNum,
          skip: (pageNum - 1) * limitNum,
          sort: { createdAt: -1 }
        }
      })
      .lean();

    const followers = (user.followers || []).map(follower => ({
      ...follower,
      displayUsername: follower.username || follower.name || `user_${follower._id.toString().slice(-6)}`,
      followersCount: follower.stats?.followersCount || 0,
      followingCount: follower.stats?.followingCount || 0
    }));

    res.json({ 
      success: true, 
      followers,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalFollowers / limitNum),
        total: totalFollowers,
        hasNext: pageNum * limitNum < totalFollowers,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error('❌ Get followers error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching followers',
    });
  }
};

// ✅ IMPROVED: Get user following
exports.getUserFollowing = async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = asBoundedInt(page, { min: 1, max: 10000, fallback: 1 });
    const limitNum = asBoundedInt(limit, { min: 1, max: 50, fallback: 20 });

    // Two reads on purpose. `populate` with a limit truncates the array, so the
    // previous code's `user.following.length` could never exceed the page size —
    // totalPages was always 1. Read the true count from the unpopulated doc.
    const counts = await User.findOne({
      $or: [{ username }, { name: username }]
    })
      .select('following')
      .lean();

    if (!counts) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    const totalFollowing = (counts.following || []).length;

    const user = await User.findById(counts._id)
      .populate({
        path: 'following',
        select: 'name username bio avatar stats createdAt',
        options: {
          limit: limitNum,
          skip: (pageNum - 1) * limitNum,
          sort: { createdAt: -1 }
        }
      })
      .lean();

    const following = (user.following || []).map(followedUser => ({
      ...followedUser,
      displayUsername: followedUser.username || followedUser.name || `user_${followedUser._id.toString().slice(-6)}`,
      followersCount: followedUser.stats?.followersCount || 0,
      followingCount: followedUser.stats?.followingCount || 0
    }));

    res.json({ 
      success: true, 
      following,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalFollowing / limitNum),
        total: totalFollowing,
        hasNext: pageNum * limitNum < totalFollowing,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error('❌ Get following error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching following',
    });
  }
};

// Placeholder methods that can be implemented later
exports.getUserAnalytics = async (req, res) => {
  try {
    // Placeholder for analytics data
    res.json({ 
      success: true, 
      analytics: {
        viewTrends: [],
        engagementRate: 0,
        topStories: []
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching analytics' 
    });
  }
};

exports.getLikedStories = async (req, res) => {
  try {
    // Placeholder for liked stories
    res.json({ 
      success: true, 
      likedStories: [] 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching liked stories' 
    });
  }
};

exports.getUserActivity = async (req, res) => {
  try {
    // Placeholder for user activity
    res.json({ 
      success: true, 
      activities: [] 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user activity' 
    });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ 
      success: true, 
      profile: user 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching profile' 
    });
  }
};

exports.updateUserProfile = async (req, res, next) => {
  try {
    // SECURITY: never $set req.body directly. Doing so let any authenticated
    // user write `role: 'admin'`, or write `password` (which bypasses the
    // bcrypt pre-save hook and stores cleartext), or forge followers/stats.
    const { updates, rejected } = buildAllowedUpdate(req.body, PROFILE_UPDATE_SPEC);

    if (rejected.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Request contains fields that cannot be updated here',
        code: 'FORBIDDEN_FIELDS',
        fields: summariseRejected(rejected),
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updatable fields supplied',
        code: 'EMPTY_UPDATE',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      profile: user
    });
  } catch (err) {
    next(err);
  }
};

exports.getViewTrends = async (req, res) => {
  try {
    // Placeholder for view trends
    res.json({ 
      success: true, 
      trends: {
        daily: [],
        weekly: [],
        monthly: []
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching view trends' 
    });
  }
};

exports.getEngagementMetrics = async (req, res) => {
  try {
    // Placeholder for engagement metrics
    res.json({ 
      success: true, 
      metrics: {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching engagement metrics' 
    });
  }
};
