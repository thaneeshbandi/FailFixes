/**
 * Hard guard: the test suite must never touch a non-test database.
 *
 * This exists because `backend/.env` and `backend/.env.test` previously held a
 * byte-identical MONGODB_URI pointing at the production Atlas cluster, while
 * the suites run `User.deleteMany({ email: { $regex: /test.*@test\.com/ } })`
 * and `Story.deleteMany(...)` in beforeAll/afterAll. Every `npm test` was
 * issuing destructive writes against live data.
 *
 * Wired in via jest `setupFiles` (backend/package.json), so it runs before any
 * test module is imported and cannot be skipped by an individual test file.
 */

const HOST_ALLOWLIST = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'mongo', 'mongodb']);

/**
 * Parse a mongodb:// or mongodb+srv:// URI into { hosts, database, isSrv }
 * without pulling in a dependency. Returns nulls on anything unparseable,
 * which the caller treats as a failure.
 */
function parseMongoUri(uri) {
  const match = /^mongodb(\+srv)?:\/\/(?:([^@/]*)@)?([^/?]+)(?:\/([^?]*))?/.exec(uri || '');
  if (!match) return null;
  const [, srv, , hostPart, dbPart] = match;
  return {
    isSrv: Boolean(srv),
    hosts: hostPart.split(',').map((h) => h.split(':')[0].toLowerCase()),
    database: decodeURIComponent(dbPart || ''),
  };
}

/**
 * @throws {Error} when the configuration looks like it could reach production
 */
function assertSafeTestDatabase(env = process.env) {
  const problems = [];

  if (env.NODE_ENV !== 'test') {
    problems.push(`NODE_ENV must be "test" (got "${env.NODE_ENV || 'undefined'}")`);
  }

  const uri = env.MONGODB_URI;
  if (!uri) {
    problems.push('MONGODB_URI is not set');
  } else {
    const parsed = parseMongoUri(uri);

    if (!parsed) {
      problems.push('MONGODB_URI is not a parseable MongoDB connection string');
    } else {
      // Escape hatch for teams that genuinely run an isolated remote test cluster.
      const remoteAllowed = env.ALLOW_REMOTE_TEST_DB === 'yes-i-understand-the-risk';

      if (parsed.isSrv && !remoteAllowed) {
        problems.push(
          'MONGODB_URI uses mongodb+srv:// (a hosted cluster such as Atlas). ' +
            'Point tests at a local mongod or a CI service container.'
        );
      }

      const remoteHosts = parsed.hosts.filter((h) => !HOST_ALLOWLIST.has(h));
      if (remoteHosts.length > 0 && !remoteAllowed) {
        problems.push(
          `MONGODB_URI points at non-local host(s): ${remoteHosts.join(', ')}`
        );
      }

      if (!parsed.database) {
        problems.push('MONGODB_URI does not name a database');
      } else if (!/test/i.test(parsed.database)) {
        // The last line of defence even when a remote host was explicitly allowed.
        problems.push(
          `MONGODB_URI database "${parsed.database}" does not contain "test". ` +
            'Tests issue deleteMany() and must use a dedicated database.'
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      '\n\n🛑 REFUSING TO RUN TESTS — unsafe database configuration\n\n' +
        problems.map((p) => `  • ${p}`).join('\n') +
        '\n\nFix backend/.env.test (see backend/.env.test.example).\n' +
        'The connection string itself is deliberately not printed here.\n'
    );
  }
}

module.exports = { assertSafeTestDatabase, parseMongoUri };
