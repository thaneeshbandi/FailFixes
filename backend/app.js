// Refuse to boot on missing/weak secrets before anything else is wired up.
// Also runs for the test suite, which requires this module directly.
require("./config/env").validateEnvOrExit();

const { randomUUID } = require("crypto");

const express = require("express");
const cors = require("cors");
const { corsOptions } = require("./config/cors");
const { errorHandler } = require("./middleware/errorhandler");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const {
  initRedis,
  cacheMiddleware,
  invalidateCache,
  isRedisReady,
  quitRedis,
  getClient: getRedisClient,
} = require("./middleware/cache");

// Import Routes
const authRoutes = require("./routes/auth");
const storyRoutes = require("./routes/stories");
const userRoutes = require("./routes/users");
const chatRoutes = require("./routes/chats");
const aiRoutes = require("./routes/ai");

const app = express();

// ✅ REDIS CACHE
// Implemented in middleware/cache.js. Only fully anonymous GET responses are
// cached; any request carrying credentials bypasses the cache in both
// directions, so a personalised response (or an owner's unpublished draft) can
// never be stored and replayed to someone else.
initRedis();

// Trust proxy for rate limiting (important for Render)
app.set("trust proxy", 1);

// ✅ CORS — single allowlist shared with Socket.IO (config/cors.js).
// Fails closed: unknown origins get no CORS headers in every environment.
app.use(cors(corsOptions));

// The previous `app.options("*", cors())` registered a DEFAULT cors handler,
// which answers preflights with `Access-Control-Allow-Origin: *`. The middleware
// above already handles OPTIONS with the strict allowlist, so the wildcard
// handler is removed rather than left shadowed.

// ✅ BODY PARSING - MUST BE BEFORE ROUTES
//
// The old blanket 10MB limit applied to every route, including /api/auth/login
// (each attempt runs a cost-12 bcrypt) and /api/ai/generate-story. Combined with
// the absent rate limiting that was a cheap resource-exhaustion primitive.
//
// Limits are now sized to what each route actually accepts. Express applies the
// *first* matching body parser, so the tighter route-specific parsers are
// registered before the general one.
//
// `strict: true` (the default) also restores rejection of non-object JSON
// bodies such as `"a string"` or `123`, which downstream code assumes cannot
// happen.
const jsonBody = (limit) => express.json({ limit, strict: true });

// Credentials only: a few hundred bytes at most.
app.use("/api/auth", jsonBody("16kb"));
// Prompt is capped at 2000 characters by validation.
app.use("/api/ai", jsonBody("32kb"));
// Profile fields (bio 500, website 200, …).
app.use("/api/users", jsonBody("64kb"));
// Chat messages are capped at 1000 characters.
app.use("/api/chats", jsonBody("32kb"));
// Stories are long-form prose; generous but far below 10MB.
app.use("/api/stories", jsonBody("512kb"));

// Fallback for anything else.
app.use(jsonBody("256kb"));

app.use(
  express.urlencoded({
    extended: true,
    limit: "64kb",
  }),
);

// Security middleware
app.use(
  helmet({
    // This process serves a JSON API only — it renders no HTML, so a CSP here
    // governs nothing an attacker could execute. The CSP that actually matters
    // belongs on the React app's own origin (Vercel/Render static hosting),
    // where it can constrain script execution and therefore protect the token
    // in localStorage. A restrictive default-src is set anyway as defence in
    // depth for any error page or future HTML response: it costs nothing and
    // cannot break JSON responses.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'none'"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'none'"],
        "form-action": ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    // The browser app is served from a different origin than this API, so
    // cross-origin reads must stay permitted.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // HSTS: Render terminates TLS in front of the app. max-age 180 days,
    // without preload (preloading is a one-way door the operator should opt
    // into deliberately).
    hsts: {
      maxAge: 15552000,
      includeSubDomains: true,
      preload: false,
    },
    referrerPolicy: { policy: "no-referrer" },
  }),
);

// Compression
app.use(compression());

// ✅ REQUEST ID
// Every request gets an id, echoed to the client as X-Request-Id and attached to
// the access log and to any error log for the same request. Without it, two
// concurrent requests interleave in the log with nothing tying their lines
// together — which is the single thing that made production issues here hard to
// trace. An inbound X-Request-Id is honoured (so a proxy or the frontend can
// correlate) but length-capped and stripped of anything that could forge a log
// line or inject a header.
app.use((req, res, next) => {
  const inbound = req.headers["x-request-id"];
  const clean =
    typeof inbound === "string" ? inbound.replace(/[^\w.-]/g, "").slice(0, 64) : "";

  req.id = clean || randomUUID();
  res.set("X-Request-Id", req.id);
  next();
});

// Logging
morgan.token("id", (req) => req.id || "-");

if (process.env.NODE_ENV === "development") {
  app.use(morgan(":id :method :url :status :response-time ms"));
  // The previous verbose logger here dumped req.body on every request, which
  // meant cleartext passwords in the dev console (and anywhere those logs were
  // pasted). morgan already records method/url/status/time.
} else if (process.env.NODE_ENV === "production") {
  // 'combined' plus the request id, so an access-log line can be joined to the
  // error-log line for the same request.
  app.use(
    morgan(
      ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" ' +
        ':status :res[content-length] ":referrer" ":user-agent" req_id=:id',
    ),
  );
}

// ✅ ROOT ENDPOINT
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FailFixes API Server",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    cache: isRedisReady() ? "enabled" : "disabled",
    features: [
      "auth",
      "stories",
      "users",
      "chats",
      "realtime-chat",
      "ai-story-generation",
      ...(isRedisReady() ? ["redis-caching", "performance-tracking"] : []),
    ],
  });
});

// ✅ HEALTH CHECK
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    message: "FailFixes API is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    cache: {
      enabled: isRedisReady(),
      type: isRedisReady() ? "redis" : "none",
    },
  });
});

app.get("/api/health", async (req, res) => {
  let cacheStatus = "disabled";
  let cachePing = null;

  if (isRedisReady()) {
    try {
      const pingStart = Date.now();
      await getRedisClient().ping();
      cachePing = Date.now() - pingStart;
      cacheStatus = "connected";
    } catch (err) {
      cacheStatus = "error";
    }
  }

  res.status(200).json({
    success: true,
    status: "OK",
    message: "FailFixes API is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      status: cacheStatus,
      ping: cachePing ? `${cachePing}ms` : null,
      enabled: isRedisReady(),
    },
    features: {
      auth: "active",
      stories: "active",
      users: "active",
      chats: "active",
      socketIO: "active",
      ai: process.env.GROQ_API_KEY ? "active" : "inactive",
      cache: isRedisReady() ? "active" : "inactive",
    },
  });
});

// ✅ CACHE STATS ENDPOINT (Development only)
if (process.env.NODE_ENV === "development") {
  app.get("/api/cache/stats", async (req, res) => {
    if (!isRedisReady()) {
      return res.json({
        success: true,
        message: "Cache is disabled",
        stats: null,
      });
    }

    try {
      const keys = await getRedisClient().keys("cache:anon:*");
      const stats = {
        totalKeys: keys.length,
        keys: keys.slice(0, 20), // Show first 20 keys
      };

      res.json({
        success: true,
        message: "Cache statistics",
        stats,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to get cache stats",
        error: err.message,
      });
    }
  });

  // Clear cache endpoint
  app.delete("/api/cache/clear", async (req, res) => {
    if (!isRedisReady()) {
      return res.json({
        success: false,
        message: "Cache is disabled",
      });
    }

    try {
      await invalidateCache();
      res.json({
        success: true,
        message: "Cache cleared successfully",
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Failed to clear cache",
        error: err.message,
      });
    }
  });
}

// ✅ CACHE INVALIDATION ON WRITES
// NOTE: this was previously registered *after* the route mounts, so it never
// executed — a route handler ends the response and later middleware is skipped.
// The anonymous story cache was therefore only ever cleared by its 300s TTL,
// meaning a newly published story could stay invisible to logged-out visitors
// for up to five minutes. Registering it ahead of the routes lets it wrap
// res.json before a handler is reached.
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire-and-forget: a cache-invalidation failure must not fail the write
        // that already succeeded.
        if (req.originalUrl.includes("/stories")) {
          invalidateCache("/api/stories*").catch(() => {});
        } else if (req.originalUrl.includes("/users")) {
          invalidateCache("/api/users*").catch(() => {});
        }
      }
      return originalJson(data);
    };
  }
  next();
});

// ✅ API ROUTES WITH CACHING

// Auth routes (no caching for auth)
app.use("/api/auth", authRoutes);

// User routes with selective caching
app.use("/api/users", userRoutes);

// Story routes with caching (5 minutes)
app.use("/api/stories", cacheMiddleware(300), storyRoutes);

// Chat routes (no caching for real-time data)
app.use("/api/chats", chatRoutes);

// AI routes (no caching - always generate fresh)
app.use("/api/ai", aiRoutes);

// ✅ 404 Handler
//
// The endpoint catalogue this used to return on every 404 is now
// development-only. In production it was free reconnaissance: a single request
// to any bad path enumerated the entire API surface. The route list also drifted
// from reality (it advertised routes that were never implemented), which is
// exactly the class of problem this pass exists to remove.
app.use("*", (req, res) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(`❌ 404: ${req.method} ${req.originalUrl} not found [req_id=${req.id}]`);
  }

  const body = {
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: "NOT_FOUND",
    requestId: req.id,
  };

  if (process.env.NODE_ENV === "development") {
    // Kept accurate by hand; every entry below is asserted by
    // tests/routes.contract.test.js, which fails if a listed route 404s.
    body.availableEndpoints = {
      root: "GET /",
      health: "GET /health, GET /api/health",
      cache: {
        stats: "GET /api/cache/stats",
        clear: "DELETE /api/cache/clear",
      },
      auth: {
        register: "POST /api/auth/register",
        signup: "POST /api/auth/signup",
        login: "POST /api/auth/login",
        me: "GET /api/auth/me",
        logout: "POST /api/auth/logout",
        changePassword: "PUT /api/auth/change-password",
      },
      stories: {
        list: "GET /api/stories",
        byId: "GET /api/stories/:id",
        byAuthor: "GET /api/stories/author/:authorUsername",
        create: "POST /api/stories",
        update: "PUT /api/stories/:id",
        delete: "DELETE /api/stories/:id",
        like: "PATCH /api/stories/:id/like",
        view: "POST /api/stories/:id/view",
        comment: "POST /api/stories/:id/comment",
        getComments: "GET /api/stories/:id/comments",
      },
      users: {
        profile: "GET /api/users/profile/:username",
        trackProfileView: "POST /api/users/profile/:userId/view",
        followToggle: "POST /api/users/:username/follow",
        followers: "GET /api/users/:username/followers",
        following: "GET /api/users/:username/following",
        dashboard: "GET /api/users/dashboard",
        suggested: "GET /api/users/suggested",
        search: "GET /api/users/search?q=",
        stats: "GET /api/users/me/stats",
        stories: "GET /api/users/me/stories",
        feed: "GET /api/users/me/feed",
        liked: "GET /api/users/me/liked",
        myProfile: "GET /api/users/me/profile",
        updateProfile: "PUT /api/users/me/profile",
      },
      chats: {
        list: "GET /api/chats",
        createDirect: "POST /api/chats/direct",
        messages: "GET /api/chats/:chatId/messages",
        markRead: "PUT /api/chats/:chatId/read",
        note: "Messages are SENT over Socket.IO ('sendMessage'), not over HTTP.",
      },
      ai: {
        generate: "POST /api/ai/generate-story",
      },
    };
  }

  res.status(404).json(body);
});

// ✅ GLOBAL ERROR HANDLER
// Single implementation, in middleware/errorhandler.js. It was previously
// duplicated (an inline handler here plus an unmounted module) and this one
// returned `stack: err.stack` to the client outside production.
app.use(errorHandler);

// NOTE: this module registers NO process-signal handlers.
//
// It previously installed its own SIGTERM/SIGINT handlers that closed Redis and
// called process.exit(0) — while server.js installed handlers that closed the
// HTTP server and MongoDB, and utils/database.js installed a third set. All
// three fired on one signal and raced, and whichever called process.exit first
// truncated the others. server.js now owns shutdown and calls quitRedis() as
// part of one ordered sequence.
//
// It also means requiring this module (as the test suite does) has no side
// effect on the process's signal handling.

module.exports = app;
module.exports.quitRedis = quitRedis;
module.exports.invalidateCache = invalidateCache;
module.exports.cacheMiddleware = cacheMiddleware;
// A getter, not a captured value: `getRedisClient()` returns null at module load
// because initRedis() connects asynchronously. The old
// `module.exports.redisClient = getRedisClient()` therefore froze null forever.
Object.defineProperty(module.exports, "redisClient", { get: getRedisClient });
