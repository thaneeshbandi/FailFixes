/**
 * Presence and per-account connection counting.
 *
 * ── Why this is not just a Map ──────────────────────────────────────────────
 * The Socket.IO Redis adapter forwards *broadcasts* between instances, so rooms
 * and message fan-out work across processes as soon as it is installed. Two
 * pieces of state were still local, and both are wrong the moment a second
 * instance exists:
 *
 *   1. `activeUsers` — used to decide whether a disconnect means the user went
 *      offline. With two instances, a user with a tab on each would be
 *      announced offline when either tab closed.
 *   2. `connectionCounts` — the per-account cap of MAX_SOCKETS_PER_USER. With N
 *      instances the effective cap was N x MAX.
 *
 * Both reduce to the same question: how many sockets does this account have
 * open, across the whole cluster? So both are answered by one shared counter.
 *
 * ── Design ──────────────────────────────────────────────────────────────────
 * One Redis integer per user: `presence:conn:<userId>`.
 *   acquire() -> INCR. count === 1 means "just came online".
 *   release() -> DECR. count <= 0 means "went offline"; the key is deleted.
 *
 * The counter is both the presence signal and the rate-limit budget, so the two
 * can never disagree.
 *
 * ── Failure behaviour ───────────────────────────────────────────────────────
 * With no REDIS_URL the tracker uses an in-memory Map — identical behaviour to
 * before, correct for a single instance. If Redis is configured but unreachable
 * at call time, calls fall back to the same in-memory map rather than refusing
 * the connection: losing presence accuracy is a better failure than being unable
 * to open a chat socket.
 *
 * ── Known limitation ────────────────────────────────────────────────────────
 * If a process is killed without running its disconnect handlers, its share of
 * the counters is never decremented and those users appear online until the key
 * expires. Each key is given a TTL (refreshed on every acquire) to bound that
 * window; a precise fix needs per-instance socket sets reconciled at startup,
 * which is more machinery than this application warrants. Documented in
 * docs/ARCHITECTURE.md under Failure modes.
 */

// A stale counter should not outlive a plausible session by much.
const PRESENCE_TTL_SECONDS = 12 * 60 * 60; // 12h
const KEY = (userId) => `presence:conn:${userId}`;

/**
 * @param {import('redis').RedisClientType|null} client a CONNECTED redis client,
 *        or null for in-memory mode.
 * @param {{maxPerUser: number}} options
 */
function createPresenceTracker(client, { maxPerUser }) {
  // Always present: the fallback path and the whole implementation in the
  // no-Redis case.
  const local = new Map();

  const usable = () => Boolean(client && client.isReady);

  function localAcquire(userId) {
    const count = (local.get(userId) || 0) + 1;
    if (count > maxPerUser) return { allowed: false, count: count - 1, isFirst: false };
    local.set(userId, count);
    return { allowed: true, count, isFirst: count === 1 };
  }

  function localRelease(userId) {
    const count = (local.get(userId) || 1) - 1;
    if (count <= 0) local.delete(userId);
    else local.set(userId, count);
    return { count: Math.max(0, count), isLast: count <= 0 };
  }

  return {
    /**
     * Register a new connection for this user.
     * @returns {Promise<{allowed: boolean, count: number, isFirst: boolean}>}
     *   allowed=false when the account is already at maxPerUser.
     *   isFirst=true when this is the account's only connection, i.e. the point
     *   at which `userOnline` should be broadcast.
     */
    async acquire(userId) {
      if (!usable()) return localAcquire(userId);
      try {
        const count = await client.incr(KEY(userId));
        // Refresh the TTL on every acquire so an active account's key never
        // expires underneath it.
        await client.expire(KEY(userId), PRESENCE_TTL_SECONDS);

        if (count > maxPerUser) {
          // Give the slot straight back — this connection is being refused.
          await client.decr(KEY(userId));
          return { allowed: false, count: count - 1, isFirst: false };
        }
        return { allowed: true, count, isFirst: count === 1 };
      } catch (err) {
        console.warn('⚠️  Presence: Redis unavailable, using local counter —', err.message);
        return localAcquire(userId);
      }
    },

    /**
     * Release a connection.
     * @returns {Promise<{count: number, isLast: boolean}>}
     *   isLast=true when the account has no connections left, i.e. the point at
     *   which `userOffline` should be broadcast.
     */
    async release(userId) {
      if (!usable()) return localRelease(userId);
      try {
        const count = await client.decr(KEY(userId));
        if (count <= 0) {
          await client.del(KEY(userId));
          return { count: 0, isLast: true };
        }
        return { count, isLast: false };
      } catch (err) {
        console.warn('⚠️  Presence: Redis unavailable, using local counter —', err.message);
        return localRelease(userId);
      }
    },

    /** Current connection count for a user. Exported for tests and health. */
    async count(userId) {
      if (!usable()) return local.get(userId) || 0;
      try {
        const raw = await client.get(KEY(userId));
        return raw ? Number(raw) : 0;
      } catch {
        return local.get(userId) || 0;
      }
    },

    /** True when counters are shared across instances. */
    isShared: () => usable(),
  };
}

module.exports = { createPresenceTracker, PRESENCE_TTL_SECONDS, KEY };
