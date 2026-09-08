const express = require('express');
const router = express.Router();

const {
  getChats,
  createDirectChat,
  getChatMessages,
  markChatRead,
} = require('../controllers/chatController');

const { auth } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');
const {
  validateChatIdParam,
  validatePagination,
} = require('../middleware/validation');

// NOTE: there is deliberately no `POST /:chatId/messages`. Sending a message is
// a real-time operation and lives on the Socket.IO `sendMessage` event
// (socket/index.js), which persists the message and fans it out to the room in
// one step. A parallel REST write path would need its own authorization,
// validation and broadcast, and would be a second way for the two to disagree.
// Chat *reads* stay on HTTP, where pagination is natural.

// GET /api/chats - list the current user's chats with unread counts
router.get('/', auth, getChats);

// POST /api/chats/direct - create or fetch a 1:1 chat
router.post('/direct', auth, writeLimiter, createDirectChat);

// GET /api/chats/:chatId/messages - paginated history
router.get('/:chatId/messages', auth, validateChatIdParam, validatePagination, getChatMessages);

// PUT /api/chats/:chatId/read - mark all messages read by the current user
router.put('/:chatId/read', auth, writeLimiter, validateChatIdParam, markChatRead);

module.exports = router;
