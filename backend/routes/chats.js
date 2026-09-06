const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const {
  validateChatIdParam,
  validatePagination,
} = require('../middleware/validation');

// Get all chats for current user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // The unread count used to be computed by pulling EVERY message of EVERY
    // chat into Node. Count them in MongoDB and never ship the message bodies.
    const chats = await Chat.aggregate([
      { $match: { participants: userId } },
      { $sort: { updatedAt: -1 } },
      {
        $addFields: {
          unreadCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$messages', []] },
                as: 'm',
                cond: {
                  $and: [
                    { $ne: ['$$m.sender', userId] },
                    {
                      $not: {
                        $in: [
                          userId,
                          {
                            $map: {
                              input: { $ifNull: ['$$m.readBy', []] },
                              as: 'r',
                              in: '$$r.user',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      // Drop the message array from the payload — the list view never renders it.
      { $project: { messages: 0 } },
    ]);

    await Chat.populate(chats, [
      { path: 'participants', select: 'name username avatar' },
      { path: 'lastMessage.sender', select: 'name username' },
    ]);

    const chatsWithUnread = chats;

    res.json({
      success: true,
      chats: chatsWithUnread
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get chats' });
  }
});

// Create or get existing direct chat
router.post('/direct', auth, writeLimiter, async (req, res) => {
  try {
    const { userId: targetUserId } = req.body;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create chat with yourself'
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if direct chat already exists
    let chat = await Chat.findOne({
      chatType: 'direct',
      participants: { $all: [currentUserId, targetUserId], $size: 2 }
    }).populate('participants', 'name username avatar');

    if (!chat) {
      // Create new direct chat
      chat = new Chat({
        chatType: 'direct',
        participants: [currentUserId, targetUserId],
        messages: []
      });
      await chat.save();
      await chat.populate('participants', 'name username avatar');
    }

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    console.error('Create direct chat error:', error);
    res.status(500).json({ success: false, message: 'Failed to create chat' });
  }
});

// Get chat messages
router.get('/:chatId/messages', auth, validateChatIdParam, validatePagination, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    // Authorization first, on a projection that does NOT pull the messages.
    const chatMeta = await Chat.findById(chatId).select('participants').lean();
    if (!chatMeta) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    if (!chatMeta.participants.some((p) => p.toString() === userId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Page inside MongoDB (newest-first window, returned oldest-first) instead
    // of loading and sorting the entire embedded array in Node on every open.
    const [doc] = await Chat.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(chatId) } },
      {
        $project: {
          totalMessages: { $size: { $ifNull: ['$messages', []] } },
          messages: {
            $slice: [
              {
                $reverseArray: {
                  $sortArray: {
                    input: { $ifNull: ['$messages', []] },
                    sortBy: { createdAt: 1 },
                  },
                },
              },
              skip,
              limitNum,
            ],
          },
        },
      },
    ]);

    const messages = (doc ? doc.messages : []).reverse();
    const totalMessages = doc ? doc.totalMessages : 0;

    await Chat.populate(messages, {
      path: 'sender',
      select: 'name username avatar'
    });

    res.json({
      success: true,
      messages,
      pagination: {
        currentPage: pageNum,
        totalMessages,
        hasNext: skip + limitNum < totalMessages
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
});

module.exports = router;
