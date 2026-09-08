/**
 * Multi-instance Socket.IO tests.
 *
 * These exist so the claim "this app can run more than one instance" is backed
 * by evidence rather than by the presence of a dependency. Two independent
 * Socket.IO servers are started on two HTTP servers — the same shape as two
 * processes behind a load balancer — and the tests assert that:
 *
 *   1. a room broadcast from instance A reaches a client connected to instance B
 *      (this is what the Redis adapter buys, and what fails without it);
 *   2. the per-account connection cap is a CLUSTER cap, not a per-process one;
 *   3. presence is announced once per account, not once per instance.
 *
 * The whole suite self-skips when no Redis is reachable, matching the pattern in
 * cache.security.test.js, so the suite still runs in environments without one.
 */

const net = require('net');
const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const mongoose = require('mongoose');

const User = require('../models/User');
const Chat = require('../models/Chat');

const TEST_TIMEOUT = 30000;
const REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379';

// initSocket reads REDIS_URL to decide whether to attach the adapter. jestSetup
// deletes it so no other suite touches Redis; it is restored in afterAll.
const ORIGINAL_REDIS_URL = process.env.REDIS_URL;
process.env.REDIS_URL = REDIS_URL;

const { initSocket, MAX_SOCKETS_PER_USER } = require('../socket');

function probeRedis() {
  return new Promise((resolve) => {
    const url = new URL(REDIS_URL);
    const sock = net
      .connect({ host: url.hostname, port: Number(url.port || 6379) })
      .on('connect', () => {
        sock.end();
        resolve(true);
      })
      .on('error', () => resolve(false));
    sock.setTimeout(1000, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

/** One simulated application instance. */
async function startInstance() {
  const httpServer = http.createServer();
  const ioServer = new Server(httpServer, { cors: { origin: '*' } });
  const runtime = await initSocket(ioServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));

  return {
    io: ioServer,
    runtime,
    port: httpServer.address().port,
    async stop() {
      await runtime.close();
      ioServer.close();
      await new Promise((r) => httpServer.close(r));
    },
  };
}

function connect(port, token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
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

function waitFor(socket, event, ms = 3000) {
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

let redisAvailable = false;
let instanceA;
let instanceB;
let alice;
let bob;
let aliceToken;
let bobToken;
let chatId;
const open = [];

beforeAll(async () => {
  redisAvailable = await probeRedis();
  if (!redisAvailable) return;

  await mongoose.connect(process.env.MONGODB_URI);

  const stamp = Date.now();
  const mk = async (name) => {
    const u = new User({
      name,
      email: `multi_${name}_${stamp}@test.com`,
      username: `multi${name}${stamp}`.toLowerCase().slice(0, 20),
      password: 'multiPassword123',
    });
    await u.save();
    return u;
  };

  alice = await mk('alice');
  bob = await mk('bob');
  aliceToken = alice.generateAuthToken();
  bobToken = bob.generateAuthToken();

  const chat = await Chat.create({
    chatType: 'direct',
    participants: [alice._id, bob._id],
    messages: [],
  });
  chatId = chat._id.toString();

  instanceA = await startInstance();
  instanceB = await startInstance();
}, TEST_TIMEOUT);

afterEach(() => {
  while (open.length) {
    const s = open.pop();
    try {
      s.close();
    } catch {
      /* already closed */
    }
  }
});

afterAll(async () => {
  // Close client sockets before the servers, so disconnects are processed while
  // the adapter's Redis connections are still up.
  while (open.length) {
    const s = open.pop();
    try {
      s.close();
    } catch {
      /* already closed */
    }
  }
  await new Promise((r) => setTimeout(r, 150));

  if (instanceA) await instanceA.stop();
  if (instanceB) await instanceB.stop();

  if (redisAvailable) {
    await User.deleteMany({ email: /multi_.*@test\.com/ });
    await Chat.deleteMany({ participants: alice ? alice._id : null });
    await mongoose.connection.close();
  }

  if (ORIGINAL_REDIS_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_REDIS_URL;
}, TEST_TIMEOUT);

/**
 * Runtime guard rather than `describe.skip`: a describe modifier is evaluated
 * when the file is collected, which is BEFORE beforeAll has probed Redis, so it
 * would always skip. This matches the pattern in cache.security.test.js.
 */
const skipIfNoRedis = () => {
  if (!redisAvailable) {
    console.warn('⚠️  Skipping multi-instance socket tests — no Redis at ' + REDIS_URL);
    return true;
  }
  return false;
};

describe('🌐 Multi-instance Socket.IO (real Redis adapter)', () => {
  test('the adapter is actually attached, not silently skipped', () => {
    if (skipIfNoRedis()) return;
    // If this fails, every other assertion in this file would be testing a
    // single-instance fallback and passing for the wrong reason.
    expect(instanceA.io.of('/').adapter.constructor.name).toBe('RedisAdapter');
    expect(instanceB.io.of('/').adapter.constructor.name).toBe('RedisAdapter');
  });

  test(
    'a message sent on instance A reaches a participant connected to instance B',
    async () => {
      if (skipIfNoRedis()) return;
      const aliceSocket = await connect(instanceA.port, aliceToken);
      const bobSocket = await connect(instanceB.port, bobToken);
      open.push(aliceSocket, bobSocket);

      // Both join the same chat room, but on different instances.
      aliceSocket.emit('joinChat', chatId);
      bobSocket.emit('joinChat', chatId);
      await Promise.all([waitFor(aliceSocket, 'chatJoined'), waitFor(bobSocket, 'chatJoined')]);

      const received = waitFor(bobSocket, 'newMessage', 5000);
      aliceSocket.emit('sendMessage', {
        chatId,
        content: 'crossing the instance boundary',
        messageType: 'text',
      });

      const payload = await received;

      // Without the Redis adapter this is null: instance A's io.to(room) would
      // only reach sockets held by instance A.
      expect(payload).not.toBeNull();
      expect(payload.chatId).toBe(chatId);
      expect(payload.message.content).toBe('crossing the instance boundary');
    },
    TEST_TIMEOUT
  );

  test(
    'authorization still holds across instances — a non-participant gets nothing',
    async () => {
      if (skipIfNoRedis()) return;
      const stamp = Date.now();
      const mallory = new User({
        name: 'multi mallory',
        email: `multi_mallory_${stamp}@test.com`,
        username: `multimallory${stamp}`.toLowerCase().slice(0, 20),
        password: 'multiPassword123',
      });
      await mallory.save();

      const aliceSocket = await connect(instanceA.port, aliceToken);
      const mallorySocket = await connect(instanceB.port, mallory.generateAuthToken());
      open.push(aliceSocket, mallorySocket);

      aliceSocket.emit('joinChat', chatId);
      await waitFor(aliceSocket, 'chatJoined');

      // Mallory tries to subscribe to a chat she is not part of.
      mallorySocket.emit('joinChat', chatId);
      const denial = await waitFor(mallorySocket, 'error', 3000);
      expect(denial).not.toBeNull();
      expect(denial.code).toBe('CHAT_NOT_FOUND');

      const leaked = waitFor(mallorySocket, 'newMessage', 2500);
      aliceSocket.emit('sendMessage', { chatId, content: 'private', messageType: 'text' });

      expect(await leaked).toBeNull();
    },
    TEST_TIMEOUT
  );

  test(
    'the per-account connection cap is enforced across instances, not per instance',
    async () => {
      if (skipIfNoRedis()) return;
      // Spread the allowed connections over both instances.
      const sockets = [];
      for (let i = 0; i < MAX_SOCKETS_PER_USER; i += 1) {
        const port = i % 2 === 0 ? instanceA.port : instanceB.port;
        sockets.push(await connect(port, bobToken));
      }
      open.push(...sockets);

      // One more, on either instance, must be refused. Before presence moved to
      // Redis this would have succeeded: each process counted only its own.
      await expect(connect(instanceA.port, bobToken)).rejects.toThrow(/Too many connections/);
    },
    TEST_TIMEOUT
  );

  test(
    'userOnline is announced once per account, not once per connection',
    async () => {
      const observer = await connect(instanceA.port, aliceToken);
      open.push(observer);

      const first = waitFor(observer, 'userOnline', 3000);
      const bob1 = await connect(instanceB.port, bobToken);
      open.push(bob1);

      const firstPayload = await first;
      expect(firstPayload).not.toBeNull();
      expect(firstPayload.userId).toBe(bob._id.toString());

      // A second tab for the same account must NOT re-announce.
      const second = waitFor(observer, 'userOnline', 2500);
      const bob2 = await connect(instanceA.port, bobToken);
      open.push(bob2);

      expect(await second).toBeNull();
    },
    TEST_TIMEOUT
  );

  test(
    'userOffline fires only when the account\'s LAST connection closes',
    async () => {
      if (skipIfNoRedis()) return;
      const observer = await connect(instanceA.port, aliceToken);
      const bob1 = await connect(instanceA.port, bobToken);
      const bob2 = await connect(instanceB.port, bobToken);
      open.push(observer);

      // Closing one of two tabs must not report the user offline.
      const premature = waitFor(observer, 'userOffline', 2500);
      bob1.close();
      expect(await premature).toBeNull();

      // Closing the last one must.
      const offline = waitFor(observer, 'userOffline', 5000);
      bob2.close();
      const payload = await offline;
      expect(payload).not.toBeNull();
      expect(payload.userId).toBe(bob._id.toString());
    },
    TEST_TIMEOUT
  );
});
