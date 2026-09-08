/**
 * Chat REST tests, with an emphasis on the read-receipt feature.
 *
 * `Chat.messages.readBy` was declared in the schema and consumed by the unread
 * count aggregation in the chat list, but nothing ever wrote to it: the frontend
 * called `PUT /api/chats/:chatId/read` and received a 404, so the unread badge
 * could only ever grow. These tests cover the write side and the authorization
 * around it.
 */

const request = require('supertest');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const Chat = require('../models/Chat');

const TEST_TIMEOUT = 25000;
const PASSWORD = 'chatPassword123';

let alice, bob, mallory;
let aliceToken, bobToken, malloryToken;
let chatId;

async function makeUser(tag) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const u = new User({
    name: `Chat ${tag}`,
    email: `chat${tag}${stamp}@test.com`,
    username: `chat${tag}${stamp}`.toLowerCase().slice(0, 20),
    password: PASSWORD,
  });
  await u.save();
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier: u.email, password: PASSWORD });
  return { user: u, token: res.body.token };
}

/** Append a message directly, bypassing the socket path. */
async function sendMessage(chat, senderId, content) {
  chat.messages.push({ sender: senderId, content, messageType: 'text' });
  chat.lastMessage = { content, sender: senderId, timestamp: new Date() };
  await chat.save();
}

async function unreadFor(token) {
  const res = await request(app).get('/api/chats').set('Authorization', `Bearer ${token}`);
  const found = res.body.chats.find((c) => c._id.toString() === chatId.toString());
  return found ? found.unreadCount : null;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
}, TEST_TIMEOUT);

beforeEach(async () => {
  await Chat.deleteMany({});
  await User.deleteMany({ email: /chat.*@test\.com/ });

  ({ user: alice, token: aliceToken } = await makeUser('alice'));
  ({ user: bob, token: bobToken } = await makeUser('bob'));
  ({ user: mallory, token: malloryToken } = await makeUser('mallory'));

  const chat = new Chat({
    chatType: 'direct',
    participants: [alice._id, bob._id],
    messages: [],
  });
  await chat.save();
  chatId = chat._id;

  // Bob sends three messages; Alice has read none of them.
  await sendMessage(chat, bob._id, 'first message from bob');
  await sendMessage(chat, bob._id, 'second message from bob');
  await sendMessage(chat, bob._id, 'third message from bob');
}, TEST_TIMEOUT);

afterAll(async () => {
  await Chat.deleteMany({});
  await User.deleteMany({ email: /chat.*@test\.com/ });
  await mongoose.connection.close();
}, TEST_TIMEOUT);

describe('💬 Chat list and unread counts', () => {
  test('a participant sees the chat with an accurate unread count', async () => {
    expect(await unreadFor(aliceToken)).toBe(3);
  });

  test("your own messages never count as unread for you", async () => {
    expect(await unreadFor(bobToken)).toBe(0);
  });

  test('the chat list never ships message bodies', async () => {
    const res = await request(app).get('/api/chats').set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(200);
    expect(res.body.chats[0].messages).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('first message from bob');
  });

  test('a non-participant does not see the chat at all', async () => {
    const res = await request(app).get('/api/chats').set('Authorization', `Bearer ${malloryToken}`);
    expect(res.status).toBe(200);
    expect(res.body.chats).toHaveLength(0);
  });
});

describe('💬 PUT /:chatId/read — the write side that was missing', () => {
  test('marking read clears the unread count', async () => {
    expect(await unreadFor(aliceToken)).toBe(3);

    const res = await request(app)
      .put(`/api/chats/${chatId}/read`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.unreadCount).toBe(0);

    expect(await unreadFor(aliceToken)).toBe(0);
  });

  test('readBy is actually persisted for the right user', async () => {
    await request(app)
      .put(`/api/chats/${chatId}/read`)
      .set('Authorization', `Bearer ${aliceToken}`);

    const chat = await Chat.findById(chatId).lean();
    for (const m of chat.messages) {
      expect(m.readBy.map((r) => r.user.toString())).toContain(alice._id.toString());
    }
  });

  test('it is idempotent — calling twice does not append duplicate receipts', async () => {
    await request(app).put(`/api/chats/${chatId}/read`).set('Authorization', `Bearer ${aliceToken}`);
    const second = await request(app)
      .put(`/api/chats/${chatId}/read`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(second.status).toBe(200);

    const chat = await Chat.findById(chatId).lean();
    for (const m of chat.messages) {
      const mine = m.readBy.filter((r) => r.user.toString() === alice._id.toString());
      expect(mine).toHaveLength(1);
    }
  });

  test('marking read does not affect the other participant', async () => {
    await sendMessage(await Chat.findById(chatId), alice._id, 'a reply from alice');
    expect(await unreadFor(bobToken)).toBe(1);

    await request(app).put(`/api/chats/${chatId}/read`).set('Authorization', `Bearer ${aliceToken}`);

    expect(await unreadFor(bobToken)).toBe(1); // still unread for Bob
  });

  test('new messages after a read are unread again', async () => {
    await request(app).put(`/api/chats/${chatId}/read`).set('Authorization', `Bearer ${aliceToken}`);
    expect(await unreadFor(aliceToken)).toBe(0);

    await sendMessage(await Chat.findById(chatId), bob._id, 'a fourth message');
    expect(await unreadFor(aliceToken)).toBe(1);
  });

  test('a non-participant cannot mark a chat read, and cannot tell it exists', async () => {
    const res = await request(app)
      .put(`/api/chats/${chatId}/read`)
      .set('Authorization', `Bearer ${malloryToken}`);

    // 404, not 403: the same answer as a nonexistent chat, so this cannot be
    // used to probe which chat ids are real.
    expect(res.status).toBe(404);

    const chat = await Chat.findById(chatId).lean();
    const readers = chat.messages.flatMap((m) => m.readBy.map((r) => r.user.toString()));
    expect(readers).not.toContain(mallory._id.toString());
  });

  test('requires authentication', async () => {
    const res = await request(app).put(`/api/chats/${chatId}/read`);
    expect(res.status).toBe(401);
  });

  test('rejects a malformed chat id', async () => {
    const res = await request(app)
      .put('/api/chats/not-an-object-id/read')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(400);
  });

  test('marking read does not reorder the chat list', async () => {
    // GET /api/chats sorts by updatedAt desc. Marking a chat read must not look
    // like new activity, so the read update runs with timestamps disabled.
    const before = await Chat.findById(chatId).select('updatedAt').lean();

    await request(app).put(`/api/chats/${chatId}/read`).set('Authorization', `Bearer ${aliceToken}`);

    const after = await Chat.findById(chatId).select('updatedAt').lean();
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  test('a nonexistent chat id returns 404', async () => {
    const res = await request(app)
      .put(`/api/chats/${new mongoose.Types.ObjectId()}/read`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(res.status).toBe(404);
  });
});

describe('💬 Message history authorization', () => {
  test('a participant can page the history', async () => {
    const res = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(3);
    expect(res.body.pagination.totalMessages).toBe(3);
  });

  test('a non-participant is refused', async () => {
    const res = await request(app)
      .get(`/api/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${malloryToken}`);
    expect(res.status).toBe(403);
  });
});

describe('💬 Direct chat creation', () => {
  test('creating the same direct chat twice returns the existing one', async () => {
    const first = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: mallory._id.toString() });

    const second = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: mallory._id.toString() });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.chat._id).toBe(first.body.chat._id);
  });

  test('you cannot create a chat with yourself', async () => {
    const res = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: alice._id.toString() });
    expect(res.status).toBe(400);
  });

  test('a malformed user id is a 400, not a 500', async () => {
    const res = await request(app)
      .post('/api/chats/direct')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ userId: 'nonsense' });
    expect(res.status).toBe(400);
  });
});
