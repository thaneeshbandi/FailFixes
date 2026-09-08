import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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

  // Rooms this client believes it is subscribed to.
  //
  // Socket.IO reconnects automatically, but a reconnected socket is a NEW socket
  // on the server with NO room memberships. Nothing re-joined them, so after any
  // network blip the client stayed connected and silently stopped receiving
  // messages until a full page reload. A ref (not state) because changing it
  // must not re-render or re-run the connection effect.
  const joinedChatsRef = useRef(new Set());

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
      console.log('✅ Connected to chat server. Socket ID:', s.id);
      setIsConnected(true);

      // Re-subscribe after a reconnect. Harmless on a first connect (the set is
      // empty) and the server re-authorizes every id, so this cannot be used to
      // rejoin a room the user has lost access to.
      const rooms = Array.from(joinedChatsRef.current);
      if (rooms.length > 0) {
        console.log('🔄 Re-joining', rooms.length, 'chat room(s) after reconnect');
        s.emit('joinChats', rooms);
      }
    });

    s.on('disconnect', (reason) => {
      console.log('❌ Disconnected from chat server:', reason);
      setIsConnected(false);
    });

    s.on('connect_error', (error) => {
      // The server sends one deliberately generic 'Authentication error' for
      // every auth failure, and 'Too many connections' when the account is at
      // its socket cap. Both are actionable; neither is a transport problem.
      console.error('🔌 Socket connection error:', error.message);
    });

    // The server reports refusals and throttling on an 'error' event. Nothing
    // surfaced these before, so a rate-limited or rejected action looked to the
    // user like the app had simply done nothing.
    s.on('error', (payload) => {
      console.warn('⚠️ Socket error from server:', payload);
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
      joinedChatsRef.current.clear();
    };
    // `user` is in the dependency list so a different account gets a socket
    // authenticated as that account.
  }, [isAuthenticated, user]);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    joinChat: (chatId) => {
      if (!socket || !chatId) return;
      joinedChatsRef.current.add(chatId);
      socket.emit('joinChat', chatId);
    },
    joinChats: (chatIds) => {
      if (!socket || !Array.isArray(chatIds)) return;
      chatIds.forEach((id) => joinedChatsRef.current.add(id));
      socket.emit('joinChats', chatIds);
    },
    leaveChat: (chatId) => {
      if (!socket || !chatId) return;
      joinedChatsRef.current.delete(chatId);
      socket.emit('leaveChat', chatId);
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
