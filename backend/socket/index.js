/**
 * Socket.IO wiring: handshake authentication + event handlers.
 *
 * Extracted from server.js so the authorization rules are reachable from tests
 * without booting the HTTP server.
 *
 * Trust model
 * -----------
 * The handshake establishes identity once (`socket.userId`). Every handler
 * derives the acting user from that, never from the event payload. A chat room
 * is a private subscription, so joining one is authorized exactly like reading
 * the conversation over REST.
 */

const User = require('../models/User');
const Chat = require('../models/Chat');
const { verifyAuthToken, checkAccountState } = require('../utils/token');
const {
  createRateLimiter,
  EVENT_LIMITS,
  authorizeChat,
  authorizeChats,
  validateMessagePayload,
  validateTypingPayload,
  isValidObjectId,
  MAX_CHATS_PER_JOIN,
} = require('../utils/socketSecurity');

/**
 * Handshake middleware. Uses the same verification and account-state rules as
 * the HTTP `protect` middleware — previously this path called jwt.verify()
 * directly with no algorithm pin and no isActive/tokenVersion check, so a
 * deactivated or revoked user could still open a chat socket.
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication error'));
    }

    const decoded = verifyAuthToken(token);
    const user = await User.findById(decoded.id).select(
      '_id name username avatar isActive tokenVersion'
    );

    const state = checkAccountState(user, decoded);
    if (!state.ok) {
      // Deliberately generic: don't tell an unauthenticated caller whether an
      // account exists, is deactivated, or merely has a stale token.
      return next(new Error('Authentication error'));
    }

    socket.userId = user._id.toString();
    socket.username = user.username || user.name;
    socket.userInfo = {
      id: user._id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
    };

    // Per-connection state. Both are GC'd with the socket.
    socket.data.authorizedChats = new Set();
    socket.data.consume = createRateLimiter(EVENT_LIMITS);

    return next();
  } catch (err) {
    // Never log the token or the verification detail.
    return next(new Error('Authentication error'));
  }
}

/**
 * Register handlers for one connected socket.
 * `activeUsers` is the shared presence map owned by the caller.
 */
function registerSocketHandlers(io, socket, activeUsers) {
  const deny = (message, code) => socket.emit('error', { message, ...(code ? { code } : {}) });

  /** @returns {boolean} true when the event is allowed to proceed */
  const throttle = (eventName) => {
    const result = socket.data.consume(eventName);
    if (!result.allowed) {
      socket.emit('error', {
        message: 'Too many requests. Please slow down.',
        code: 'RATE_LIMITED',
        retryAfterMs: result.retryAfterMs,
      });
      return false;
    }
    return true;
  };

  activeUsers.set(socket.userId, {
    socketId: socket.id,
    userInfo: socket.userInfo,
    lastSeen: new Date(),
  });

  // Personal room, keyed by the authenticated id — a client cannot pick this.
  socket.join(`user_${socket.userId}`);

  // Presence: broadcast the id only. The previous payload also shipped every
  // user's name, username and avatar to every connected socket; the client only
  // ever reads `userId`.
  socket.broadcast.emit('userOnline', { userId: socket.userId });

  // ---- joinChats: bulk subscribe, authorized per chat ----
  socket.on('joinChats', async (chatIds) => {
    if (!throttle('joinChats')) return;

    if (!Array.isArray(chatIds)) {
      return deny('joinChats expects an array of chat ids', 'INVALID_PAYLOAD');
    }
    if (chatIds.length > MAX_CHATS_PER_JOIN) {
      return deny(
        `Cannot join more than ${MAX_CHATS_PER_JOIN} chats at once`,
        'TOO_MANY_CHATS'
      );
    }

    try {
      // One query; unauthorized ids simply don't come back.
      const allowed = await authorizeChats(socket, chatIds);
      allowed.forEach((chatId) => socket.join(`chat_${chatId}`));
      socket.emit('chatsJoined', { chatIds: allowed });
    } catch (error) {
      console.error('Socket joinChats error:', error.message);
      deny('Failed to join chats', 'JOIN_FAILED');
    }
  });

  // ---- joinChat: single subscribe, authorized ----
  socket.on('joinChat', async (chatId) => {
    if (!throttle('joinChat')) return;

    if (!isValidObjectId(chatId)) {
      return deny('Invalid chat id', 'INVALID_PAYLOAD');
    }

    try {
      if (!(await authorizeChat(socket, chatId))) {
        // Same response for "no such chat" and "not a participant" so a client
        // cannot use this to probe which chat ids exist.
        return deny('Chat not found', 'CHAT_NOT_FOUND');
      }
      socket.join(`chat_${chatId}`);
      socket.emit('chatJoined', { chatId });
    } catch (error) {
      console.error('Socket joinChat error:', error.message);
      deny('Failed to join chat', 'JOIN_FAILED');
    }
  });

  // ---- leaveChat: no authorization needed (leaving is always safe) ----
  socket.on('leaveChat', (chatId) => {
    if (!throttle('leaveChat')) return;
    if (!isValidObjectId(chatId)) {
      return deny('Invalid chat id', 'INVALID_PAYLOAD');
    }
    socket.leave(`chat_${chatId}`);
    socket.data.authorizedChats.delete(chatId);
  });

  // ---- sendMessage ----
  socket.on('sendMessage', async (data) => {
    if (!throttle('sendMessage')) return;

    const parsed = validateMessagePayload(data);
    if (!parsed.ok) {
      return deny(parsed.error, 'INVALID_PAYLOAD');
    }
    const { chatId, content, messageType } = parsed.value;

    try {
      const chat = await Chat.findById(chatId);
      if (!chat) {
        return deny('Chat not found', 'CHAT_NOT_FOUND');
      }

      // Authorization on the authenticated identity (unchanged in intent from
      // the original code, kept explicit here).
      if (!chat.participants.some((p) => p.toString() === socket.userId)) {
        return deny('Not authorized to send messages', 'FORBIDDEN');
      }

      const newMessage = {
        sender: socket.userId, // never data.sender
        content,
        messageType,
      };

      chat.messages.push(newMessage);
      chat.lastMessage = {
        content,
        sender: socket.userId,
        timestamp: new Date(),
      };

      await chat.save();
      await chat.populate('messages.sender', 'name username avatar');

      const savedMessage = chat.messages[chat.messages.length - 1];

      io.to(`chat_${chatId}`).emit('newMessage', {
        chatId,
        message: savedMessage,
        chat: {
          _id: chat._id,
          lastMessage: chat.lastMessage,
        },
      });
    } catch (error) {
      console.error('Socket sendMessage error:', error.message);
      deny('Failed to send message', 'SEND_FAILED');
    }
  });

  // ---- typing ----
  socket.on('typing', async (data) => {
    if (!throttle('typing')) return;

    const parsed = validateTypingPayload(data);
    if (!parsed.ok) return; // stay quiet: typing is best-effort

    const { chatId, isTyping } = parsed.value;

    try {
      // Membership check: without it any socket could broadcast typing activity
      // into a stranger's conversation.
      if (!(await authorizeChat(socket, chatId))) return;

      socket.to(`chat_${chatId}`).emit('userTyping', {
        userId: socket.userId, // identity from the handshake, not the payload
        username: socket.username,
        isTyping,
      });
    } catch (error) {
      console.error('Socket typing error:', error.message);
    }
  });

  socket.on('disconnect', () => {
    // Only clear presence if this socket is still the registered one; a user
    // with two tabs shouldn't appear offline when one of them closes.
    const current = activeUsers.get(socket.userId);
    if (current && current.socketId === socket.id) {
      activeUsers.delete(socket.userId);
      socket.broadcast.emit('userOffline', { userId: socket.userId });
    }
  });
}

/**
 * Maximum simultaneous sockets per account.
 *
 * The per-event rate limiter lives on the socket, so without this an attacker
 * with one valid account could simply open N connections and multiply their
 * event budget by N. A real user needs only a handful (multiple tabs/devices).
 */
const MAX_SOCKETS_PER_USER = 8;

/**
 * Attach authentication + handlers to an io instance.
 * @returns {Map} the presence map, for callers that want to inspect it
 */
function initSocket(io) {
  const activeUsers = new Map();
  // userId -> number of open sockets
  const connectionCounts = new Map();

  io.use(socketAuthMiddleware);

  io.use((socket, next) => {
    const count = connectionCounts.get(socket.userId) || 0;
    if (count >= MAX_SOCKETS_PER_USER) {
      return next(new Error('Too many connections'));
    }
    connectionCounts.set(socket.userId, count + 1);
    next();
  });

  io.on('connection', (socket) => {
    // Decrement on close, and delete the key at zero so this map cannot grow
    // unbounded across the process lifetime.
    socket.on('disconnect', () => {
      const remaining = (connectionCounts.get(socket.userId) || 1) - 1;
      if (remaining <= 0) connectionCounts.delete(socket.userId);
      else connectionCounts.set(socket.userId, remaining);
    });

    registerSocketHandlers(io, socket, activeUsers);
  });

  return activeUsers;
}

module.exports = {
  initSocket,
  MAX_SOCKETS_PER_USER,
  socketAuthMiddleware,
  registerSocketHandlers,
};
