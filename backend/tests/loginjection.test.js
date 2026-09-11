/**
 * Log-injection regression test.
 *
 * CodeQL `js/log-injection` on PR #1 flagged the 404 handler in app.js, which
 * logged `req.method` and `req.originalUrl` — both attacker-controlled — into a
 * console line. A value carrying CR/LF can forge additional log entries, so an
 * attacker can fabricate lines that appear to come from the server, or bury
 * their own activity under noise.
 *
 * The suite normally silences this log (`NODE_ENV === 'test'` skips it), so the
 * test re-enables it by flipping NODE_ENV for the duration of the request and
 * captures what actually reaches console.log.
 */

const request = require('supertest');

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const app = require('../app');

/** Run one request with 404 logging enabled, returning every captured line. */
async function capture404Log(path) {
  const lines = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });

  // app.js skips the 404 log when NODE_ENV === 'test'.
  process.env.NODE_ENV = 'development';
  try {
    await request(app).get(path);
  } finally {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    spy.mockRestore();
  }

  return lines.filter((l) => l.includes('404'));
}

afterAll(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('🪵 404 logging cannot be polluted by the request', () => {
  test('the log line is produced at all (guards against a vacuous pass)', async () => {
    const lines = await capture404Log('/api/definitely-not-a-route');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain('/api/definitely-not-a-route');
  });

  test('CRLF in the URL cannot forge a second log line', async () => {
    // %0d%0a decoded is \r\n. If it reached the log raw, everything after it
    // would appear as its own entry.
    const lines = await capture404Log('/api/x%0d%0aFAKE-ADMIN-LOGIN-SUCCESS');

    expect(lines.length).toBe(1);
    expect(lines[0]).not.toMatch(/[\r\n]/);
  });

  test('control characters are stripped from the logged URL', async () => {
    const lines = await capture404Log('/api/x%00%07%1b%5bFAKE');
    expect(lines.length).toBe(1);
    // No NUL, BEL, ESC — nothing outside printable ASCII.
    expect(lines[0].replace(/[❌→]/g, '')).not.toMatch(/[^\x20-\x7E]/);
  });

  test('the logged URL is length-capped so one request cannot flood the log', async () => {
    const lines = await capture404Log(`/api/${'a'.repeat(5000)}`);
    expect(lines.length).toBe(1);
    // 200-char cap on the URL plus the fixed prefix/suffix — comfortably under 400.
    expect(lines[0].length).toBeLessThan(400);
  });

  test('ordinary URLs stay fully readable — sanitisation keeps diagnostics useful', async () => {
    const lines = await capture404Log('/api/users/nope?page=2&sortBy=recent');
    expect(lines[0]).toContain('/api/users/nope?page=2&sortBy=recent');
    expect(lines[0]).toContain('GET');
  });
});
