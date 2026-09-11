/**
 * Token revocation tests.
 *
 * Before this feature existed, `checkAccountState` compared `decoded.tv` against
 * `user.tokenVersion` on every request — but nothing in the application ever
 * incremented the field, so no token could actually be revoked and "logout" was
 * a purely client-side gesture. These tests assert the mechanism now works end
 * to end, and that it works for the socket handshake too (which shares the same
 * verification path).
 */

const http = require('http');
const request = require('supertest');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

const app = require('../app');
const User = require('../models/User');
const { initSocket } = require('../socket');

const TEST_TIMEOUT = 25000;
const PASSWORD = 'originalPassword123';

let user;
let tokenA; // "phone"
let tokenB; // "laptop"

async function login(identifier, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ identifier, password });
  return res.body.token;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
}, TEST_TIMEOUT);

beforeEach(async () => {
  await User.deleteMany({ email: /revoke.*@test\.com/ });

  user = new User({
    name: 'Revoke Tester',
    email: `revoke${Date.now()}@test.com`,
    username: `revoke${Date.now()}`,
    password: PASSWORD,
  });
  await user.save();

  tokenA = await login(user.email);
  tokenB = await login(user.email);
}, TEST_TIMEOUT);

afterAll(async () => {
  await User.deleteMany({ email: /revoke.*@test\.com/ });
  await mongoose.connection.close();
}, TEST_TIMEOUT);

describe('🔐 Token revocation — logout', () => {
  test('both sessions work before logout', async () => {
    for (const t of [tokenA, tokenB]) {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(200);
    }
  });

  test('logout revokes the token that called it', async () => {
    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${tokenA}`);
    expect(out.status).toBe(200);
    expect(out.body.success).toBe(true);

    const after = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenA}`);
    expect(after.status).toBe(401);
    expect(after.body.code).toBe('TOKEN_REVOKED');
  });

  test('logout revokes EVERY session for the account — this is deliberate', async () => {
    // Stateless tokens carry no per-session identity, so single-device logout is
    // not possible without a session store. The documented trade-off is that
    // logout is "sign out everywhere". Asserted so the behaviour cannot change
    // silently.
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${tokenA}`);

    const other = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenB}`);
    expect(other.status).toBe(401);
    expect(other.body.code).toBe('TOKEN_REVOKED');
  });

  test('tokenVersion is actually incremented in the database', async () => {
    const before = await User.findById(user._id).select('tokenVersion').lean();
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${tokenA}`);
    const after = await User.findById(user._id).select('tokenVersion').lean();

    expect(after.tokenVersion).toBe((before.tokenVersion || 0) + 1);
  });

  test('logging in again after logout works and yields a usable token', async () => {
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${tokenA}`);

    const fresh = await login(user.email);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${fresh}`);
    expect(res.status).toBe(200);
  });

  test('logout requires authentication', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  test('tokenVersion is never exposed in a response body', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenA}`);
    expect(JSON.stringify(res.body)).not.toMatch(/tokenVersion/);
  });
});

describe('🔐 Token revocation — change password', () => {
  test('changing the password revokes other sessions but keeps the caller signed in', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'brandNewPassword456',
        confirmPassword: 'brandNewPassword456',
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    // The other device is signed out...
    const other = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenB}`);
    expect(other.status).toBe(401);
    expect(other.body.code).toBe('TOKEN_REVOKED');

    // ...and the replacement token issued to the caller works.
    const self = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(self.status).toBe(200);
  });

  test('the new password actually works and the old one does not', async () => {
    await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'brandNewPassword456',
        confirmPassword: 'brandNewPassword456',
      });

    expect(await login(user.email, 'brandNewPassword456')).toBeTruthy();
    expect(await login(user.email, PASSWORD)).toBeUndefined();
  });

  test('the password is stored hashed, not in cleartext', async () => {
    await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'brandNewPassword456',
        confirmPassword: 'brandNewPassword456',
      });

    const stored = await User.findById(user._id).select('+password').lean();
    expect(stored.password).not.toBe('brandNewPassword456');
    expect(stored.password).toMatch(/^\$2[aby]\$/); // bcrypt
  });

  test('a wrong current password is rejected and changes nothing', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        currentPassword: 'notTheRightPassword',
        newPassword: 'brandNewPassword456',
        confirmPassword: 'brandNewPassword456',
      });

    expect(res.status).toBe(401);
    // The other session must NOT have been revoked by a failed attempt.
    const other = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokenB}`);
    expect(other.status).toBe(200);
  });

  test('a mismatched confirmation is rejected by validation', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        currentPassword: PASSWORD,
        newPassword: 'brandNewPassword456',
        confirmPassword: 'somethingElse789',
      });

    expect(res.status).toBe(400);
  });

  test('the response never echoes any password value', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currentPassword: PASSWORD, newPassword: 'short', confirmPassword: 'short' });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('short');
    expect(body).not.toContain(PASSWORD);
  });
});

describe('🔐 Revocation applies to the Socket.IO handshake too', () => {
  let httpServer;
  let ioServer;
  let port;

  beforeAll(async () => {
    httpServer = http.createServer();
    ioServer = new Server(httpServer, { cors: { origin: '*' } });
    await initSocket(ioServer, { skipAdapter: true });
    await new Promise((resolve) => httpServer.listen(0, resolve));
    port = httpServer.address().port;
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (ioServer) ioServer.close();
    if (httpServer) await new Promise((r) => httpServer.close(r));
  }, TEST_TIMEOUT);

  function tryConnect(token) {
    return new Promise((resolve) => {
      const socket = ioClient(`http://127.0.0.1:${port}`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      const done = (result) => {
        socket.close();
        resolve(result);
      };
      socket.on('connect', () => done({ connected: true }));
      socket.on('connect_error', (err) => done({ connected: false, message: err.message }));
      setTimeout(() => done({ connected: false, message: 'timeout' }), 6000);
    });
  }

  test('a revoked token cannot open a socket', async () => {
    expect((await tryConnect(tokenA)).connected).toBe(true);

    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${tokenA}`);

    const after = await tryConnect(tokenA);
    expect(after.connected).toBe(false);
    expect(after.message).toBe('Authentication error');
  }, TEST_TIMEOUT);
});
