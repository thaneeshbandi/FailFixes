import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Badge,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Search,
  Send,
  Add,
  Chat,
  Message,
  Favorite,
  EmojiEmotions,
  Star,
  ThumbUp,
  Close
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useSocket } from '../context/SocketContexts';
import { useAuth } from '../context/AuthContext';
import { chatAPI, userAPI } from '../services/api';

// ================== ANIMATIONS ==================
const gentleFloat = keyframes`
  0%, 100% { 
    transform: translateY(0px) rotate(0deg); 
  }
  50% { 
    transform: translateY(-15px) rotate(5deg); 
  }
`;

const slowSpin = keyframes`
  0% { 
    transform: rotate(0deg) scale(1); 
  }
  50% { 
    transform: rotate(180deg) scale(1.1); 
  }
  100% { 
    transform: rotate(360deg) scale(1); 
  }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// ================== STYLED COMPONENTS ==================
const ChatContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  height: '100%',
  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  overflow: 'hidden',
  borderRadius: '16px',
}));

const FloatingIcon = styled(Box)(({ theme, top, left, delay, size }) => ({
  position: 'absolute',
  top: top || '20%',
  left: left || '10%',
  opacity: 0.08,
  fontSize: size || '2rem',
  color: '#81c784',
  animation: `${gentleFloat} ${6 + (delay || 0)}s ease-in-out infinite`,
  animationDelay: `${delay || 0}s`,
  pointerEvents: 'none',
  zIndex: 1,
}));

const SpinningIcon = styled(Box)(({ theme, top, right, delay, size }) => ({
  position: 'absolute',
  top: top || '60%',
  right: right || '15%',
  opacity: 0.06,
  fontSize: size || '1.5rem',
  color: '#f8bbd9',
  animation: `${slowSpin} ${10 + (delay || 0)}s linear infinite`,
  animationDelay: `${delay || 0}s`,
  pointerEvents: 'none',
  zIndex: 1,
}));

// ✅ FIXED: Message Row with proper left/right alignment like Instagram
const MessageRow = styled(Box)(({ isCurrentUser }) => ({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
  alignItems: 'flex-end',
  marginBottom: '8px',
  width: '100%',
  padding: '0 12px',
  animation: `${slideIn} 0.3s ease-out`,
}));

// ✅ FIXED: Chat Bubble with proper sizing
const ChatBubble = styled(Box)(({ isCurrentUser }) => ({
  maxWidth: '65%',
  padding: '8px 12px',
  borderRadius: isCurrentUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
  backgroundColor: isCurrentUser ? '#0095f6' : '#efefef',
  color: isCurrentUser ? '#ffffff' : '#000000',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
  wordBreak: 'break-word',
  transition: 'all 0.2s ease',
}));

const MessagesArea = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: theme.spacing(2, 0),
  position: 'relative',
  zIndex: 2,
  background: 'transparent',
  display: 'flex',
  flexDirection: 'column',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(0,0,0,0.03)',
    borderRadius: '10px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'linear-gradient(135deg, rgba(0,149,246,0.3), rgba(129,199,132,0.3))',
    borderRadius: '10px',
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(0,149,246,0.5), rgba(129,199,132,0.5))',
    }
  },
}));

const StyledListItem = styled(ListItem)(({ selected }) => ({
  cursor: 'pointer',
  borderRadius: '12px',
  margin: '4px 8px',
  padding: '12px',
  transition: 'all 0.2s ease',
  backgroundColor: selected ? 'rgba(0, 149, 246, 0.08)' : 'transparent',
  borderLeft: selected ? '3px solid #0095f6' : '3px solid transparent',
  '&:hover': {
    backgroundColor: selected ? 'rgba(0, 149, 246, 0.12)' : 'rgba(0, 0, 0, 0.04)',
    transform: 'translateX(4px)',
  }
}));

// ================== START CHAT DIALOG COMPONENT ==================
function StartChatDialog({ open, onClose, onChatCreated }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && searchQuery.trim()) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery, open]);

  const searchUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.searchUsers({ query: searchQuery });
      if (response.data.success) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error('Search users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (userId) => {
    try {
      const response = await chatAPI.createDirectChat(userId);
      if (response.data.success) {
        onChatCreated(response.data.chat);
        onClose();
        setSearchQuery('');
        setUsers([]);
      }
    } catch (error) {
      console.error('Start chat error:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #81c784, #aed581)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6" fontWeight="bold">Start New Chat</Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        <TextField
          fullWidth
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: '24px',
              backgroundColor: '#f0f2f5',
              '&:hover': { backgroundColor: '#e8eaed' },
              '& fieldset': { border: 'none' }
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: '#65676b' }} />
              </InputAdornment>
            )
          }}
        />

        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress sx={{ color: '#81c784' }} />
          </Box>
        ) : users.length === 0 && searchQuery ? (
          <Typography textAlign="center" py={3} color="text.secondary">
            No users found
          </Typography>
        ) : (
          <List sx={{ maxHeight: '400px', overflow: 'auto' }}>
            {users.map((user) => (
              <ListItem
                key={user._id}
                onClick={() => handleStartChat(user._id)}
                sx={{
                  borderRadius: '12px',
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 149, 246, 0.08)',
                    transform: 'translateX(4px)',
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ 
                    background: 'linear-gradient(135deg, #81c784, #aed581)',
                    fontWeight: 'bold'
                  }}>
                    {user.name?.charAt(0) || 'U'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography fontWeight="600">{user.name}</Typography>
                  }
                  secondary={user.username ? `@${user.username}` : ''}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ================== CHAT LIST COMPONENT ==================
function ChatList({ selectedChat, onSelectChat, onCreateChat, chats, loading, searchQuery, setSearchQuery }) {
  const { onlineUsers } = useSocket();
  const { user } = useAuth();

  const filteredChats = chats.filter(chat => {
    if (!searchQuery.trim()) return true;
    
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = chat.chatName?.toLowerCase().includes(searchLower);
    const participantMatch = chat.participants?.some(participant => 
      participant.name?.toLowerCase().includes(searchLower) ||
      participant.username?.toLowerCase().includes(searchLower)
    );
    
    return nameMatch || participantMatch;
  });

  const getChatDisplayName = (chat) => {
    if (chat.isGroupChat) return chat.chatName || 'Group Chat';
    const otherParticipant = chat.participants?.find(p => p._id !== user._id);
    return otherParticipant?.name || 'Unknown User';
  };

  const getChatAvatar = (chat) => {
    if (chat.isGroupChat) return chat.chatName?.charAt(0) || 'G';
    const otherParticipant = chat.participants?.find(p => p._id !== user._id);
    return otherParticipant?.name?.charAt(0) || 'U';
  };

  const isUserOnline = (chat) => {
    if (chat.isGroupChat) return false;
    const otherParticipant = chat.participants?.find(p => p._id !== user._id);
    return onlineUsers.has(otherParticipant?._id);
  };

  const formatLastMessage = (chat) => {
    if (!chat.lastMessage) return 'Start conversation...';
    const content = chat.lastMessage.content || '';
    return content.length > 35 ? `${content.substring(0, 35)}...` : content;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <Paper sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      borderRadius: '16px',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
    }}>
      <Box sx={{ 
        p: 2.5,
        background: 'linear-gradient(135deg, #81c784, #aed581)',
        color: 'white'
      }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" fontWeight="bold">Messages</Typography>
          <IconButton onClick={onCreateChat} sx={{ 
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' }
          }}>
            <Add />
          </IconButton>
        </Box>
        
        <TextField
          fullWidth
          size="small"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value || '')}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '24px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 1)' },
              '& fieldset': { border: 'none' }
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: '#65676b' }} />
              </InputAdornment>
            )
          }}
        />
      </Box>

      <List sx={{ 
        flex: 1, 
        overflow: 'auto', 
        p: 0,
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(0,0,0,0.03)',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(129,199,132,0.3)',
          borderRadius: '10px',
          '&:hover': {
            background: 'rgba(129,199,132,0.5)',
          }
        },
      }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress sx={{ color: '#81c784' }} />
          </Box>
        ) : filteredChats.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </Typography>
        ) : (
          filteredChats.map((chat) => (
            <StyledListItem
              key={chat._id}
              selected={selectedChat?._id === chat._id}
              onClick={() => onSelectChat(chat)}
            >
              <ListItemAvatar>
                <Badge
                  variant="dot"
                  color="success"
                  invisible={!isUserOnline(chat)}
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: '#44b700',
                      boxShadow: '0 0 0 2px #fff'
                    }
                  }}
                >
                  <Avatar sx={{ 
                    bgcolor: chat.isGroupChat ? '#9c27b0' : 'linear-gradient(135deg, #81c784, #aed581)',
                    background: chat.isGroupChat ? '#9c27b0' : 'linear-gradient(135deg, #81c784, #aed581)',
                    fontWeight: 'bold',
                    width: 50,
                    height: 50
                  }}>
                    {getChatAvatar(chat)}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" fontWeight="600" sx={{ flex: 1 }}>
                      {getChatDisplayName(chat)}
                    </Typography>
                    {chat.lastMessage && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', ml: 1 }}>
                        {formatTime(chat.lastMessage.createdAt)}
                      </Typography>
                    )}
                  </Box>
                }
                secondary={
                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.5}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        flex: 1,
                        fontSize: '0.85rem'
                      }}
                    >
                      {formatLastMessage(chat)}
                    </Typography>
                    {(chat.unreadCount || 0) > 0 && (
                      <Chip
                        label={chat.unreadCount}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          backgroundColor: '#0095f6',
                          color: 'white',
                          ml: 1
                        }}
                      />
                    )}
                  </Box>
                }
              />
            </StyledListItem>
          ))
        )}
      </List>
    </Paper>
  );
}

// ================== CHAT WINDOW COMPONENT ==================
function ChatWindow({ chat }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState([]);
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

    socket.on('userTyping', (data) => {
      if (data.userId !== user._id) {
        setTyping(prev => {
          if (data.isTyping) {
            return [...prev.filter(u => u.userId !== data.userId), data];
          } else {
            return prev.filter(u => u.userId !== data.userId);
          }
        });
      }
    });

    return () => {
      socket.off('newMessage');
      socket.off('userTyping');
    };
  }, [socket, chat, user]);

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
    socket.emit('typing', { chatId: chat._id, isTyping: false });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (value) => {
    setNewMessage(value);
    if (socket && chat) {
      socket.emit('typing', { 
        chatId: chat._id, 
        isTyping: value.trim().length > 0 
      });
    }
  };

  const getChatDisplayName = () => {
    if (!chat) return '';
    if (chat.isGroupChat) return chat.chatName || 'Group Chat';
    const otherParticipant = chat.participants?.find(p => p._id !== user._id);
    return otherParticipant?.name || 'Unknown User';
  };

  const getChatAvatarLetter = () => {
    if (!chat) return 'C';
    if (chat.isGroupChat) return chat.chatName?.charAt(0) || 'G';
    const otherParticipant = chat.participants?.find(p => p._id !== user._id);
    return otherParticipant?.name?.charAt(0) || 'U';
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

  if (!chat) {
    return (
      <ChatContainer>
        <FloatingIcon top="15%" left="10%" delay={0} size="3rem">
          <Chat />
        </FloatingIcon>
        <FloatingIcon top="65%" left="75%" delay={2} size="2.5rem">
          <Message />
        </FloatingIcon>
        <FloatingIcon top="40%" left="5%" delay={4} size="2rem">
          <EmojiEmotions />
        </FloatingIcon>
        <SpinningIcon top="25%" right="15%" delay={1} size="2rem">
          <Favorite />
        </SpinningIcon>
        <SpinningIcon top="70%" right="10%" delay={3} size="1.8rem">
          <Star />
        </SpinningIcon>
        
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative',
          zIndex: 2
        }}>
          <Paper sx={{ 
            p: 6, 
            borderRadius: 4, 
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))',
            backdropFilter: 'blur(20px)',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            maxWidth: 450
          }}>
            <Box sx={{ fontSize: '4rem', mb: 2 }}>💬</Box>
            <Typography variant="h4" fontWeight="700" mb={2} sx={{ 
              background: 'linear-gradient(135deg, #81c784, #0095f6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Your Messages
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7, fontSize: '1.05rem' }}>
              Select a conversation from the sidebar to start chatting with your friends and connections
            </Typography>
          </Paper>
        </Box>
      </ChatContainer>
    );
  }

  return (
    <ChatContainer>
      <FloatingIcon top="8%" left="3%" delay={0} size="2rem"><Chat /></FloatingIcon>
      <FloatingIcon top="25%" left="90%" delay={1} size="1.8rem"><Message /></FloatingIcon>
      <FloatingIcon top="50%" left="2%" delay={2} size="2.2rem"><EmojiEmotions /></FloatingIcon>
      <FloatingIcon top="75%" left="92%" delay={3} size="1.5rem"><ThumbUp /></FloatingIcon>
      <SpinningIcon top="12%" right="8%" delay={0} size="1.8rem"><Favorite /></SpinningIcon>
      <SpinningIcon top="60%" right="5%" delay={2} size="1.6rem"><Star /></SpinningIcon>
      <SpinningIcon top="85%" right="10%" delay={4} size="2rem"><Send /></SpinningIcon>

      <Paper sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        zIndex: 2,
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.95))',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Chat Header */}
        <Box sx={{ 
          p: 2.5,
          background: 'linear-gradient(135deg, #81c784, #aed581)',
          color: 'white',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <Box display="flex" alignItems="center">
            <Avatar sx={{ 
              mr: 2, 
              width: 48,
              height: 48,
              background: 'rgba(255, 255, 255, 0.25)',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.5)',
              fontSize: '1.3rem',
              fontWeight: 700
            }}>
              {getChatAvatarLetter()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.25rem' }}>
                {getChatDisplayName()}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.95, fontSize: '0.85rem' }}>
                {chat.isGroupChat ? `${chat.participants?.length || 0} members` : 'Active now'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ✅ Messages Area - FIXED Instagram Style */}
        <MessagesArea>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress sx={{ color: '#81c784' }} size={50} />
            </Box>
          ) : (
            <>
              {messages.map((message, index) => {
                if (!message) return null;
                
                const isCurrentUser = message.sender?._id === user._id;
                const senderName = message.sender?.name || 'Unknown';
                const timestamp = formatTime(message.createdAt);

                return (
                  <MessageRow key={message._id || index} isCurrentUser={isCurrentUser}>
                    {/* ✅ Avatar on LEFT for OTHER user's messages */}
                    {!isCurrentUser && (
                      <Avatar sx={{ 
                        mr: 1, 
                        width: 28, 
                        height: 28,
                        background: 'linear-gradient(135deg, #81c784, #aed581)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        {senderName.charAt(0)}
                      </Avatar>
                    )}
                    
                    {/* ✅ Message Bubble */}
                    <ChatBubble isCurrentUser={isCurrentUser}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontSize: '0.95rem',
                          lineHeight: 1.4,
                          wordWrap: 'break-word'
                        }}
                      >
                        {message.content || 'No content'}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ 
                          display: 'block',
                          textAlign: 'right',
                          opacity: 0.7,
                          fontSize: '0.7rem',
                          mt: 0.5,
                          color: isCurrentUser ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)'
                        }}
                      >
                        {timestamp}
                      </Typography>
                    </ChatBubble>
                    
                    {/* ✅ Avatar on RIGHT for YOUR messages */}
                    {isCurrentUser && (
                      <Avatar sx={{ 
                        ml: 1, 
                        width: 28, 
                        height: 28,
                        background: 'linear-gradient(135deg, #0095f6, #00d4ff)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        {user?.name?.charAt(0) || 'Y'}
                      </Avatar>
                    )}
                  </MessageRow>
                );
              })}
              
              {/* Typing Indicator */}
              {typing.length > 0 && (
                <MessageRow isCurrentUser={false}>
                  <Avatar sx={{ 
                    mr: 1, 
                    width: 28, 
                    height: 28, 
                    background: 'linear-gradient(135deg, #e0e0e0, #f5f5f5)',
                    color: '#666',
                    fontSize: '0.85rem'
                  }}>
                    {typing[0]?.username?.charAt(0) || 'U'}
                  </Avatar>
                  <Chip 
                    label={`typing...`}
                    size="small" 
                    sx={{
                      background: '#efefef',
                      color: '#999',
                      borderRadius: '16px',
                      fontSize: '0.75rem',
                      height: '32px',
                      px: 1.5
                    }}
                  />
                </MessageRow>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </MessagesArea>

        {/* Input Area */}
        <Box sx={{ 
          p: 2.5,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 249, 250, 0.98))',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(0, 0, 0, 0.08)'
        }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Message..."
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value || '')}
            onKeyPress={handleKeyPress}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '24px',
                backgroundColor: '#f0f2f5',
                fontSize: '0.95rem',
                padding: '8px 16px',
                '&:hover': { 
                  backgroundColor: '#e8eaed',
                },
                '&.Mui-focused': {
                  backgroundColor: '#ffffff',
                  boxShadow: '0 0 0 2px rgba(0, 149, 246, 0.2)',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#0095f6',
                  }
                },
                '& .MuiOutlinedInput-notchedOutline': { 
                  border: '1px solid rgba(0, 0, 0, 0.08)' 
                }
              }
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton 
                    onClick={handleSendMessage} 
                    disabled={!newMessage.trim()} 
                    sx={{
                      background: newMessage.trim() 
                        ? 'linear-gradient(135deg, #0095f6, #00d4ff)' 
                        : 'transparent',
                      color: newMessage.trim() ? 'white' : '#bdc1c6',
                      width: 36,
                      height: 36,
                      '&:hover': {
                        background: newMessage.trim() 
                          ? 'linear-gradient(135deg, #0077cc, #00b4d8)' 
                          : 'transparent',
                        transform: newMessage.trim() ? 'scale(1.1)' : 'none',
                      },
                      '&:active': {
                        transform: 'scale(0.95)',
                      },
                      transition: 'all 0.2s ease',
                      '&.Mui-disabled': {
                        color: '#bdc1c6'
                      }
                    }}
                  >
                    <Send sx={{ fontSize: '1.1rem' }} />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>
      </Paper>
    </ChatContainer>
  );
}

// ================== MAIN CHAT PAGE COMPONENT ==================
function ChatPage() {
  const [selectedChat, setSelectedChat] = useState(null);
  const [startChatOpen, setStartChatOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('newMessage', (data) => {
      setChats(prevChats => 
        prevChats.map(chat => 
          chat._id === data.chatId 
            ? { 
                ...chat, 
                lastMessage: data.chat.lastMessage, 
                unreadCount: chat._id === selectedChat?._id ? chat.unreadCount : (chat.unreadCount || 0) + 1 
              }
            : chat
        )
      );
    });

    return () => socket.off('newMessage');
  }, [socket, selectedChat]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await chatAPI.getChats();
      if (response.data.success) {
        setChats(response.data.chats);
        const chatIds = response.data.chats.map(chat => chat._id);
        socket?.emit('joinChats', chatIds);
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChat = () => {
    setStartChatOpen(true);
  };

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setChats(prevChats => 
      prevChats.map(c => 
        c._id === chat._id ? { ...c, unreadCount: 0 } : c
      )
    );
  };

  const handleChatCreated = (chat) => {
    setSelectedChat(chat);
    fetchChats();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3, height: 'calc(100vh - 100px)' }}>
      <Grid container spacing={2} sx={{ height: '100%' }}>
        <Grid item xs={12} md={4} sx={{ height: '100%' }}>
          <ChatList
            selectedChat={selectedChat}
            onSelectChat={handleSelectChat}
            onCreateChat={handleCreateChat}
            chats={chats}
            loading={loading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </Grid>
        <Grid item xs={12} md={8} sx={{ height: '100%' }}>
          <ChatWindow chat={selectedChat} />
        </Grid>
      </Grid>

      <StartChatDialog
        open={startChatOpen}
        onClose={() => setStartChatOpen(false)}
        onChatCreated={handleChatCreated}
      />
    </Container>
  );
}

export default ChatPage;
