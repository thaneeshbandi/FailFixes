/**
 * Socket.IO authorization and abuse controls.
 *
 * The handshake middleware authenticates *who* a socket is, and `sendMessage`
 * checked chat membership — but `joinChat` / `joinChats` / `typing` did not.
 * Any authenticated user could therefore emit
 *
 *     socket.emit('joinChat', '<any chat id>')
 *
 * and start receiving every `newMessage` broadcast for a conversation they are
 * not part of, and emit typing indicators into it. Room membership is the
 * subscription boundary for private data, so it must be authorized like any
 * other read.
 */

const mongoose = require('mongoose');
const Chat = require('../models/Chat');

// Bound how much a single socket can ask for in one `joinChats` call.
const MAX_CHATS_PER_JOIN = 50;
const MAX_MESSAGE_LENGTH = 1000; // matches Chat.messages.content maxLength

/**
 * Per-socket sliding-window counters. Lives on the socket, so it is garbage
 * collected with the connection — no server-wide map to leak.
 */
function createRateLimiter(limits) {
  const buckets = new Map();

  return function consume(eventName) {
    const limit = limits[eventName];
    if (!limit) return { allowed: true };

    const now = Date.now();
    let bucket = buckets.get(eventName);

    if (!bucket || now - bucket.start >= limit.windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(eventName, bucket);
    }

    bucket.count += 1;
    if (bucket.count > limit.max) {
      return {
        allowed: false,
        retryAfterMs: limit.windowMs - (now - bucket.start),
      };
    }
    return { allowed: true };
  };
}

// Per-socket event budgets. Generous enough for real use (a fast typist emits
// a typing event a few times a second), tight enough to stop a flood loop.
const EVENT_LIMITS = {
  sendMessage: { max: 30, windowMs: 10_000 }, // 3/sec sustained
  typing: { max: 60, windowMs: 10_000 }, // 6/sec sustained
  joinChat: { max: 60, windowMs: 60_000 },
  joinChats: { max: 10, windowMs: 60_000 },
  leaveChat: { max: 60, windowMs: 60_000 },
};

function isValidObjectId(id) {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

/**
 * Authorize a socket for a chat, with a small per-socket cache.
 *
 * The cache only ever stores *positive* results for the lifetime of the
 * connection. Participant lists change rarely, and a stale positive is bounded
 * by the socket's lifetime; negatives are never cached so newly granted access
 * works immediately.
 *
 * @returns {Promise<boolean>}
 */
async function authorizeChat(socket, chatId) {
  if (!isValidObjectId(chatId)) return false;

  if (socket.data.authorizedChats.has(chatId)) return true;

  const chat = await Chat.findById(chatId).select('participants').lean();
  if (!chat) return false;

  // Identity comes from the verified handshake (socket.userId), never from the
  // event payload.
  const isParticipant = chat.participants.some(
    (p) => p.toString() === socket.userId
  );

  if (isParticipant) socket.data.authorizedChats.add(chatId);
  return isParticipant;
}

/**
 * Batch authorization for `joinChats`, in one query rather than N.
 *
 * @returns {Promise<string[]>} the subset of ids this socket may join
 */
async function authorizeChats(socket, chatIds) {
  const candidates = [...new Set(chatIds.filter(isValidObjectId))].slice(
    0,
    MAX_CHATS_PER_JOIN
  );
  if (candidates.length === 0) return [];

  const cached = candidates.filter((id) => socket.data.authorizedChats.has(id));
  const toCheck = candidates.filter((id) => !socket.data.authorizedChats.has(id));
  if (toCheck.length === 0) return cached;

  // Single query, already filtered by participation — an unauthorized id simply
  // does not come back.
  const chats = await Chat.find({
    _id: { $in: toCheck },
    participants: socket.userId,
  })
    .select('_id')
    .lean();

  const authorized = chats.map((c) => c._id.toString());
  authorized.forEach((id) => socket.data.authorizedChats.add(id));

  return [...cached, ...authorized];
}

/**
 * Validate a `sendMessage` payload.
 * @returns {{ok: true, value: {chatId: string, content: string, messageType: string}} | {ok: false, error: string}}
 */
function validateMessagePayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Invalid payload' };
  }

  const { chatId, content, messageType = 'text' } = data;

  if (!isValidObjectId(chatId)) {
    return { ok: false, error: 'Invalid chat id' };
  }
  if (typeof content !== 'string') {
    return { ok: false, error: 'Message content must be a string' };
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Message cannot be empty' };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` };
  }
  // Only 'text' is user-sendable; 'system' is reserved for server-generated
  // messages and must not be spoofable by a client.
  if (messageType !== 'text') {
    return { ok: false, error: 'Unsupported message type' };
  }

  return { ok: true, value: { chatId, content: trimmed, messageType: 'text' } };
}

/**
 * Validate a `typing` payload.
 */
function validateTypingPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Invalid payload' };
  }
  if (!isValidObjectId(data.chatId)) {
    return { ok: false, error: 'Invalid chat id' };
  }
  return { ok: true, value: { chatId: data.chatId, isTyping: Boolean(data.isTyping) } };
}

module.exports = {
  createRateLimiter,
  EVENT_LIMITS,
  authorizeChat,
  authorizeChats,
  validateMessagePayload,
  validateTypingPayload,
  isValidObjectId,
  MAX_CHATS_PER_JOIN,
  MAX_MESSAGE_LENGTH,
};
