require('dotenv').config();
console.log("ENV CHECK:", process.env.MONGODB_URI);
// server.js
// Load environment variables from .env


const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./app');
const { connectDB } = require('./utils/database');
const config = require('./config/config');

// 🔎 Resend status on startup (no direct SDK import here)
console.log('📧 EMAIL PROVIDER STATUS:', {
  usingResend: !!process.env.RESEND_API_KEY,
  resendFrom: process.env.RESEND_FROM_EMAIL || 'not set',
});

// Import models for Socket.IO
const User = require('./models/User');
const Chat = require('./models/Chat');

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

    // CORS for Render deployment (Socket.IO)
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'https://failfixes-frontend.onrender.com',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // SETUP SOCKET.IO SERVER with Render support
    const io = socketIo(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
      },
      transports: ['websocket', 'polling'], // Important for Render
      allowEIO3: true,
    });

    // SOCKET.IO AUTHENTICATION MIDDLEWARE
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.username = user.username || user.name;
        socket.userInfo = {
          id: user._id,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
        };

        next();
      } catch (err) {
        console.error('Socket auth error:', err);
        next(new Error('Authentication error'));
      }
    });

    // Active users tracking
    const activeUsers = new Map();

    // SOCKET.IO CONNECTION HANDLING
    io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.username} (${socket.userId})`);

      // Add user to active users
      activeUsers.set(socket.userId, {
        socketId: socket.id,
        userInfo: socket.userInfo,
        lastSeen: new Date(),
      });

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);

      // Broadcast user online status
      socket.broadcast.emit('userOnline', {
        userId: socket.userId,
        userInfo: socket.userInfo,
      });

      // Join user's existing chats
      socket.on('joinChats', async (chatIds) => {
        for (const chatId of chatIds) {
          socket.join(`chat_${chatId}`);
        }
      });

      // Handle joining a specific chat
      socket.on('joinChat', (chatId) => {
        socket.join(`chat_${chatId}`);
        console.log(`💬 ${socket.username} joined chat: ${chatId}`);
      });

      // Handle leaving a chat
      socket.on('leaveChat', (chatId) => {
        socket.leave(`chat_${chatId}`);
      });

      // Handle sending messages
      socket.on('sendMessage', async (data) => {
        try {
          const { chatId, content, messageType = 'text' } = data;

          const chat = await Chat.findById(chatId);
          if (!chat) {
            socket.emit('error', { message: 'Chat not found' });
            return;
          }

          if (!chat.participants.includes(socket.userId)) {
            socket.emit('error', {
              message: 'Not authorized to send messages',
            });
            return;
          }

          const newMessage = {
            sender: socket.userId,
            content: content.trim(),
            messageType,
          };

          chat.messages.push(newMessage);

          chat.lastMessage = {
            content: content.trim(),
            sender: socket.userId,
            timestamp: new Date(),
          };

          await chat.save();
          await chat.populate('messages.sender', 'name username avatar');

          const savedMessage = chat.messages[chat.messages.length - 1];

          io.to(`chat_${chatId}`).emit('newMessage', {
            chatId,
            message: savedMessage,
            chat: {
              _id: chat._id,
              lastMessage: chat.lastMessage,
            },
          });
        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing', (data) => {
        const { chatId, isTyping } = data;
        socket.to(`chat_${chatId}`).emit('userTyping', {
          userId: socket.userId,
          username: socket.username,
          isTyping,
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.username}`);
        activeUsers.delete(socket.userId);
        socket.broadcast.emit('userOffline', {
          userId: socket.userId,
        });
      });
    });

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
   • Allowed origins: ${allowedOrigins.length} configured
      `);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
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
