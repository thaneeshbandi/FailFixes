require('dotenv').config();
// server.js
// Load environment variables from .env


const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const { connectDB } = require('./utils/database');
const { initSocket } = require('./socket');
const { getAllowedOrigins } = require('./config/cors');
const config = require('./config/config');

// 🔎 Resend status on startup (no direct SDK import here)
console.log('📧 EMAIL PROVIDER STATUS:', {
  usingResend: !!process.env.RESEND_API_KEY,
  resendFrom: process.env.RESEND_FROM_EMAIL || 'not set',
});

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
    initSocket(io);

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
║ 💬 Socket.IO: ENABLED${' '.repeat(33)} ║
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

      server.close(async () => {
        console.log('💤 HTTP server closed');

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
