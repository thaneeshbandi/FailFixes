const mongoose = require('mongoose');
const config = require('../config/config');

// Connection state tracking
let isConnecting = false;
let connectionAttempts = 0;
const maxRetryAttempts = 5;
const retryDelay = 5000; // 5 seconds

const connectDB = async () => {
  // Prevent multiple simultaneous connection attempts
  if (isConnecting) {
    console.log('🔄 Connection already in progress...');
    return;
  }

  try {
    isConnecting = true;
    connectionAttempts++;

    console.log('🔄 Connecting to MongoDB...');
    console.log(`📍 Attempt: ${connectionAttempts}/${maxRetryAttempts}`);
    
    // Enhanced connection options
    const connectionOptions = {
      ...config.database.options,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: config.database.options?.maxPoolSize || 10,
      minPoolSize: config.database.options?.minPoolSize || 1,
      connectTimeoutMS: config.database.options?.connectTimeoutMS || 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      maxIdleTimeMS: 30000,
      // Enable retryWrites for better reliability
      retryWrites: true,
      // Write concern
      w: 'majority',
      // Read preference
      readPreference: 'primary'
    };

    const conn = await mongoose.connect(config.database.uri, connectionOptions);
    
    console.log('✅ MongoDB Connected Successfully!');
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}`);
    console.log(`🔌 Connection State: ${getConnectionState(conn.connection.readyState)}`);
    console.log(`⚡ Max Pool Size: ${connectionOptions.maxPoolSize}`);
    
    // Reset connection attempts on successful connection
    connectionAttempts = 0;
    isConnecting = false;
    
    return conn;
  } catch (error) {
    isConnecting = false;
    console.error('❌ MongoDB connection failed:', error.message);
    
    // Implement retry logic
    if (connectionAttempts < maxRetryAttempts) {
      console.log(`🔄 Retrying connection in ${retryDelay / 1000} seconds...`);
      setTimeout(() => {
        connectDB();
      }, retryDelay);
    } else {
      console.error('💥 Max connection attempts reached. Exiting...');
      process.exit(1);
    }
  }
};

// Get human-readable connection state
const getConnectionState = (state) => {
  const states = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting',
    99: 'Uninitialized'
  };
  return states[state] || 'Unknown';
};

// Connection event handlers
const setupConnectionHandlers = () => {
  // Connection successful
  mongoose.connection.on('connected', () => {
    console.log('🎉 Mongoose connected to MongoDB');
  });

  // Connection error
  mongoose.connection.on('error', (err) => {
    console.error('💥 Mongoose connection error:', err.message);
    
    // Log additional error details in development
    if (config.nodeEnv === 'development') {
      console.error('Error details:', err);
    }
  });

  // Connection disconnected
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  Mongoose disconnected from MongoDB');
    
    // Attempt reconnection if not in shutdown process
    if (!isShuttingDown && connectionAttempts < maxRetryAttempts) {
      console.log('🔄 Attempting to reconnect...');
      setTimeout(() => {
        connectDB();
      }, retryDelay);
    }
  });

  // Connection reconnected
  mongoose.connection.on('reconnected', () => {
    console.log('🔄 Mongoose reconnected to MongoDB');
  });

  // MongoDB server selection timeout
  mongoose.connection.on('timeout', () => {
    console.warn('⏰ MongoDB server selection timeout');
  });

  // When the connection pool is created
  mongoose.connection.on('open', () => {
    console.log('🔓 MongoDB connection pool opened');
  });

  // When the connection pool is closed
  mongoose.connection.on('close', () => {
    console.log('🔒 MongoDB connection pool closed');
  });

  // Connection buffer full
  mongoose.connection.on('fullsetup', () => {
    console.log('🔧 MongoDB replica set connection established');
  });

  // All connections in pool established
  mongoose.connection.on('all', () => {
    console.log('🌐 All MongoDB connections established');
  });
};

// Graceful shutdown handling
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n📤 ${signal} received. Closing MongoDB connections gracefully...`);

  try {
    // Set a timeout for graceful shutdown
    const shutdownTimeout = setTimeout(() => {
      console.error('⚠️  Graceful shutdown timeout. Forcing exit...');
      process.exit(1);
    }, 10000); // 10 seconds timeout

    // Close all mongoose connections
    await mongoose.connection.close();
    clearTimeout(shutdownTimeout);
    
    console.log('✅ MongoDB connections closed successfully');
    console.log('👋 Database disconnection completed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Setup graceful shutdown handlers
const setupShutdownHandlers = () => {
  // Handle different termination signals
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Promise Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
};

// Database health check
const healthCheck = () => {
  const state = mongoose.connection.readyState;
  const isConnected = state === 1;
  
  return {
    status: isConnected ? 'healthy' : 'unhealthy',
    state: getConnectionState(state),
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    readyState: state,
    connectionAttempts,
    maxRetryAttempts
  };
};

// Get database statistics
const getStats = () => {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  return {
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    port: mongoose.connection.port,
    readyState: getConnectionState(mongoose.connection.readyState),
    collections: Object.keys(mongoose.connection.collections),
    models: mongoose.modelNames(),
    connectionOptions: {
      maxPoolSize: mongoose.connection.options?.maxPoolSize,
      minPoolSize: mongoose.connection.options?.minPoolSize,
      connectTimeoutMS: mongoose.connection.options?.connectTimeoutMS
    }
  };
};

// Initialize database connection with all handlers
const initializeDatabase = async () => {
  try {
    console.log('🚀 Initializing database connection...');
    
    // Setup event handlers first
    setupConnectionHandlers();
    setupShutdownHandlers();
    
    // Connect to database
    await connectDB();
    
    console.log('✅ Database initialization completed');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Disconnect from database
const disconnect = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      console.log('📤 Closing database connection...');
      await mongoose.connection.close();
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};

// Force reconnection
const reconnect = async () => {
  try {
    console.log('🔄 Forcing database reconnection...');
    await disconnect();
    await connectDB();
    console.log('✅ Database reconnection completed');
  } catch (error) {
    console.error('❌ Database reconnection failed:', error);
    throw error;
  }
};

module.exports = {
  connectDB: initializeDatabase, // Use the enhanced initialization
  disconnect,
  reconnect,
  healthCheck,
  getStats,
  // Export individual functions for flexibility
  rawConnect: connectDB,
  gracefulShutdown
};
