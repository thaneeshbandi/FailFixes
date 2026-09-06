/**
 * Socket.IO authorization regression tests.
 *
 * These assert the actual security property — "can user B read user A's private
 * conversation?" — not merely that a handler exists or returns a status code.
 */

const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const mongoose = require('mongoose');

const { initSocket } = require('../socket');
const User = require('../models/User');
const Chat = require('../models/Chat');

const TEST_TIMEOUT = 20000;

let httpServer;
let ioServer;
let port;

/** users */
let alice, bob, mallory;
let aliceToken, bobToken, malloryToken;
/** private chat between alice and bob — mallory is NOT a participant */
let privateChatId;

function connect(token, opts = {}) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      ...opts,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('connect timeout'));
    }, 8000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
  });
}

/** Resolve with the first matching event, or null after `ms`. */
function waitFor(socket, event, ms = 1200) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    const handler = (payload) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const stamp = Date.now();
  const mk = async (name) => {
    const u = new User({
      name: `${name} ${stamp}`,
      email: `${name}${stamp}@sockettest.com`,
      username: `${name}${stamp}`.slice(0, 20),
      password: 'Test123!@#',
      isVerified: true,
    });
    await u.save();
    return u;
  };

  alice = await mk('alice');
  bob = await mk('bob');
  mallory = await mk('mallory');

  aliceToken = alice.generateAuthToken();
  bobToken = bob.generateAuthToken();
  malloryToken = mallory.generateAuthToken();

  const chat = new Chat({
    chatType: 'direct',
    participants: [alice._id, bob._id],
    messages: [],
  });
  await chat.save();
  privateChatId = chat._id.toString();

  httpServer = http.createServer();
  ioServer = new Server(httpServer, { cors: { origin: false } });
  initSocket(ioServer);

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  port = httpServer.address().port;
}, TEST_TIMEOUT);

afterAll(async () => {
  await Chat.deleteMany({ participants: { $in: [alice._id, bob._id, mallory._id] } });
  await User.deleteMany({ email: { $regex: /@sockettest\.com$/ } });
  if (ioServer) ioServer.close();
  if (httpServer) await new Promise((r) => httpServer.close(r));
  await mongoose.connection.close();
}, TEST_TIMEOUT);

// ============================================================
describe('🔌 Socket.IO — handshake authentication', () => {
  test('rejects a connection with no token', async () => {
    await expect(connect(null)).rejects.toThrow(/Authentication error/);
  });

  test('rejects a forged/invalid token', async () => {
    await expect(connect('not.a.jwt')).rejects.toThrow(/Authentication error/);
  });

  test('rejects a token signed with the wrong secret', async () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ id: alice._id, tv: 0 }, 'a-different-secret-of-sufficient-length!!', {
      algorithm: 'HS256',
      issuer: 'failfixes',
      audience: 'failfixes-api',
    });
    await expect(connect(forged)).rejects.toThrow(/Authentication error/);
  });

  test('rejects "alg: none" (unsigned) tokens', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ id: alice._id, tv: 0, iss: 'failfixes', aud: 'failfixes-api' })
    ).toString('base64url');
    await expect(connect(`${header}.${body}.`)).rejects.toThrow(/Authentication error/);
  });

  test('accepts a valid token', async () => {
    const s = await connect(aliceToken);
    expect(s.connected).toBe(true);
    s.close();
  });

  test('rejects a deactivated account even with a still-valid token', async () => {
    await User.findByIdAndUpdate(mallory._id, { isActive: false });
    try {
      await expect(connect(malloryToken)).rejects.toThrow(/Authentication error/);
    } finally {
      await User.findByIdAndUpdate(mallory._id, { isActive: true });
    }
  });

  test('rejects a revoked session (tokenVersion bumped)', async () => {
    const stale = mallory.generateAuthToken();
    await User.findByIdAndUpdate(mallory._id, { $inc: { tokenVersion: 1 } });
    try {
      await expect(connect(stale)).rejects.toThrow(/Authentication error/);
    } finally {
      await User.findByIdAndUpdate(mallory._id, { tokenVersion: 0 });
    }
  });
});

// ============================================================
describe('🔌 Socket.IO — room authorization (the core IDOR)', () => {
  let malloryS;

  beforeEach(async () => {
    malloryS = await connect(malloryToken);
  });
  afterEach(() => malloryS && malloryS.close());

  test('a non-participant CANNOT join a private chat room', async () => {
    malloryS.emit('joinChat', privateChatId);

    const [joined, err] = await Promise.all([
      waitFor(malloryS, 'chatJoined'),
      waitFor(malloryS, 'error'),
    ]);

    expect(joined).toBeNull();
    expect(err).not.toBeNull();
    expect(err.code).toBe('CHAT_NOT_FOUND');
  });

  test('a participant CAN join their own chat room', async () => {
    const aliceS = await connect(aliceToken);
    try {
      aliceS.emit('joinChat', privateChatId);
      const joined = await waitFor(aliceS, 'chatJoined');
      expect(joined).toEqual({ chatId: privateChatId });
    } finally {
      aliceS.close();
    }
  });

  test('THE ATTACK: a non-participant does not receive messages from a chat they tried to join', async () => {
    const aliceS = await connect(aliceToken);
    const bobS = await connect(bobToken);
    try {
      // Mallory attempts to subscribe to Alice and Bob's private conversation.
      malloryS.emit('joinChat', privateChatId);
      await waitFor(malloryS, 'error');

      aliceS.emit('joinChat', privateChatId);
      bobS.emit('joinChat', privateChatId);
      await Promise.all([waitFor(aliceS, 'chatJoined'), waitFor(bobS, 'chatJoined')]);

      const bobReceives = waitFor(bobS, 'newMessage', 2500);
      const malloryReceives = waitFor(malloryS, 'newMessage', 2500);

      aliceS.emit('sendMessage', { chatId: privateChatId, content: 'private medical details' });

      // The real participant gets it...
      const forBob = await bobReceives;
      expect(forBob).not.toBeNull();
      expect(forBob.message.content).toBe('private medical details');

      // ...the eavesdropper does not.
      expect(await malloryReceives).toBeNull();
    } finally {
      aliceS.close();
      bobS.close();
    }
  }, TEST_TIMEOUT);

  test('joinChats silently drops unauthorized ids and keeps authorized ones', async () => {
    const aliceS = await connect(aliceToken);
    try {
      const otherChat = await Chat.create({
        chatType: 'direct',
        participants: [alice._id, mallory._id],
        messages: [],
      });

      aliceS.emit('joinChats', [privateChatId, otherChat._id.toString()]);
      const okForAlice = await waitFor(aliceS, 'chatsJoined');
      expect(okForAlice.chatIds.sort()).toEqual(
        [privateChatId, otherChat._id.toString()].sort()
      );

      // Mallory is in otherChat but NOT in privateChatId.
      malloryS.emit('joinChats', [privateChatId, otherChat._id.toString()]);
      const okForMallory = await waitFor(malloryS, 'chatsJoined');
      expect(okForMallory.chatIds).toEqual([otherChat._id.toString()]);
      expect(okForMallory.chatIds).not.toContain(privateChatId);
    } finally {
      aliceS.close();
    }
  }, TEST_TIMEOUT);

  test('joinChats rejects a non-array payload', async () => {
    malloryS.emit('joinChats', privateChatId); // string, not array
    const err = await waitFor(malloryS, 'error');
    expect(err.code).toBe('INVALID_PAYLOAD');
  });

  test('joinChats rejects an oversized batch', async () => {
    const ids = Array.from({ length: 51 }, () => new mongoose.Types.ObjectId().toString());
    malloryS.emit('joinChats', ids);
    const err = await waitFor(malloryS, 'error');
    expect(err.code).toBe('TOO_MANY_CHATS');
  });

  test('joinChat rejects a malformed id without touching the database', async () => {
    malloryS.emit('joinChat', { $ne: null });
    const err = await waitFor(malloryS, 'error');
    expect(err.code).toBe('INVALID_PAYLOAD');
  });

  test('leaveChat rejects a malformed id', async () => {
    malloryS.emit('leaveChat', ['../../etc/passwd']);
    const err = await waitFor(malloryS, 'error');
    expect(err.code).toBe('INVALID_PAYLOAD');
  });
});

// ============================================================
describe('🔌 Socket.IO — sendMessage', () => {
  test('a non-participant cannot send into a private chat', async () => {
    const malloryS = await connect(malloryToken);
    try {
      const before = (await Chat.findById(privateChatId)).messages.length;

      malloryS.emit('sendMessage', { chatId: privateChatId, content: 'injected' });
      const err = await waitFor(malloryS, 'error');

      expect(err.code).toBe('FORBIDDEN');
      const after = (await Chat.findById(privateChatId)).messages.length;
      expect(after).toBe(before);
    } finally {
      malloryS.close();
    }
  }, TEST_TIMEOUT);

  test('sender identity comes from the handshake, not the payload', async () => {
    const aliceS = await connect(aliceToken);
    const bobS = await connect(bobToken);
    try {
      bobS.emit('joinChat', privateChatId);
      await waitFor(bobS, 'chatJoined');
      aliceS.emit('joinChat', privateChatId);
      await waitFor(aliceS, 'chatJoined');

      const received = waitFor(bobS, 'newMessage', 2500);
      // Alice tries to attribute the message to Mallory.
      aliceS.emit('sendMessage', {
        chatId: privateChatId,
        content: 'spoof attempt',
        sender: mallory._id.toString(),
      });

      const msg = await received;
      expect(msg).not.toBeNull();
      const senderId = msg.message.sender._id || msg.message.sender;
      expect(String(senderId)).toBe(alice._id.toString());
      expect(String(senderId)).not.toBe(mallory._id.toString());
    } finally {
      aliceS.close();
      bobS.close();
    }
  }, TEST_TIMEOUT);

  test('rejects non-string, empty and oversized content', async () => {
    const aliceS = await connect(aliceToken);
    try {
      for (const bad of [{ chatId: privateChatId, content: { $ne: null } },
                         { chatId: privateChatId, content: '   ' },
                         { chatId: privateChatId, content: 'x'.repeat(1001) }]) {
        aliceS.emit('sendMessage', bad);
        const err = await waitFor(aliceS, 'error');
        expect(err).not.toBeNull();
        expect(err.code).toBe('INVALID_PAYLOAD');
      }
    } finally {
      aliceS.close();
    }
  }, TEST_TIMEOUT);

  test('a client cannot forge a "system" message type', async () => {
    const aliceS = await connect(aliceToken);
    try {
      aliceS.emit('sendMessage', {
        chatId: privateChatId,
        content: 'you have been promoted to admin',
        messageType: 'system',
      });
      const err = await waitFor(aliceS, 'error');
      expect(err.code).toBe('INVALID_PAYLOAD');
    } finally {
      aliceS.close();
    }
  }, TEST_TIMEOUT);
});

// ============================================================
describe('🔌 Socket.IO — typing', () => {
  test('a non-participant cannot broadcast typing into a private chat', async () => {
    const aliceS = await connect(aliceToken);
    const malloryS = await connect(malloryToken);
    try {
      aliceS.emit('joinChat', privateChatId);
      await waitFor(aliceS, 'chatJoined');

      const heard = waitFor(aliceS, 'userTyping', 2000);
      malloryS.emit('typing', { chatId: privateChatId, isTyping: true });

      expect(await heard).toBeNull();
    } finally {
      aliceS.close();
      malloryS.close();
    }
  }, TEST_TIMEOUT);

  test('a participant CAN broadcast typing, attributed to their real identity', async () => {
    const aliceS = await connect(aliceToken);
    const bobS = await connect(bobToken);
    try {
      bobS.emit('joinChat', privateChatId);
      await waitFor(bobS, 'chatJoined');
      aliceS.emit('joinChat', privateChatId);
      await waitFor(aliceS, 'chatJoined');

      const heard = waitFor(bobS, 'userTyping', 2500);
      aliceS.emit('typing', { chatId: privateChatId, isTyping: true, userId: mallory._id.toString() });

      const evt = await heard;
      expect(evt).not.toBeNull();
      // Spoofed userId in the payload is ignored.
      expect(evt.userId).toBe(alice._id.toString());
      expect(evt.isTyping).toBe(true);
    } finally {
      aliceS.close();
      bobS.close();
    }
  }, TEST_TIMEOUT);
});

// ============================================================
describe('🔌 Socket.IO — event rate limiting', () => {
  test('floods are throttled but normal use is not', async () => {
    const aliceS = await connect(aliceToken);
    try {
      aliceS.emit('joinChat', privateChatId);
      await waitFor(aliceS, 'chatJoined');

      // Normal cadence: a handful of messages must all be accepted.
      let rateLimited = 0;
      aliceS.on('error', (e) => {
        if (e.code === 'RATE_LIMITED') rateLimited += 1;
      });

      for (let i = 0; i < 5; i += 1) {
        aliceS.emit('sendMessage', { chatId: privateChatId, content: `normal ${i}` });
      }
      await new Promise((r) => setTimeout(r, 600));
      expect(rateLimited).toBe(0);

      // Flood: well past the 30-per-10s budget.
      for (let i = 0; i < 60; i += 1) {
        aliceS.emit('sendMessage', { chatId: privateChatId, content: `flood ${i}` });
      }
      await new Promise((r) => setTimeout(r, 1200));
      expect(rateLimited).toBeGreaterThan(0);
    } finally {
      aliceS.close();
    }
  }, TEST_TIMEOUT);
});

// ============================================================
describe('🔌 Socket.IO — connection limits & self-audit regressions', () => {
  test('a single account cannot open unlimited sockets (rate-limit bypass)', async () => {
    const { MAX_SOCKETS_PER_USER } = require('../socket');
    const opened = [];
    try {
      for (let i = 0; i < MAX_SOCKETS_PER_USER; i += 1) {
        opened.push(await connect(bobToken));
      }
      expect(opened).toHaveLength(MAX_SOCKETS_PER_USER);
      // One more must be refused.
      await expect(connect(bobToken)).rejects.toThrow(/Too many connections/);
    } finally {
      opened.forEach((s) => s.close());
    }
  }, TEST_TIMEOUT);

  test('closing sockets frees the connection budget', async () => {
    const { MAX_SOCKETS_PER_USER } = require('../socket');
    const opened = [];
    for (let i = 0; i < MAX_SOCKETS_PER_USER; i += 1) opened.push(await connect(bobToken));
    opened.forEach((s) => s.close());
    // Give the server a moment to process the disconnects.
    await new Promise((r) => setTimeout(r, 400));
    const s = await connect(bobToken);
    expect(s.connected).toBe(true);
    s.close();
  }, TEST_TIMEOUT);

  test('the presence broadcast exposes only a user id, not name/avatar', async () => {
    const listener = await connect(aliceToken);
    try {
      const heard = waitFor(listener, 'userOnline', 3000);
      const joiner = await connect(bobToken);
      const evt = await heard;
      joiner.close();

      expect(evt).not.toBeNull();
      expect(evt.userId).toBe(bob._id.toString());
      // The old payload also shipped userInfo{name, username, avatar} to every
      // connected socket regardless of any relationship.
      expect(evt.userInfo).toBeUndefined();
      expect(Object.keys(evt)).toEqual(['userId']);
    } finally {
      listener.close();
    }
  }, TEST_TIMEOUT);
});
