/**
 * Security regression tests.
 *
 * Each test asserts the security *property* (did the privileged field actually
 * change in the database? did the attacker actually read the data?), not merely
 * that some status code came back.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../app');
const User = require('../models/User');
const Story = require('../models/Story');
const { ALGORITHM, ISSUER, AUDIENCE } = require('../utils/token');
const { assertSafeTestDatabase } = require('./setup/guardTestDatabase');

const TEST_TIMEOUT = 30000;
const stamp = Date.now();

let victim; // owns a story
let attacker; // authenticated, but owns nothing
let victimToken;
let attackerToken;
let victimStoryId;

const mkUser = async (label) => {
  const u = new User({
    name: `Sec ${label} ${stamp}`,
    email: `sec${label}${stamp}@sectest.com`,
    username: `sec${label}${stamp}`.slice(0, 20),
    password: 'Test123!@#',
    isVerified: true,
  });
  await u.save();
  return u;
};

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  victim = await mkUser('victim');
  attacker = await mkUser('attacker');
  victimToken = victim.generateAuthToken();
  attackerToken = attacker.generateAuthToken();

  const story = await new Story({
    title: 'The Victim Story That Should Stay Untouched',
    content: 'Legitimate story content that is definitely long enough. '.repeat(5),
    category: 'business',
    author: victim._id,
    authorUsername: victim.username,
    status: 'published',
  }).save();
  victimStoryId = story._id.toString();
}, TEST_TIMEOUT);

afterAll(async () => {
  await Story.deleteMany({ author: { $in: [victim._id, attacker._id] } });
  // Broadened from /@sectest\.com$/: the TLD tests create users on
  // sectest.dev / .tech / .online / .info / .io and mail.sub.sectest.co.uk.
  await User.deleteMany({ email: { $regex: /sectest\./ } });
  await mongoose.connection.close();
}, TEST_TIMEOUT);

// ============================================================
describe('🛡️  Test-database safety guard', () => {
  test('refuses a production-shaped Atlas URI', () => {
    expect(() =>
      assertSafeTestDatabase({
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb+srv://u:p@cluster0.abc.mongodb.net/failfixesDB',
      })
    ).toThrow(/REFUSING TO RUN TESTS/);
  });

  test('refuses a local URI whose database is not a test database', () => {
    expect(() =>
      assertSafeTestDatabase({
        NODE_ENV: 'test',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/failfixesDB',
      })
    ).toThrow(/does not contain "test"/);
  });

  test('the URI actually in use right now is a safe one', () => {
    expect(() => assertSafeTestDatabase(process.env)).not.toThrow();
  });
});

// ============================================================
describe('🛡️  Mass assignment — profile update', () => {
  const put = (body, token = attackerToken) =>
    request(app).put('/api/users/me/profile').set('Authorization', `Bearer ${token}`).send(body);

  test('cannot escalate to admin', async () => {
    const res = await put({ role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FORBIDDEN_FIELDS');

    const fresh = await User.findById(attacker._id);
    expect(fresh.role).toBe('user'); // the property that matters
  });

  test('cannot write a password (which would bypass bcrypt and store cleartext)', async () => {
    const before = await User.findById(attacker._id).select('+password');
    const res = await put({ password: 'cleartext-pwned' });
    expect(res.status).toBe(400);

    const after = await User.findById(attacker._id).select('+password');
    expect(after.password).toBe(before.password);
    expect(after.password).not.toBe('cleartext-pwned');
    // still a bcrypt hash, and the original password still works
    expect(after.password).toMatch(/^\$2[aby]\$/);
    expect(await after.comparePassword('Test123!@#')).toBe(true);
  });

  test('cannot forge stats, followers or verification state', async () => {
    for (const payload of [
      { stats: { followersCount: 99999 } },
      { followers: [victim._id.toString()] },
      { following: [victim._id.toString()] },
      { likedStories: [victimStoryId] },
      { isVerified: true },
      { isActive: false },
      { tokenVersion: 999 },
      { email: `hijack${stamp}@sectest.com` },
      { username: 'newname' },
      { _id: new mongoose.Types.ObjectId().toString() },
    ]) {
      const res = await put(payload);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FORBIDDEN_FIELDS');
    }

    const fresh = await User.findById(attacker._id);
    expect(fresh.stats.followersCount).toBe(0);
    expect(fresh.followers).toHaveLength(0);
    expect(fresh.isVerified).toBe(true); // unchanged from creation
    expect(fresh.isActive).toBe(true);
    expect(fresh.tokenVersion).toBe(0);
    expect(fresh.email).toBe(`secattacker${stamp}@sectest.com`.toLowerCase());
  }, TEST_TIMEOUT);

  test('legitimate fields still update, including nested preferences', async () => {
    const res = await put({
      bio: 'A perfectly normal bio',
      location: 'Bengaluru',
      preferences: { showEmail: true },
    });
    expect(res.status).toBe(200);

    const fresh = await User.findById(attacker._id);
    expect(fresh.bio).toBe('A perfectly normal bio');
    expect(fresh.location).toBe('Bengaluru');
    expect(fresh.preferences.showEmail).toBe(true);
    // A nested $set must not have clobbered sibling preference fields.
    expect(fresh.preferences.profileVisibility).toBe('public');
    expect(fresh.preferences.emailNotifications).toBe(true);
  });

  test('a mixed payload is rejected wholesale, not partially applied', async () => {
    const res = await put({ bio: 'should not persist', role: 'admin' });
    expect(res.status).toBe(400);

    const fresh = await User.findById(attacker._id);
    expect(fresh.bio).toBe('A perfectly normal bio'); // from the previous test
    expect(fresh.role).toBe('user');
  });
});

// ============================================================
describe('🛡️  Mass assignment — story update', () => {
  const put = (body, token = victimToken) =>
    request(app)
      .put(`/api/stories/${victimStoryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  test('the author cannot reassign ownership to someone else', async () => {
    const res = await put({ author: attacker._id.toString() });
    expect(res.status).toBe(400);

    const fresh = await Story.findById(victimStoryId);
    expect(fresh.author.toString()).toBe(victim._id.toString());
  });

  test('the author cannot forge likes, views or comments', async () => {
    for (const payload of [
      { likes: [attacker._id.toString()] },
      { stats: { views: 1000000, likes: 1000000 } },
      { comments: [{ user: attacker._id.toString(), content: 'fabricated' }] },
      { bookmarks: [attacker._id.toString()] },
    ]) {
      expect((await put(payload)).status).toBe(400);
    }

    const fresh = await Story.findById(victimStoryId);
    expect(fresh.likes).toHaveLength(0);
    expect(fresh.comments).toHaveLength(0);
    expect(fresh.stats.views).toBe(0);
    expect(fresh.stats.likes).toBe(0);
  }, TEST_TIMEOUT);

  test('the author cannot set featured / moderationStatus / createdAt', async () => {
    const before = await Story.findById(victimStoryId);
    for (const payload of [
      { featured: true },
      { moderationStatus: 'approved' },
      { createdAt: '2001-01-01T00:00:00.000Z' },
      { authorUsername: 'someone-else' },
      { slug: 'custom-slug' },
    ]) {
      expect((await put(payload)).status).toBe(400);
    }

    const fresh = await Story.findById(victimStoryId);
    expect(fresh.featured).toBe(false);
    expect(fresh.authorUsername).toBe(victim.username);
    expect(fresh.createdAt.toISOString()).toBe(before.createdAt.toISOString());
  }, TEST_TIMEOUT);

  test('legitimate content edits still work', async () => {
    const res = await put({
      title: 'An Updated Legitimate Title For The Story',
      content: 'Updated but still long enough content for the validator. '.repeat(5),
    });
    expect(res.status).toBe(200);

    const fresh = await Story.findById(victimStoryId);
    expect(fresh.title).toBe('An Updated Legitimate Title For The Story');
  });
});

// ============================================================
describe('🛡️  IDOR / BOLA', () => {
  test("a user cannot update another user's story", async () => {
    const res = await request(app)
      .put(`/api/stories/${victimStoryId}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ title: 'Hijacked By An Attacker Account' });

    expect(res.status).toBe(403);
    const fresh = await Story.findById(victimStoryId);
    expect(fresh.title).not.toBe('Hijacked By An Attacker Account');
  });

  test("a user cannot delete another user's story", async () => {
    const res = await request(app)
      .delete(`/api/stories/${victimStoryId}`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(403);
    expect(await Story.findById(victimStoryId)).not.toBeNull();
  });

  test("a user cannot read another user's chat messages over REST", async () => {
    const Chat = require('../models/Chat');
    const third = await mkUser('third');
    const chat = await new Chat({
      chatType: 'direct',
      participants: [victim._id, third._id],
      messages: [{ sender: victim._id, content: 'private rest message' }],
    }).save();

    const res = await request(app)
      .get(`/api/chats/${chat._id}/messages`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain('private rest message');
  }, TEST_TIMEOUT);
});

// ============================================================
describe('🛡️  JWT verification', () => {
  const me = (token) =>
    request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

  test('a valid token works', async () => {
    expect((await me(victimToken)).status).toBe(200);
  });

  test('an expired token is rejected', async () => {
    const expired = jwt.sign({ id: victim._id, tv: 0 }, process.env.JWT_SECRET, {
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '-1s',
    });
    const res = await me(expired);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  test('a token signed with a different secret is rejected', async () => {
    const forged = jwt.sign({ id: victim._id, tv: 0 }, 'some-other-secret-that-is-long-enough!!', {
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    expect((await me(forged)).status).toBe(401);
  });

  test('an unsigned "alg: none" token is rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ id: victim._id, tv: 0, iss: ISSUER, aud: AUDIENCE })
    ).toString('base64url');
    expect((await me(`${header}.${body}.`)).status).toBe(401);
  });

  test('a token with the wrong issuer or audience is rejected', async () => {
    const wrongIss = jwt.sign({ id: victim._id, tv: 0 }, process.env.JWT_SECRET, {
      algorithm: ALGORITHM,
      issuer: 'not-failfixes',
      audience: AUDIENCE,
    });
    const wrongAud = jwt.sign({ id: victim._id, tv: 0 }, process.env.JWT_SECRET, {
      algorithm: ALGORITHM,
      issuer: ISSUER,
      audience: 'not-failfixes-api',
    });
    expect((await me(wrongIss)).status).toBe(401);
    expect((await me(wrongAud)).status).toBe(401);
  });

  test('a token for a deleted account is rejected', async () => {
    const ghost = await mkUser('ghost');
    const ghostToken = ghost.generateAuthToken();
    expect((await me(ghostToken)).status).toBe(200);

    await User.findByIdAndDelete(ghost._id);
    const res = await me(ghostToken);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  }, TEST_TIMEOUT);

  test('the response never contains a password hash', async () => {
    const res = await me(victimToken);
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.tokenVersion).toBeUndefined();
  });
});

// ============================================================
describe('🛡️  Account state & revocation', () => {
  test('a deactivated account cannot use a still-valid token', async () => {
    const u = await mkUser('deact');
    const token = u.generateAuthToken();

    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);

    await User.findByIdAndUpdate(u._id, { isActive: false });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_DEACTIVATED');

    // ...and cannot perform a write either
    const write = await request(app)
      .put('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'still here?' });
    expect(write.status).toBe(403);
  }, TEST_TIMEOUT);

  test('bumping tokenVersion revokes previously issued tokens immediately', async () => {
    const u = await mkUser('revoke');
    const oldToken = u.generateAuthToken();

    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`)).status).toBe(200);

    await User.findByIdAndUpdate(u._id, { $inc: { tokenVersion: 1 } });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REVOKED');

    // a freshly issued token still works
    const refreshed = await User.findById(u._id);
    const newToken = refreshed.generateAuthToken();
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${newToken}`)).status).toBe(200);
  }, TEST_TIMEOUT);

  test('optionalAuth also refuses a deactivated account (no personalised data)', async () => {
    const u = await mkUser('optdeact');
    const token = u.generateAuthToken();
    const liked = await Story.findById(victimStoryId);
    liked.likes.push(u._id);
    await liked.save();

    const before = await request(app)
      .get(`/api/stories/${victimStoryId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(before.body.story.isLiked).toBe(true);

    await User.findByIdAndUpdate(u._id, { isActive: false });

    const after = await request(app)
      .get(`/api/stories/${victimStoryId}`)
      .set('Authorization', `Bearer ${token}`);
    // Request still succeeds (it's a public endpoint) but is no longer personalised.
    expect(after.status).toBe(200);
    expect(after.body.story.isLiked).toBe(false);

    liked.likes = [];
    await liked.save();
  }, TEST_TIMEOUT);
});

// ============================================================
describe('🛡️  NoSQL operator & regex injection', () => {
  test('operator objects in query params do not reach the query', async () => {
    // ?authorUsername[$ne]= previously became { authorUsername: { $ne: ... } }
    const res = await request(app).get('/api/stories?authorUsername[$ne]=zzz&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Filter echoed back must not be an operator object.
    expect(typeof res.body.filters.authorUsername === 'object').toBe(false);
  });

  test('an operator object in ?status is ignored rather than injected', async () => {
    const res = await request(app)
      .get('/api/users/me/stories?status[$ne]=published')
      .set('Authorization', `Bearer ${victimToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('a sort-field injection attempt is ignored', async () => {
    const res = await request(app)
      .get('/api/users/me/stories?sort[$where]=1')
      .set('Authorization', `Bearer ${victimToken}`);
    expect(res.status).toBe(200);
  });

  test('a regex metacharacter username matches literally, not as a pattern', async () => {
    // `.*` previously matched an arbitrary user via new RegExp(`^${username}$`)
    const res = await request(app).get('/api/users/profile/.*');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('a ReDoS pattern in search completes quickly and returns normally', async () => {
    const evil = '(a+)+$' + 'a'.repeat(40);
    const started = Date.now();
    const res = await request(app).get(`/api/stories?search=${encodeURIComponent(evil)}`);
    const elapsed = Date.now() - started;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(5000);
    // Escaped, so it is a literal search that matches nothing.
    expect(res.body.stories).toHaveLength(0);
  }, TEST_TIMEOUT);

  test('an over-long search term is rejected by validation', async () => {
    const res = await request(app).get(`/api/stories?search=${'x'.repeat(500)}`);
    expect(res.status).toBe(400);
  });
});

// ============================================================
describe('🛡️  AI endpoint', () => {
  const gen = (body, token) => {
    const r = request(app).post('/api/ai/generate-story');
    if (token) r.set('Authorization', `Bearer ${token}`);
    return r.send(body);
  };

  test('requires authentication (was a public LLM proxy)', async () => {
    const res = await gen({ prompt: 'write me a story about failure' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('NO_TOKEN');
  });

  test('rejects an invalid token', async () => {
    const res = await gen({ prompt: 'write me a story' }, 'garbage.token.here');
    expect(res.status).toBe(401);
  });

  test('rejects a missing / non-string prompt', async () => {
    for (const body of [{}, { prompt: 123 }, { prompt: { $ne: null } }, { prompt: ['a'] }]) {
      const res = await gen(body, victimToken);
      expect(res.status).toBe(400);
    }
  });

  test('rejects an oversized prompt before any upstream call', async () => {
    const res = await gen({ prompt: 'x'.repeat(5000) }, victimToken);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/2000/);
  });

  test('a body far over the route limit is rejected as too large', async () => {
    const res = await gen({ prompt: 'x'.repeat(200000) }, victimToken);
    expect([400, 413]).toContain(res.status);
  });

  test('never leaks the Groq key or a raw upstream error', async () => {
    // No GROQ_API_KEY in the test env -> the "unavailable" path.
    const res = await gen({ prompt: 'a valid prompt about failing forward' }, victimToken);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toMatch(/gsk_/);
    expect(bodyText).not.toMatch(/api\.groq\.com/);
    expect(bodyText).not.toMatch(/Authorization/i);
    expect([502, 503, 504]).toContain(res.status);
  });
});

// ============================================================
describe('🛡️  Error responses do not leak internals', () => {
  test('a malformed ObjectId gives a clean 400 with no Mongoose detail', async () => {
    const res = await request(app).get('/api/stories/not-an-object-id');
    expect(res.status).toBe(400);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/CastError|ObjectId|mongoose|node_modules/i);
  });

  test('no response carries a stack trace', async () => {
    const responses = await Promise.all([
      request(app).get('/api/stories/not-an-object-id'),
      request(app).get('/api/nope'),
      request(app).post('/api/auth/login').send({ identifier: 'x', password: 'y' }),
      request(app).put('/api/users/me/profile').send({ bio: 'x' }),
    ]);
    for (const res of responses) {
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/at \/|\.js:\d+:\d+|node_modules|\/Users\//);
    }
  });

  test('malformed JSON is rejected without echoing the parser internals', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"identifier": "a", ');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules|body-parser|at /);
  });
});

// ============================================================
describe('🛡️  Password handling', () => {
  test('a too-short password is not echoed back in the validation error', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Short Pass',
      email: `shortpw${stamp}@sectest.com`,
      password: 'abc',
    });
    expect(res.status).toBe(400);
    const text = JSON.stringify(res.body);
    // The old handler returned `value: '<the password>'`.
    expect(text).not.toContain('abc');
  });

  test('login never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: victim.email, password: 'Test123!@#' });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    expect(res.body.user.password).toBeUndefined();
  });
});

// ============================================================
describe('📧 Email validation — modern TLDs', () => {
  // The schema previously used /(\.\w{2,3})+$/, which capped the TLD at three
  // characters. Registration therefore failed for real addresses on .tech,
  // .online, .info and similar. Both layers (Mongoose schema + express-validator)
  // must now agree, so each case is asserted end-to-end through the API AND at
  // the schema level.

  const register = (email) =>
    request(app).post('/api/auth/register').send({
      name: 'TLD Tester',
      email,
      password: 'Test123!@#',
    });

  const schemaAccepts = (email) => {
    const u = new User({ name: 'TLD Tester', email, password: 'Test123!@#' });
    const err = u.validateSync();
    return !(err && err.errors.email);
  };

  describe('valid addresses are accepted', () => {
    const valid = [
      ['a normal .com address', 'com'],
      ['.dev', 'dev'],
      ['.tech', 'tech'],
      ['.online', 'online'],
      ['.info', 'info'],
      ['.io', 'io'],
    ];

    test.each(valid)('accepts %s', async (_label, tld) => {
      const email = `tld${tld}${stamp}@sectest.${tld}`;
      expect(schemaAccepts(email)).toBe(true);

      const res = await register(email);
      expect(res.status).toBe(201);

      // Persisted, so the schema validator ran on the real save path too.
      const saved = await User.findOne({ email: email.toLowerCase() });
      expect(saved).not.toBeNull();
    }, TEST_TIMEOUT);

    test('accepts a multi-label domain', async () => {
      const email = `multi${stamp}@mail.sub.sectest.co.uk`;
      expect(schemaAccepts(email)).toBe(true);
      expect((await register(email)).status).toBe(201);
    }, TEST_TIMEOUT);
  });

  describe('invalid addresses are still rejected', () => {
    const invalid = [
      ['no @ sign', 'not-an-email'],
      ['nothing after @', 'user@'],
      ['no TLD', 'user@localhost'],
      ['empty domain label', 'user@.com'],
      ['double @', 'user@@example.com'],
      ['leading dot in domain', 'user@.example.com'],
      ['spaces', 'user name@example.com'],
      ['empty string', ''],
    ];

    test.each(invalid)('rejects %s', async (_label, email) => {
      expect(schemaAccepts(email)).toBe(false);
      const res = await register(email);
      expect(res.status).toBe(400);
      // And nothing was persisted.
      expect(await User.findOne({ email: String(email).toLowerCase() })).toBeNull();
    }, TEST_TIMEOUT);

    test('rejects an address exceeding RFC 5321 length limits', async () => {
      const email = `${'a'.repeat(300)}@sectest.com`;
      expect(schemaAccepts(email)).toBe(false);
      expect((await register(email)).status).toBe(400);
    }, TEST_TIMEOUT);

    test('the rejection message does not leak the submitted password', async () => {
      const res = await register('still-not-an-email');
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toContain('Test123!@#');
    });
  });

  test('the schema layer and the API layer agree on every case', async () => {
    // A disagreement is what caused the original bug: the API accepted the
    // address and the schema then rejected it at save time.
    for (const email of [
      `agree1${stamp}@sectest.com`,
      `agree2${stamp}@sectest.tech`,
      `agree3${stamp}@sectest.online`,
      'definitely not valid',
      'broken@',
    ]) {
      const schemaOk = schemaAccepts(email);
      const apiOk = (await register(email)).status === 201;
      expect(apiOk).toBe(schemaOk);
    }
  }, TEST_TIMEOUT);
});
