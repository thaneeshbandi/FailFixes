require('dotenv').config();
// server.js
// Load environment variables from .env


const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const { quitRedis } = require('./app');
const { connectDB, beginShutdown } = require('./utils/database');
const { initSocket } = require('./socket');
const { getAllowedOrigins } = require('./config/cors');
const config = require('./config/config');

// NOTE: this file used to log an "EMAIL PROVIDER STATUS" banner on every boot.
// There is no email in this application: utils/emailService.js (Resend) existed
// but nothing imported it, and the verify-email route had already been removed.
// The module and the `resend` dependency are gone; a startup banner advertising
// a feature that does not exist is worse than silence.

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Stack trace:', err.stack);
  process.exit(1);
});

// Initialize server with Socket.IO
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Create HTTP server from Express app
    const server = http.createServer(app);

    // SETUP SOCKET.IO SERVER
    const io = socketIo(server, {
      cors: {
        // Same allowlist as the REST API (config/cors.js) — these two lists had
        // drifted, leaving the Vercel production origin unable to open a socket.
        origin: getAllowedOrigins(),
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
      transports: ['websocket', 'polling'], // Important for Render
      // Chat messages are capped at 1000 characters; the 1MB default just gives
      // an attacker a cheap way to push large frames at the server.
      maxHttpBufferSize: 64 * 1024,
      // Engine.IO v3 compatibility is only needed for socket.io-client v2.
      // This app pins socket.io-client ^4, so the older protocol is off.
      allowEIO3: false,
    });

    // SOCKET.IO AUTH + HANDLERS
    // Implemented in ./socket. That module reuses utils/token.js for handshake
    // verification (algorithm pin + isActive + tokenVersion) and authorizes
    // every room join against chat participation.
    //
    // Async because it attaches the Redis adapter when REDIS_URL is set, which
    // requires two connected Redis clients. Awaited before listen() so no socket
    // can be accepted before the auth middleware and adapter are in place.
    const socketRuntime = await initSocket(io);

    // Make io accessible to routes
    app.set('io', io);

    // Use PORT from environment or default
    const PORT = process.env.PORT || config.port || 5000;

    // Start HTTP server with Socket.IO
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                     🎉 FailFixes Server                      ║
║                     Started Successfully!                    ║
╠══════════════════════════════════════════════════════════════╣
║ 🌐 Port: ${PORT.toString().padEnd(47)} ║
║ 📱 Environment: ${(process.env.NODE_ENV || 'development').padEnd(36)} ║
║ 🕒 Started: ${new Date().toLocaleString().padEnd(38)} ║
║ 🚀 API URL: http://localhost:${PORT}/api${' '.repeat(25)} ║
║ 🏥 Health: http://localhost:${PORT}/api/health${' '.repeat(18)} ║
║ 💬 Socket.IO: ${(socketRuntime.presence.isShared()
        ? 'ENABLED (Redis adapter)'
        : 'ENABLED (single instance)'
      ).padEnd(40)} ║
║ 📊 Database: ${
        config.database.uri.includes('mongodb.net')
          ? 'MongoDB Atlas'.padEnd(33)
          : 'Local MongoDB'.padEnd(33)
      } ║
╚══════════════════════════════════════════════════════════════╝


🔧 Available Endpoints:
   • GET  /api/health           - Health check
   • POST /api/auth/login       - User login
   • POST /api/auth/register    - User registration
   • GET  /api/stories          - Get stories
   • GET  /api/users/suggested  - Get suggested users
   • GET  /api/users/dashboard  - User dashboard
   • GET  /api/chats            - Get user chats
   • POST /api/chats/direct     - Create direct chat


💡 Tips:
   • Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}
   • Socket.IO endpoint: http://localhost:${PORT}/socket.io/
   • Allowed origins: ${getAllowedOrigins().length} configured
      `);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('💥 UNHANDLED REJECTION! Shutting down...');
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);

      server.close(() => {
        process.exit(1);
      });
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal) => {
      console.log(`\n👋 ${signal} received, shutting down gracefully...`);

      // Suppress the database layer's auto-reconnect: from here on a
      // 'disconnected' event is expected, not a fault to recover from.
      beginShutdown();

      // This module is the ONLY owner of process lifecycle. app.js and
      // utils/database.js used to register competing handlers; a single signal
      // ran three sequences at once and the first process.exit() truncated the
      // rest. The order below matters:
      //
      //   1. stop accepting HTTP connections
      //   2. disconnect sockets and close the adapter's Redis clients — sockets
      //      must go first so their disconnect handlers can decrement the shared
      //      presence counters while Redis is still reachable
      //   3. close the cache's Redis client
      //   4. close MongoDB
      server.close(async () => {
        console.log('💤 HTTP server closed');

        try {
          await socketRuntime.close();
          console.log('📤 Socket.IO connections closed');
        } catch (err) {
          console.error('❌ Error closing Socket.IO connections:', err);
        }

        try {
          await quitRedis();
          console.log('📤 Redis cache connection closed');
        } catch (err) {
          console.error('❌ Error closing Redis connection:', err);
        }

        try {
          await require('mongoose').connection.close();
          console.log('📤 Database connection closed');
        } catch (err) {
          console.error('❌ Error closing database connection:', err);
        }

        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error(
          '⚠️  Could not close connections in time, forcefully shutting down'
        );
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
