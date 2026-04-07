const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const redis = require('redis');

// Import Routes
const authRoutes = require('./routes/auth');
const storyRoutes = require('./routes/stories');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const aiRoutes = require('./routes/ai');

const app = express();

// ✅ REDIS CLIENT SETUP
let redisClient = null;
let redisConnected = false;

// Initialize Redis only if URL is provided
if (process.env.REDIS_URL) {
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

  redisClient.on('connect', () => {
    console.log('🔄 Redis: Connecting...');
  });

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

  // Connect to Redis
  redisClient.connect().catch((err) => {
    console.warn('⚠️ Redis connection failed:', err.message);
    console.log('ℹ️  App will continue without caching');
  });
} else {
  console.log('ℹ️  Redis URL not provided - caching disabled');
}

// ✅ ENHANCED CACHE MIDDLEWARE WITH PERFORMANCE TRACKING
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Skip caching if Redis is not connected or in test mode
    if (!redisConnected || process.env.NODE_ENV === 'test') {
      return next();
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for authenticated user-specific endpoints
    const skipPaths = ['/api/auth/me', '/api/users/me', '/api/users/dashboard'];
    if (skipPaths.some(path => req.originalUrl.includes(path))) {
      return next();
    }

    const cacheKey = `cache:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        const cacheTime = Date.now() - startTime;
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Cache HIT: ${req.originalUrl} - ${cacheTime}ms`);
        }
        
        // Add performance headers
        res.set('X-Response-Time', `${cacheTime}ms`);
        res.set('X-Cache-Status', 'HIT');
        
        return res.json(JSON.parse(cachedData));
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`❌ Cache MISS: ${req.originalUrl}`);
      }

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response and track time
      res.json = (data) => {
        const totalTime = Date.now() - startTime;
        
        // Add performance headers
        res.set('X-Response-Time', `${totalTime}ms`);
        res.set('X-Cache-Status', 'MISS');
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`📊 DB Query: ${req.originalUrl} - ${totalTime}ms`);
        }
        
        // Cache successful responses only
        if (res.statusCode === 200 && data) {
          redisClient
            .setEx(cacheKey, duration, JSON.stringify(data))
            .catch((err) => {
              console.warn('⚠️ Cache set error:', err.message);
            });
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

// ✅ CACHE INVALIDATION HELPER
const invalidateCache = async (pattern = '*') => {
  if (!redisConnected) return;

  try {
    const keys = await redisClient.keys(`cache:${pattern}`);
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

// Trust proxy for rate limiting (important for Render)
app.set('trust proxy', 1);

// ✅ CORS Configuration for Render
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'https://failfixes-frontend.onrender.com',
  'https://failfixes.onrender.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log('⚠️  CORS blocked origin:', origin);
          console.log('✅ Allowed origins:', allowedOrigins);
        }
        callback(null, process.env.NODE_ENV !== 'production');
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-Response-Time', 'X-Cache-Status'], // ✅ Expose performance headers
  })
);

app.options('*', cors());

// ✅ BODY PARSING - MUST BE BEFORE ROUTES
app.use(
  express.json({
    limit: '10mb',
    strict: false,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));

  app.use((req, res, next) => {
    console.log(`\n🌐 === REQUEST LOG ===`);
    console.log(`${req.method} ${req.originalUrl}`);
    console.log('Headers:', {
      'content-type': req.headers['content-type'],
      authorization: req.headers.authorization ? 'Bearer [PRESENT]' : 'None',
      origin: req.headers.origin,
    });
    if (Object.keys(req.body).length > 0) {
      console.log('Body:', req.body);
    }
    if (Object.keys(req.params).length > 0) {
      console.log('Params:', req.params);
    }
    if (Object.keys(req.query).length > 0) {
      console.log('Query:', req.query);
    }
    console.log('=== END LOG ===\n');
    next();
  });
} else if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
}

// ✅ ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FailFixes API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cache: redisConnected ? 'enabled' : 'disabled',
    features: [
      'auth',
      'stories',
      'users',
      'chats',
      'realtime-chat',
      'ai-story-generation',
      ...(redisConnected ? ['redis-caching', 'performance-tracking'] : []),
    ],
  });
});

// ✅ HEALTH CHECK
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    message: 'FailFixes API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    cache: {
      enabled: redisConnected,
      type: redisConnected ? 'redis' : 'none',
    },
  });
});

app.get('/api/health', async (req, res) => {
  let cacheStatus = 'disabled';
  let cachePing = null;

  if (redisConnected) {
    try {
      const pingStart = Date.now();
      await redisClient.ping();
      cachePing = Date.now() - pingStart;
      cacheStatus = 'connected';
    } catch (err) {
      cacheStatus = 'error';
    }
  }

  res.status(200).json({
    success: true,
    status: 'OK',
    message: 'FailFixes API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: {
      status: cacheStatus,
      ping: cachePing ? `${cachePing}ms` : null,
      enabled: redisConnected,
    },
    features: {
      auth: 'active',
      stories: 'active',
      users: 'active',
      chats: 'active',
      socketIO: 'active',
      ai: process.env.GROQ_API_KEY ? 'active' : 'inactive',
      cache: redisConnected ? 'active' : 'inactive',
    },
  });
});

// ✅ CACHE STATS ENDPOINT (Development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/cache/stats', async (req, res) => {
    if (!redisConnected) {
      return res.json({
        success: true,
        message: 'Cache is disabled',
        stats: null,
      });
    }

    try {
      const keys = await redisClient.keys('cache:*');
      const stats = {
        totalKeys: keys.length,
        keys: keys.slice(0, 20), // Show first 20 keys
      };

      res.json({
        success: true,
        message: 'Cache statistics',
        stats,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Failed to get cache stats',
        error: err.message,
      });
    }
  });

  // Clear cache endpoint
  app.delete('/api/cache/clear', async (req, res) => {
    if (!redisConnected) {
      return res.json({
        success: false,
        message: 'Cache is disabled',
      });
    }

    try {
      await invalidateCache();
      res.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
        error: err.message,
      });
    }
  });
}

// ✅ API ROUTES WITH CACHING

// Auth routes (no caching for auth)
app.use('/api/auth', authRoutes);

// User routes with selective caching
app.use('/api/users', userRoutes);

// Story routes with caching (5 minutes)
app.use('/api/stories', cacheMiddleware(300), storyRoutes);

// Chat routes (no caching for real-time data)
app.use('/api/chats', chatRoutes);

// AI routes (no caching - always generate fresh)
app.use('/api/ai', aiRoutes);

// ✅ CACHE INVALIDATION MIDDLEWARE FOR POST/PUT/DELETE
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const originalJson = res.json.bind(res);

    res.json = async (data) => {
      // Invalidate relevant cache on data modification
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (req.originalUrl.includes('/stories')) {
          await invalidateCache('/api/stories*');
        } else if (req.originalUrl.includes('/users')) {
          await invalidateCache('/api/users*');
        }
      }
      return originalJson(data);
    };
  }
  next();
});

// ✅ 404 Handler
app.use('*', (req, res) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`❌ 404: ${req.method} ${req.originalUrl} not found`);
  }

  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: {
      root: 'GET /',
      health: 'GET /health or /api/health',
      cache: process.env.NODE_ENV === 'development' ? {
        stats: 'GET /api/cache/stats',
        clear: 'DELETE /api/cache/clear',
      } : undefined,
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
        verifyEmail: 'GET /api/auth/verify-email/:token',
        updateProfile: 'PUT /api/auth/profile',
        changePassword: 'PUT /api/auth/change-password',
      },
      stories: {
        list: 'GET /api/stories',
        byId: 'GET /api/stories/:id',
        byAuthor: 'GET /api/stories/author/:username',
        create: 'POST /api/stories',
        update: 'PUT /api/stories/:id',
        delete: 'DELETE /api/stories/:id',
        like: 'PATCH /api/stories/:id/like',
        view: 'POST /api/stories/:id/view',
        comment: 'POST /api/stories/:id/comment',
        getComments: 'GET /api/stories/:id/comments',
      },
      users: {
        profile: 'GET /api/users/profile/:username',
        follow: 'POST /api/users/:username/follow',
        unfollow: 'DELETE /api/users/:username/follow',
        dashboard: 'GET /api/users/dashboard',
        stats: 'GET /api/users/me/stats',
        stories: 'GET /api/users/me/stories',
        feed: 'GET /api/users/me/feed',
        search: 'GET /api/users/search',
      },
      chats: {
        list: 'GET /api/chats',
        create: 'POST /api/chats/direct',
        messages: 'GET /api/chats/:chatId/messages',
        sendMessage: 'POST /api/chats/:chatId/messages',
      },
      ai: {
        generate: 'POST /api/ai/generate-story',
      },
    },
  });
});

// ✅ GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('\n❌ === GLOBAL ERROR ===');
    console.error('URL:', req.originalUrl);
    console.error('Method:', req.method);
    console.error('Error:', err.message);
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack:', err.stack);
    }
    console.error('=== END ERROR ===\n');
  }

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack,
    }),
  });
});

// ✅ GRACEFUL SHUTDOWN
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

// ✅ Export app and Redis client
module.exports = app;
module.exports.redisClient = redisClient;
module.exports.invalidateCache = invalidateCache;
module.exports.cacheMiddleware = cacheMiddleware;
