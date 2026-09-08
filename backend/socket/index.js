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

const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');

const User = require('../models/User');
const Chat = require('../models/Chat');
const { verifyAuthToken, checkAccountState } = require('../utils/token');
const { createPresenceTracker } = require('./presence');
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
 * Register the message/room handlers for one connected socket.
 *
 * Presence and the connection cap are NOT handled here — they belong to
 * initSocket, which owns the shared counter (socket/presence.js) and is the only
 * place that can tell whether a connect/disconnect is the account's first or
 * last across the whole cluster.
 */
function registerSocketHandlers(io, socket) {
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

  // Personal room, keyed by the authenticated id — a client cannot pick this.
  socket.join(`user_${socket.userId}`);

  // Presence is announced by initSocket, which owns the shared counter and knows
  // whether this was the account's FIRST connection. Announcing here would fire
  // once per tab.
  //
  // Note the payload is the id only: the original also shipped every user's
  // name, username and avatar to every connected socket, and the client only
  // ever reads `userId`.

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

  // `disconnect` is handled in initSocket, which owns the shared counter: a user
  // is offline only when their LAST connection closes, anywhere in the cluster.
}

/**
 * Maximum simultaneous sockets per account.
 *
 * The per-event rate limiter lives on the socket, so without this an attacker
 * with one valid account could simply open N connections and multiply their
 * event budget by N. A real user needs only a handful (multiple tabs/devices).
 *
 * Enforced against the SHARED counter in socket/presence.js, so the cap is the
 * cap for the whole cluster rather than per instance.
 */
const MAX_SOCKETS_PER_USER = 8;

/**
 * Attach the Redis adapter when REDIS_URL is configured.
 *
 * Socket.IO keeps its room registry in the memory of the process that owns the
 * connection, so `io.to('chat_x').emit(...)` reaches only locally-connected
 * sockets. The adapter publishes each broadcast on Redis pub/sub and every other
 * instance replays it to its own local members — which is what makes running
 * more than one instance correct.
 *
 * The adapter needs TWO dedicated connections: a Redis connection in subscriber
 * mode cannot issue ordinary commands, so the publisher must be separate. Neither
 * may be the cache client from middleware/cache.js for the same reason.
 *
 * @returns {Promise<{pubClient: object, subClient: object}|null>} null when no
 *          REDIS_URL is set, or when Redis could not be reached — in which case
 *          the server keeps working as a correct single instance.
 */
async function attachRedisAdapter(io) {
  if (!process.env.REDIS_URL) {
    console.log('ℹ️  Socket.IO: no REDIS_URL — running single-instance (in-memory adapter)');
    return null;
  }

  try {
    const pubClient = redis.createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    // Without listeners, a later connection error would be an unhandled 'error'
    // event and would crash the process.
    pubClient.on('error', (err) => console.warn('⚠️  Socket.IO pub client error:', err.message));
    subClient.on('error', (err) => console.warn('⚠️  Socket.IO sub client error:', err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));

    console.log('✅ Socket.IO: Redis adapter attached — multi-instance broadcasts enabled');
    return { pubClient, subClient };
  } catch (err) {
    // A cache outage should not take chat down; it should reduce the deployment
    // to one correct instance. This is only safe because the failure is loud.
    console.error(
      '❌ Socket.IO: Redis adapter unavailable (%s). Falling back to the in-memory ' +
        'adapter — broadcasts will NOT cross instances. Run a single instance until ' +
        'Redis is restored.',
      err.message
    );
    return null;
  }
}

/**
 * Attach authentication + handlers to an io instance.
 *
 * @param {import('socket.io').Server} io
 * @param {{redisClient?: object}} [deps] injection point for tests
 * @returns {Promise<{presence: object, close: function}>}
 */
async function initSocket(io, deps = {}) {
  const adapterClients = deps.skipAdapter ? null : await attachRedisAdapter(io);

  // Set during shutdown. Once true, disconnect handlers stop broadcasting:
  // the adapter publishes over Redis, and publishing on a closing client
  // rejects asynchronously — which server.js treats as an unhandledRejection
  // and responds to by exiting non-zero. A clean SIGTERM would look like a
  // crash in the platform's logs.
  let closing = false;

  // The presence counter reuses the adapter's publisher connection when there is
  // one: it issues ordinary commands (INCR/DECR/GET), which a publisher can do,
  // and it saves a third connection per instance.
  const presenceClient = deps.redisClient || (adapterClients && adapterClients.pubClient) || null;
  const presence = createPresenceTracker(presenceClient, { maxPerUser: MAX_SOCKETS_PER_USER });

  io.use(socketAuthMiddleware);

  // Connection cap, enforced against the shared counter. Reserving the slot in
  // the middleware (rather than in the connection handler) means a refused
  // socket never reaches the handlers at all.
  io.use(async (socket, next) => {
    try {
      const slot = await presence.acquire(socket.userId);
      if (!slot.allowed) {
        return next(new Error('Too many connections'));
      }
      // Remembered so `disconnect` releases exactly one slot, and so the
      // userOnline broadcast happens only for the account's first connection.
      socket.data.presenceAcquired = true;
      socket.data.isFirstConnection = slot.isFirst;
      return next();
    } catch (err) {
      console.error('Socket presence error:', err.message);
      return next(new Error('Connection rejected'));
    }
  });

  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket, presence);

    // Announce arrival only when this is the account's first live connection
    // anywhere in the cluster. `socket.broadcast` is adapter-aware, so this
    // reaches other instances too.
    if (socket.data.isFirstConnection) {
      socket.broadcast.emit('userOnline', { userId: socket.userId });
    }

    socket.on('disconnect', async () => {
      if (!socket.data.presenceAcquired) return;
      socket.data.presenceAcquired = false;

      try {
        const { isLast } = await presence.release(socket.userId);
        if (isLast && !closing) {
          socket.broadcast.emit('userOffline', { userId: socket.userId });
        }
      } catch (err) {
        console.error('Socket presence release error:', err.message);
      }
    });
  });

  return {
    presence,

    /**
     * Shut the socket layer down in the only order that is safe.
     *
     * Sockets must be disconnected while the adapter's Redis connections are
     * still open, because each disconnect decrements the shared presence
     * counter. Quitting Redis first would leave every counter inflated, and
     * those accounts would appear online until their key's TTL expired.
     */
    async close() {
      closing = true;

      try {
        io.disconnectSockets(true);
      } catch (err) {
        console.warn('⚠️  Socket.IO: error disconnecting sockets:', err.message);
      }

      // Let the disconnect handlers' presence.release() calls reach Redis before
      // the connections are torn down. They are fire-and-forget by nature (a
      // disconnect handler has nothing to await it), so a short drain is the
      // pragmatic way to give them a chance.
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!adapterClients) return;
      await Promise.allSettled([
        adapterClients.pubClient.quit(),
        adapterClients.subClient.quit(),
      ]);
    },
  };
}

module.exports = {
  initSocket,
  attachRedisAdapter,
  MAX_SOCKETS_PER_USER,
  socketAuthMiddleware,
  registerSocketHandlers,
};
