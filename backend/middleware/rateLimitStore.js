/**
 * A Redis-backed store for express-rate-limit.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * express-rate-limit defaults to an in-process MemoryStore. That has two
 * properties that make it unsuitable as the *only* brute-force control:
 *
 *   1. It resets on every restart. On a platform that restarts on deploy, an
 *      attacker gets a fresh budget of login attempts each time.
 *   2. It is per-process. With N instances behind a load balancer the effective
 *      limit is N x the configured limit.
 *
 * Since Redis is already a dependency (middleware/cache.js), the counters can be
 * shared without adding a package. This is written against the existing `redis`
 * client rather than pulling in `rate-limit-redis`: the whole contract is three
 * methods, and the fallback behaviour below is the part that actually needed
 * thinking about.
 *
 * ── Failure behaviour ───────────────────────────────────────────────────────
 * Redis is optional in this application, so this store must never be the reason
 * a request fails. When Redis is unavailable — not configured, still connecting,
 * or erroring — every call transparently delegates to a MemoryStore. The effect
 * is a documented degradation, not an outage: limits go back to being
 * per-process for as long as Redis is down. That is the same protection the
 * application had before, so nothing is lost relative to the previous behaviour.
 *
 * ── Algorithm ───────────────────────────────────────────────────────────────
 * Fixed window, matching MemoryStore's semantics so the two are interchangeable:
 * INCR the key, and set a TTL of windowMs the first time it is created. The
 * window therefore starts at the first request and the key expires on its own,
 * so there is no sweep and no unbounded key growth.
 *
 * A fixed window permits up to 2x the limit across a window boundary. That is
 * acceptable here — these budgets are abuse controls, not quotas — and it is the
 * same trade-off the previous MemoryStore made.
 */

const { MemoryStore } = require('express-rate-limit');
const { getClient, isRedisReady } = require('./cache');

const KEY_PREFIX = 'rl:';

class RedisRateLimitStore {
  constructor() {
    // Used whenever Redis is unavailable. Constructed eagerly so it is always
    // ready; `init` forwards the same options express-rate-limit gave us.
    this.fallback = new MemoryStore();
    this.windowMs = 60_000;

    // Tells express-rate-limit that keys are NOT local to this process, so it
    // does not warn about the double-count behaviour it assumes for MemoryStore.
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  /** @returns {boolean} true when the shared store can be used right now. */
  #usable() {
    return isRedisReady() && Boolean(getClient());
  }

  /**
   * @param {string} key
   * @returns {Promise<{totalHits: number, resetTime: Date}>}
   */
  async increment(key) {
    if (!this.#usable()) return this.fallback.increment(key);

    const redisKey = KEY_PREFIX + key;

    try {
      const client = getClient();

      // One round trip: increment, and ask how long the key has left.
      const [totalHits, ttl] = await client.multi().incr(redisKey).pTTL(redisKey).exec();

      let remainingMs = ttl;

      // ttl < 0 means the key has no expiry — i.e. this INCR created it (or a
      // previous process died between INCR and PEXPIRE). Start the window now.
      // Without this the key would live forever and the client would stay
      // limited permanently.
      if (remainingMs < 0) {
        await client.pExpire(redisKey, this.windowMs);
        remainingMs = this.windowMs;
      }

      return {
        totalHits: Number(totalHits),
        resetTime: new Date(Date.now() + remainingMs),
      };
    } catch (err) {
      // A Redis blip must not 500 the request or, worse, block all traffic.
      console.warn('⚠️  Rate limit store: falling back to memory —', err.message);
      return this.fallback.increment(key);
    }
  }

  /** Used by `skipSuccessfulRequests`/`skipFailedRequests`; not enabled here. */
  async decrement(key) {
    if (!this.#usable()) return this.fallback.decrement(key);
    try {
      await getClient().decr(KEY_PREFIX + key);
    } catch (err) {
      console.warn('⚠️  Rate limit store decrement failed:', err.message);
    }
  }

  /** Clear one client's counter. Used by tests. */
  async resetKey(key) {
    this.fallback.resetKey(key);
    if (!this.#usable()) return;
    try {
      await getClient().del(KEY_PREFIX + key);
    } catch (err) {
      console.warn('⚠️  Rate limit store resetKey failed:', err.message);
    }
  }
}

/**
 * @returns {RedisRateLimitStore|undefined} a shared store, or undefined to let
 * express-rate-limit use its own MemoryStore. Returning undefined when Redis is
 * not configured at all keeps the dependency genuinely optional.
 */
function createRateLimitStore() {
  if (!process.env.REDIS_URL) return undefined;
  return new RedisRateLimitStore();
}

module.exports = { RedisRateLimitStore, createRateLimitStore, KEY_PREFIX };
