/**
 * Jest `setupFiles` entry — runs once per worker, before any test module loads.
 *
 * Order matters:
 *   1. load .env.test
 *   2. force NODE_ENV=test
 *   3. refuse to continue if the database looks like production
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.test') });

process.env.NODE_ENV = 'test';

// Redis caching is bypassed in tests (app.js checks NODE_ENV === 'test'), but
// unset the URL too so a stray client can never be created against a real instance.
delete process.env.REDIS_URL;

require('./guardTestDatabase').assertSafeTestDatabase();
