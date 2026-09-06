require('dotenv').config();
module.exports = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/failfixes',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 1,
      connectTimeoutMS: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
    }
  },
  
  // JWT Configuration
  // NOTE: nothing reads this block — utils/token.js is the single authoritative
  // JWT implementation (signing + verification + defaults). It is kept only so
  // the config file stays a complete description of the environment, and its
  // default is aligned with utils/token.js DEFAULT_EXPIRY to avoid drift.
  jwt: {
    // No fallback secret: config/env.js refuses to start without a strong one.
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || require('../utils/token').DEFAULT_EXPIRY,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d'
  },
  
  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased for dev
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control'
    ]
  },
  
  // Content Configuration
  content: {
    maxStoryLength: parseInt(process.env.MAX_STORY_LENGTH) || 50000,
    minStoryLength: parseInt(process.env.MIN_STORY_LENGTH) || 100,
    maxTagsPerStory: parseInt(process.env.MAX_TAGS_PER_STORY) || 5,
    maxTagLength: parseInt(process.env.MAX_TAG_LENGTH) || 30,
    defaultStoriesPerPage: parseInt(process.env.DEFAULT_STORIES_PER_PAGE) || 9,
    maxStoriesPerPage: parseInt(process.env.MAX_STORIES_PER_PAGE) || 50
  },

  // Performance Settings
  performance: {
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6
  },

  // Feature Flags
  features: {
    enableRegistration: process.env.ENABLE_REGISTRATION !== 'false',
    enableComments: process.env.ENABLE_COMMENTS !== 'false',
    enableFollowing: process.env.ENABLE_FOLLOWING !== 'false',
    enableModeration: process.env.ENABLE_MODERATION === 'true'
  }
};
