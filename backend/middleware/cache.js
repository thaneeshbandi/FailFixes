/**
 * Redis response cache.
 *
 * ── The bug this replaces ────────────────────────────────────────────────────
 * The cache key was `cache:${req.originalUrl}` with no identity component, and
 * it was mounted on `/api/stories`, whose handlers use `optionalAuth` and return
 * per-viewer fields (`isLiked`, `isFollowing`) — and, for `GET /api/stories/:id`,
 * return *unpublished drafts to their owner*.
 *
 * That produced two failures:
 *   1. User A's personalised response was served to User B and to anonymous
 *      visitors for the next 300s.
 *   2. An owner viewing their own draft populated the cache for that URL, after
 *      which any anonymous request received the draft — an authorization bypass
 *      created purely by the cache layer.
 *
 * ── The rule now ─────────────────────────────────────────────────────────────
 * Only fully anonymous GET responses are cached or served from cache. Any
 * request carrying credentials bypasses the cache in *both* directions: it
 * neither reads a cached entry nor writes one. That is the conservative choice —
 * we lose cache hits for logged-in users and keep them for the anonymous traffic
 * that dominates a public story site.
 */

const redis = require('redis');

let redisClient = null;
let redisConnected = false;

function initRedis() {
  if (!process.env.REDIS_URL) {
    console.log('ℹ️  Redis URL not provided - caching disabled');
    return null;
  }

  redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.log('❌ Redis: Max reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on('connect', () => console.log('🔄 Redis: Connecting...'));
  redisClient.on('ready', () => {
    redisConnected = true;
    console.log('✅ Redis: Connected and ready');
  });
  redisClient.on('error', (err) => {
    redisConnected = false;
    console.warn('⚠️ Redis Error:', err.message);
  });
  redisClient.on('end', () => {
    redisConnected = false;
    console.log('🔌 Redis: Connection closed');
  });

  redisClient.connect().catch((err) => {
    console.warn('⚠️ Redis connection failed:', err.message);
    console.log('ℹ️  App will continue without caching');
  });

  return redisClient;
}

/**
 * Does this request carry any credential that could personalise the response?
 *
 * Checked on the raw request rather than `req.user`, because the cache
 * middleware runs *before* `optionalAuth` populates `req.user`. Erring toward
 * "there might be a credential" is the safe direction.
 */
function isAuthenticatedRequest(req) {
  const header = req.headers && req.headers.authorization;
  if (typeof header === 'string' && header.trim() !== '') {
    const value = header.replace(/^Bearer\s+/i, '').trim();
    if (value && value !== 'null' && value !== 'undefined') return true;
  }
  // No cookie-based auth today, but a cookie would equally imply personalisation.
  if (req.headers && req.headers.cookie) return true;
  return false;
}

/**
 * Pure predicate, exported for tests.
 * @returns {{cacheable: boolean, reason: string}}
 */
function evaluateCacheability(req) {
  if (req.method !== 'GET') return { cacheable: false, reason: 'non-GET' };
  if (isAuthenticatedRequest(req)) {
    return { cacheable: false, reason: 'authenticated/personalised request' };
  }
  return { cacheable: true, reason: 'anonymous GET' };
}

function isRedisReady() {
  return redisConnected;
}

const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const startTime = Date.now();

    // Set Vary unconditionally — including when our own cache is disabled or
    // Redis is down. A CDN or reverse proxy in front of this app must never
    // treat an authenticated and an anonymous response as interchangeable.
    res.set('Vary', 'Authorization');

    if (!redisConnected || process.env.NODE_ENV === 'test') {
      return next();
    }

    const { cacheable, reason } = evaluateCacheability(req);

    if (!cacheable) {
      res.set('X-Cache-Status', 'BYPASS');
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏭️  Cache BYPASS (${reason}): ${req.originalUrl}`);
      }
      return next();
    }

    // Key is namespaced `anon` to make it explicit that only the anonymous
    // variant of a URL is ever stored.
    const cacheKey = `cache:anon:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        res.set('X-Response-Time', `${Date.now() - startTime}ms`);
        res.set('X-Cache-Status', 'HIT');
        return res.json(JSON.parse(cachedData));
      }

      const originalJson = res.json.bind(res);

      res.json = (data) => {
        res.set('X-Response-Time', `${Date.now() - startTime}ms`);
        res.set('X-Cache-Status', 'MISS');

        // Only 200s, and only for the anonymous request we validated above.
        if (res.statusCode === 200 && data) {
          redisClient
            .setEx(cacheKey, duration, JSON.stringify(data))
            .catch((err) => console.warn('⚠️ Cache set error:', err.message));
        }

        return originalJson(data);
      };

      next();
    } catch (err) {
      console.warn('⚠️ Cache middleware error:', err.message);
      next();
    }
  };
};

/**
 * Invalidate cached entries.
 *
 * Uses SCAN rather than KEYS: KEYS is O(N) and blocks the Redis event loop for
 * the whole keyspace, which is a self-inflicted outage on a busy instance.
 */
const invalidateCache = async (pattern = '*') => {
  if (!redisConnected || !redisClient) return;

  try {
    const match = `cache:anon:${pattern}`;
    const keys = [];
    // NOTE: node-redis v5 yields a BATCH (array of keys) per iteration, not a
    // single key. Pushing the batch directly would hand del() an array of arrays.
    for await (const batch of redisClient.scanIterator({ MATCH: match, COUNT: 200 })) {
      if (Array.isArray(batch)) keys.push(...batch);
      else keys.push(batch);
    }
    if (keys.length > 0) {
      await redisClient.del(keys);
      if (process.env.NODE_ENV === 'development') {
        console.log(`🗑️  Invalidated ${keys.length} cache entries`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Cache invalidation error:', err.message);
  }
};

async function quitRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      /* already closed */
    }
  }
}

module.exports = {
  initRedis,
  cacheMiddleware,
  invalidateCache,
  evaluateCacheability,
  isAuthenticatedRequest,
  isRedisReady,
  quitRedis,
  getClient: () => redisClient,
};
