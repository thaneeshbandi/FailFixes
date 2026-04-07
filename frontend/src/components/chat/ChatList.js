import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Badge,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Chip
} from '@mui/material';
import { Search, Add } from '@mui/icons-material';
import { useSocket } from '../../context/SocketContexts';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../services/api';

function ChatList({ selectedChat, onSelectChat, onCreateChat }) {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { socket, onlineUsers } = useSocket();
  const { user } = useAuth();

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

  // ✅ FIXED: Safe filtering with proper null checks
  const filteredChats = chats.filter(chat => {
    if (!searchQuery.trim()) return true; // Show all chats if no search query
    
    const searchLower = searchQuery.toLowerCase();
    
    // Check chat name (for group chats)
    const nameMatch = chat.chatName && typeof chat.chatName === 'string' 
      ? chat.chatName.toLowerCase().includes(searchLower) 
      : false;
    
    // Check participants
    const participantMatch = chat.participants && Array.isArray(chat.participants)
      ? chat.participants.some(participant => {
          // Safely check participant name
          const nameMatches = participant.name && typeof participant.name === 'string'
            ? participant.name.toLowerCase().includes(searchLower)
            : false;
          
          // Safely check participant username
          const usernameMatches = participant.username && typeof participant.username === 'string'
            ? participant.username.toLowerCase().includes(searchLower)
            : false;
          
          return nameMatches || usernameMatches;
        })
      : false;
    
    return nameMatch || participantMatch;
  });

  const getChatDisplayName = (chat) => {
    if (chat.isGroupChat) return chat.chatName || 'Group Chat';
    const otherParticipant = chat.participants.find(p => p._id !== user._id);
    return otherParticipant?.name || 'Unknown User';
  };

  const getChatAvatar = (chat) => {
    if (chat.isGroupChat) return chat.chatName?.charAt(0) || 'G';
    const otherParticipant = chat.participants.find(p => p._id !== user._id);
    return otherParticipant?.name?.charAt(0) || 'U';
  };

  const isUserOnline = (chat) => {
    if (chat.isGroupChat) return false;
    const otherParticipant = chat.participants.find(p => p._id !== user._id);
    return onlineUsers.has(otherParticipant?._id);
  };

  const formatLastMessage = (chat) => {
    if (!chat.lastMessage) return 'No messages yet';
    const content = chat.lastMessage.content || '';
    return content.length > 50 ? `${content.substring(0, 50)}...` : content;
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight="bold">Messages</Typography>
          <IconButton onClick={onCreateChat} color="primary">
            <Add />
          </IconButton>
        </Box>
        
        <TextField
          fullWidth
          size="small"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value || '')} // ✅ Ensure string value
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {/* Chat List */}
      <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
        {loading ? (
          <Typography sx={{ p: 2, textAlign: 'center' }}>Loading...</Typography>
        ) : filteredChats.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </Typography>
        ) : (
          filteredChats.map((chat) => (
            <ListItem
              key={chat._id}
              button
              selected={selectedChat?._id === chat._id}
              onClick={() => onSelectChat(chat)}
              sx={{
                borderLeft: selectedChat?._id === chat._id ? 3 : 0,
                borderColor: 'primary.main',
                '&:hover': { backgroundColor: 'action.hover' }
              }}
            >
              <ListItemAvatar>
                <Badge
                  variant="dot"
                  color="success"
                  invisible={!isUserOnline(chat)}
                >
                  <Avatar sx={{ bgcolor: chat.isGroupChat ? 'secondary.main' : 'primary.main' }}>
                    {getChatAvatar(chat)}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight="medium">
                      {getChatDisplayName(chat)}
                    </Typography>
                    {(chat.unreadCount || 0) > 0 && (
                      <Chip
                        label={chat.unreadCount}
                        size="small"
                        color="primary"
                        sx={{ height: 20, fontSize: '0.75rem' }}
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {formatLastMessage(chat)}
                  </Typography>
                }
              />
            </ListItem>
          ))
        )}
      </List>
    </Paper>
  );
}

export default ChatList;
