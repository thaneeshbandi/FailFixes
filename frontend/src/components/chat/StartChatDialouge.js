import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  InputAdornment
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { userAPI, chatAPI } from '../../services/api';

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
      // You'll need to create this API endpoint
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Start New Chat</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />

        {loading ? (
          <Typography textAlign="center" py={2}>Searching...</Typography>
        ) : users.length === 0 && searchQuery ? (
          <Typography textAlign="center" py={2} color="text.secondary">
            No users found
          </Typography>
        ) : (
          <List>
            {users.map((user) => (
              <ListItem
                key={user._id}
                button
                onClick={() => handleStartChat(user._id)}
              >
                <ListItemAvatar>
                  <Avatar>{user.name.charAt(0)}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={user.name}
                  secondary={user.username ? `@${user.username}` : ''}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

export default StartChatDialog;
