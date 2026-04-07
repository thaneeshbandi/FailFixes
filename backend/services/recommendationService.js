// backend/services/recommendationService.js

const User = require('../models/User');
const Story = require('../models/Story');

class RecommendationService {
  
  /**
   * Get suggested users based on:
   * 1. Friends of friends (2nd degree connections)
   * 2. Similar interests (story categories liked)
   * 3. Similar engagement patterns
   */
  async getSuggestedUsers(userId, limit = 10) {
    const suggestions = [];
    
    // === STEP 1: Friends of Friends (Social Graph) ===
    const friendsOfFriends = await this.getFriendsOfFriends(userId);
    suggestions.push(...friendsOfFriends);
    
    // === STEP 2: Interest-Based (Content Graph) ===
    const similarInterests = await this.getUsersBySimilarInterests(userId);
    suggestions.push(...similarInterests);
    
    // === STEP 3: Collaborative Filtering ===
    const similarUsers = await this.getCollaborativeFiltering(userId);
    suggestions.push(...similarUsers);
    
    // === STEP 4: Rank and deduplicate ===
    return this.rankAndDeduplicate(suggestions, userId, limit);
  }
  
  /**
   * Find friends of friends using $graphLookup
   */
  async getFriendsOfFriends(userId) {
    const result = await User.aggregate([
      { $match: { _id: userId } },
      {
        $graphLookup: {
          from: 'users',
          startWith: '$following',
          connectFromField: 'following',
          connectToField: '_id',
          as: 'friendsOfFriends',
          maxDepth: 1, // Only 2nd degree connections
          depthField: 'depth'
        }
      },
      { $unwind: '$friendsOfFriends' },
      {
        $match: {
          'friendsOfFriends._id': { $ne: userId }, // Not self
          'friendsOfFriends._id': { $nin: '$following' } // Not already following
        }
      },
      {
        $project: {
          userId: '$friendsOfFriends._id',
          username: '$friendsOfFriends.username',
          name: '$friendsOfFriends.name',
          mutualFriends: {
            $size: {
              $setIntersection: ['$following', '$friendsOfFriends.following']
            }
          },
          score: 5, // Base score for FoF
          reason: 'mutual_friends'
        }
      },
      { $sort: { mutualFriends: -1 } },
      { $limit: 20 }
    ]);
    
    return result.map(r => ({
      ...r,
      score: r.score + (r.mutualFriends * 2) // Boost by mutual friends
    }));
  }
  
  /**
   * Find users with similar interests based on liked story categories
   */
  async getUsersBySimilarInterests(userId) {
    // Get current user's liked categories
    const user = await User.findById(userId)
      .populate('likedStories', 'category tags');
    
    if (!user || !user.likedStories || user.likedStories.length === 0) {
      return [];
    }
    
    const likedCategories = [...new Set(
      user.likedStories.map(s => s.category)
    )];
    
    const likedTags = [...new Set(
      user.likedStories.flatMap(s => s.tags || [])
    )];
    
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
      {
        $lookup: {
          from: 'users',
          localField: 'likes',
          foreignField: '_id',
          as: 'likedBy'
        }
      },
      { $unwind: '$likedBy' },
      {
        $match: {
          'likedBy._id': { $ne: userId },
          'likedBy._id': { $nin: user.following || [] }
        }
      },
      {
        $group: {
          _id: '$likedBy._id',
          username: { $first: '$likedBy.username' },
          name: { $first: '$likedBy.name' },
          commonCategories: { $addToSet: '$category' },
          commonTags: { $addToSet: '$tags' },
          matchCount: { $sum: 1 }
        }
      },
      {
        $project: {
          userId: '$_id',
          username: 1,
          name: 1,
          score: { $multiply: ['$matchCount', 3] },
          reason: 'similar_interests',
          details: {
            categories: '$commonCategories',
            tags: '$commonTags'
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: 20 }
    ]);
    
    return similarUsers;
  }
  
  /**
   * Collaborative filtering: Users who liked same stories
   */
  async getCollaborativeFiltering(userId) {
    const user = await User.findById(userId);
    
    if (!user || !user.likedStories || user.likedStories.length === 0) {
      return [];
    }
    
    const result = await Story.aggregate([
      // Find stories the user liked
      { $match: { _id: { $in: user.likedStories } } },
      // Get all users who liked these stories
      {
        $lookup: {
          from: 'users',
          localField: 'likes',
          foreignField: '_id',
          as: 'similarUsers'
        }
      },
      { $unwind: '$similarUsers' },
      {
        $match: {
          'similarUsers._id': { $ne: userId },
          'similarUsers._id': { $nin: user.following || [] }
        }
      },
      {
        $group: {
          _id: '$similarUsers._id',
          username: { $first: '$similarUsers.username' },
          name: { $first: '$similarUsers.name' },
          commonLikes: { $sum: 1 },
          stories: { $push: '$title' }
        }
      },
      {
        $project: {
          userId: '$_id',
          username: 1,
          name: 1,
          score: { $multiply: ['$commonLikes', 4] },
          reason: 'similar_taste',
          details: { commonLikes: '$commonLikes' }
        }
      },
      { $sort: { score: -1 } },
      { $limit: 20 }
    ]);
    
    return result;
  }
  
  /**
   * Rank suggestions by combined score and deduplicate
   */
  rankAndDeduplicate(suggestions, currentUserId, limit) {
    // Group by userId and sum scores
    const userScores = new Map();
    
    suggestions.forEach(sug => {
      const uid = sug.userId.toString();
      if (!userScores.has(uid)) {
        userScores.set(uid, {
          ...sug,
          score: 0,
          reasons: []
        });
      }
      
      const existing = userScores.get(uid);
      existing.score += sug.score;
      existing.reasons.push(sug.reason);
    });
    
    // Convert to array and sort
    const ranked = Array.from(userScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return ranked;
  }
  
  /**
   * Get trending users (most followed recently)
   */
  async getTrendingUsers(limit = 10) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return await User.aggregate([
      {
        $project: {
          username: 1,
          name: 1,
          stats: 1,
          recentFollowers: {
            $filter: {
              input: '$followers',
              as: 'follower',
              cond: { $gte: ['$$follower.followedAt', oneWeekAgo] }
            }
          }
        }
      },
      {
        $project: {
          username: 1,
          name: 1,
          stats: 1,
          recentFollowersCount: { $size: '$recentFollowers' }
        }
      },
      { $sort: { recentFollowersCount: -1 } },
      { $limit: limit }
    ]);
  }
}

module.exports = new RecommendationService();
