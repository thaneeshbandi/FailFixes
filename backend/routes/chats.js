const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Get all chats for current user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const chats = await Chat.find({
      participants: userId
    })
    .populate('participants', 'name username avatar')
    .populate('lastMessage.sender', 'name username')
    .sort({ updatedAt: -1 })
    .lean();

    const chatsWithUnread = chats.map(chat => {
      const unreadCount = chat.messages.filter(message => 
        message.sender.toString() !== userId.toString() &&
        !message.readBy.some(read => read.user.toString() === userId.toString())
      ).length;

      return {
        ...chat,
        unreadCount
      };
    });

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
router.post('/direct', auth, async (req, res) => {
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
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    if (!chat.participants.includes(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const messages = chat.messages
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + parseInt(limit))
      .reverse();

    await Chat.populate(messages, {
      path: 'sender',
      select: 'name username avatar'
    });

    res.json({
      success: true,
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalMessages: chat.messages.length,
        hasNext: skip + parseInt(limit) < chat.messages.length
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
});

module.exports = router;
