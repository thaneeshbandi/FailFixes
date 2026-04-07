import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client'; // v4 named import
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const token = localStorage.getItem('ff_token') || localStorage.getItem('token');
    
    // ✅ FIXED: Remove '/api' suffix for Socket.IO connection
    let serverURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    // Remove '/api' from the end if it exists
    if (serverURL.endsWith('/api')) {
      serverURL = serverURL.slice(0, -4);
    }

    console.log('🔌 Connecting to Socket.IO server:', serverURL);

    // Establish connection
    const s = io(serverURL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      console.log('✅ Connected to chat server');
      console.log('Socket ID:', s.id);
      setIsConnected(true);
    });

    s.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server:', reason);
      setIsConnected(false);
    });

    s.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error.message);
    });

    s.on('userOnline', ({ userId }) => {
      console.log('👤 User online:', userId);
      setOnlineUsers(prev => new Set([...prev, userId]));
    });

    s.on('userOffline', ({ userId }) => {
      console.log('👤 User offline:', userId);
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    setSocket(s);

    return () => {
      console.log('🔌 Closing socket connection');
      s.close();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers(new Set());
    };
  }, [isAuthenticated, user]);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    joinChat: (chatId) => {
      if (socket) {
        console.log('📥 Joining chat:', chatId);
        socket.emit('joinChat', chatId);
      }
    },
    leaveChat: (chatId) => {
      if (socket) {
        console.log('📤 Leaving chat:', chatId);
        socket.emit('leaveChat', chatId);
      }
    },
    sendMessage: (data) => {
      if (socket) {
        console.log('💬 Sending message:', data);
        socket.emit('sendMessage', data);
      }
    },
    emitTyping: (data) => {
      if (socket) {
        socket.emit('typing', data);
      }
    },
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
