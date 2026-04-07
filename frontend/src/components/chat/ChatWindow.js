import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Avatar,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../services/api';

function ChatWindow({ chat }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (chat && socket) {
      fetchMessages();
      socket.emit('joinChat', chat._id);
      markChatAsRead();
    }
    return () => {
      if (chat && socket) {
        socket.emit('leaveChat', chat._id);
      }
    };
  }, [chat, socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on('newMessage', (data) => {
      if (data.chatId === chat?._id) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
        markChatAsRead();
      }
    });

    return () => {
      socket.off('newMessage');
    };
  }, [socket, chat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!chat) return;
    try {
      setLoading(true);
      const response = await chatAPI.getChatMessages(chat._id);
      if (response.data.success) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markChatAsRead = async () => {
    if (!chat || !socket) return;
    try {
      socket.emit('markChatAsRead', chat._id);
      await chatAPI.markChatAsRead(chat._id);
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !socket || !chat) return;

    socket.emit('sendMessage', {
      chatId: chat._id,
      content: newMessage.trim(),
      messageType: 'text'
    });

    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getOtherUser = () => {
    if (!chat || chat.isGroupChat) return null;
    return chat.participants?.find(p => p._id !== user._id);
  };

  const getChatDisplayName = () => {
    if (!chat) return '';
    if (chat.isGroupChat) return chat.chatName || 'Group Chat';
    const otherUser = getOtherUser();
    return otherUser?.name || otherUser?.username || 'Unknown User';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return '';
    }
  };

  // 🎯 CRITICAL: Check if message is from current user
  const isMyMessage = (message) => {
    if (!message || !user) return false;

    // Handle different sender formats
    const senderId = typeof message.sender === 'string' 
      ? message.sender 
      : message.sender?._id;
    
    const userId = typeof user === 'string' 
      ? user 
      : user?._id;

    const result = String(senderId) === String(userId);

    console.log('🔍 Message Check:', {
      content: message.content?.substring(0, 15),
      senderId: String(senderId),
      userId: String(userId),
      isMine: result
    });

    return result;
  };

  if (!chat) {
    return (
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f2f5'
      }}>
        <Paper sx={{ p: 5, textAlign: 'center', maxWidth: 400, borderRadius: 4 }}>
          <Typography variant="h5" fontWeight="bold" mb={2}>
            💬 Select a Chat
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Choose a conversation to start messaging
          </Typography>
        </Paper>
      </Box>
    );
  }

  const otherUser = getOtherUser();

  return (
    <Box sx={{ 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#f0f2f5'
    }}>
      <Paper sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 0,
        boxShadow: 'none'
      }}>
        {/* Header */}
        <Box sx={{ 
          p: 2, 
          background: '#075e54',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}>
          <Avatar sx={{ 
            width: 40,
            height: 40,
            bgcolor: 'rgba(255,255,255,0.2)'
          }}>
            {getChatDisplayName().charAt(0).toUpperCase()}
          </Avatar>
          <Box flex={1}>
            <Typography variant="subtitle1" fontWeight="600">
              {getChatDisplayName()}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              {chat.isGroupChat ? `${chat.participants?.length || 0} members` : 'online'}
            </Typography>
          </Box>
        </Box>

        {/* 🎯 MESSAGES AREA - LIKE IMAGE 2 */}
        <Box sx={{ 
          flex: 1,
          overflowY: 'auto',
          p: 2,
          background: '#e5ddd5',
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23e5ddd5\'/%3E%3C/svg%3E")',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5
        }}>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {messages.map((message, index) => {
                if (!message) return null;

                const isMine = isMyMessage(message);

                return (
                  <Box
                    key={message._id || index}
                    sx={{
                      display: 'flex',
                      // 🎯 MY MESSAGES GO RIGHT, OTHERS GO LEFT
                      justifyContent: isMine ? 'flex-end' : 'flex-start',
                      mb: 0.5
                    }}
                  >
                    {/* 🎯 MESSAGE BUBBLE */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: 0.5,
                        maxWidth: '65%'
                      }}
                    >
                      {/* Avatar for other user (left) */}
                      {!isMine && (
                        <Avatar 
                          sx={{ 
                            width: 28, 
                            height: 28,
                            bgcolor: '#25d366',
                            fontSize: '0.85rem'
                          }}
                        >
                          {(otherUser?.name || 'U').charAt(0).toUpperCase()}
                        </Avatar>
                      )}

                      {/* Message Content */}
                      <Paper
                        elevation={1}
                        sx={{
                          p: 1.5,
                          // 🎯 BLUE FOR MY MESSAGES (RIGHT), WHITE FOR OTHERS (LEFT)
                          bgcolor: isMine ? '#0b93f6' : '#ffffff',
                          color: isMine ? '#ffffff' : '#000000',
                          borderRadius: 2,
                          borderTopLeftRadius: isMine ? 16 : 4,
                          borderTopRightRadius: isMine ? 4 : 16,
                          wordBreak: 'break-word',
                          boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                          position: 'relative'
                        }}
                      >
                        {/* Sender name for other user */}
                        {!isMine && (
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              display: 'block',
                              fontWeight: 600,
                              color: '#25d366',
                              mb: 0.3
                            }}
                          >
                            {otherUser?.name || otherUser?.username || 'User'}
                          </Typography>
                        )}

                        {/* Message text */}
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontSize: '0.9rem',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {message.content}
                        </Typography>
                        
                        {/* Timestamp */}
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontSize: '0.65rem',
                            opacity: 0.7,
                            display: 'block',
                            textAlign: 'right',
                            mt: 0.3,
                            color: isMine ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)'
                          }}
                        >
                          {formatTime(message.createdAt)}
                        </Typography>
                      </Paper>

                      {/* Avatar for current user (right) */}
                      {isMine && (
                        <Avatar 
                          sx={{ 
                            width: 28, 
                            height: 28,
                            bgcolor: '#0b93f6',
                            fontSize: '0.85rem'
                          }}
                        >
                          {(user?.name || 'M').charAt(0).toUpperCase()}
                        </Avatar>
                      )}
                    </Box>
                  </Box>
                );
              })}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </Box>

        {/* Input Area */}
        <Box sx={{ 
          p: 1.5, 
          bgcolor: '#f0f2f5',
          borderTop: '1px solid #e0e0e0'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            bgcolor: 'white',
            borderRadius: 3,
            p: 0.5,
            pr: 1
          }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type a message"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              variant="standard"
              sx={{
                px: 1.5,
                '& .MuiInput-root': {
                  '&:before': { borderBottom: 'none' },
                  '&:after': { borderBottom: 'none' },
                  '&:hover:not(.Mui-disabled):before': { borderBottom: 'none' }
                }
              }}
              InputProps={{
                disableUnderline: true
              }}
            />
            
            <IconButton 
              onClick={handleSendMessage} 
              disabled={!newMessage.trim()}
              sx={{
                bgcolor: newMessage.trim() ? '#0b93f6' : 'transparent',
                color: newMessage.trim() ? 'white' : '#8696a0',
                width: 40,
                height: 40,
                '&:hover': {
                  bgcolor: newMessage.trim() ? '#0a7fd6' : 'rgba(0,0,0,0.05)'
                },
                '&:disabled': {
                  color: '#8696a0'
                }
              }}
            >
              <Send fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

export default ChatWindow;
