/**
 * Chat controller.
 *
 * routes/chats.js previously defined its handlers inline, which made it the only
 * route file in the backend that did not follow the route -> controller -> model
 * pattern. The handlers are unchanged in behaviour; moving them here makes the
 * layering consistent across every resource and makes them unit-addressable.
 *
 * Authorization rule for every handler in this file: a chat is private to its
 * participants, so each one checks `participants` against `req.user._id` before
 * returning or writing anything. The same rule is enforced for the real-time
 * path in utils/socketSecurity.js.
 */

const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const User = require('../models/User');

/**
 * Aggregation fragment: number of messages in a chat that were not sent by
 * `userId` and that `userId` has not yet marked read.
 *
 * This is the read side of the read-receipt feature. The write side lives in
 * `markChatRead` below — it did not exist before, so `messages.readBy` was never
 * populated and this count could only ever grow.
 */
function unreadCountExpr(userId) {
  return {
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
  };
}

// @desc    List the current user's chats with unread counts
// @route   GET /api/chats
// @access  Private
exports.getChats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // The unread count used to be computed by pulling EVERY message of EVERY
    // chat into Node. Count them in MongoDB and never ship the message bodies.
    const chats = await Chat.aggregate([
      { $match: { participants: userId } },
      { $sort: { updatedAt: -1 } },
      { $addFields: { unreadCount: unreadCountExpr(userId) } },
      // Drop the message array from the payload — the list view never renders it.
      { $project: { messages: 0 } },
    ]);

    await Chat.populate(chats, [
      { path: 'participants', select: 'name username avatar' },
      { path: 'lastMessage.sender', select: 'name username' },
    ]);

    res.json({ success: true, chats });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a direct chat with another user, or return the existing one
// @route   POST /api/chats/direct
// @access  Private
exports.createDirectChat = async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.body;
    const currentUserId = req.user._id;

    // Validated here rather than by a route validator because the id arrives in
    // the body, and an invalid ObjectId would otherwise throw a CastError.
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create chat with yourself',
      });
    }

    const targetUser = await User.findById(targetUserId).select('_id isActive');
    if (!targetUser || targetUser.isActive === false) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let chat = await Chat.findOne({
      chatType: 'direct',
      participants: { $all: [currentUserId, targetUserId], $size: 2 },
    }).populate('participants', 'name username avatar');

    if (!chat) {
      chat = new Chat({
        chatType: 'direct',
        participants: [currentUserId, targetUserId],
        messages: [],
      });
      await chat.save();
      await chat.populate('participants', 'name username avatar');
    }

    res.json({ success: true, chat });
  } catch (error) {
    next(error);
  }
};

// @desc    Page through a chat's messages, oldest-first within the page
// @route   GET /api/chats/:chatId/messages
// @access  Private (participants only)
exports.getChatMessages = async (req, res, next) => {
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
      select: 'name username avatar',
    });

    res.json({
      success: true,
      messages,
      pagination: {
        currentPage: pageNum,
        totalMessages,
        hasNext: skip + limitNum < totalMessages,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark every message in a chat as read by the current user
// @route   PUT /api/chats/:chatId/read
// @access  Private (participants only)
//
// This completes a feature that was half-built: `Chat.messages.readBy` was
// declared in the schema and consumed by the unread-count aggregation, but
// nothing ever wrote to it. The frontend called PUT /api/chats/:chatId/read on
// every chat open and received a 404, so the unread badge never cleared.
exports.markChatRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    // One atomic update, scoped by `participants` so a non-participant's write
    // matches no document — authorization and mutation in a single round trip,
    // with no read-modify-write window in between.
    //
    // arrayFilters selects only messages that (a) someone else sent and (b) this
    // user has not already read, which makes the operation idempotent: calling
    // it twice does not append a second receipt.
    const result = await Chat.updateOne(
      { _id: chatId, participants: userId },
      {
        $push: {
          'messages.$[unread].readBy': { user: userId, readAt: new Date() },
        },
      },
      {
        arrayFilters: [
          {
            'unread.sender': { $ne: userId },
            'unread.readBy.user': { $ne: userId },
          },
        ],
        // Do NOT touch `updatedAt`. Chat.updatedAt is what GET /api/chats sorts
        // the sidebar by ("most recent conversation first"), and Mongoose bumps
        // it on every update by default. Without this flag, simply *opening* a
        // conversation would jump it to the top of the list as though it had new
        // activity.
        timestamps: false,
      }
    );

    if (result.matchedCount === 0) {
      // Same response for "no such chat" and "not a participant" so this cannot
      // be used to probe which chat ids exist.
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    // NOTE: `result.modifiedCount` is deliberately not reported as a message
    // count. It counts *documents* (always 0 or 1 here), so exposing it as
    // "messages marked" would be wrong. The client only needs to know the chat
    // is now fully read.
    res.json({
      success: true,
      message: 'Chat marked as read',
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};
