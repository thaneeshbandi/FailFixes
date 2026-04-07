import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Paper,
  CircularProgress,
  Alert,
  Box,
  Button
} from '@mui/material';
import { ArrowBack, People } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { userAPI } from '../services/api';
import FollowButton from '../components/FollowButton';


function FollowingPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ currentPage: 1, totalFollowing: 0 });


  useEffect(() => {
    fetchFollowing();
  }, [username]);


  const fetchFollowing = async (page = 1) => {
    setLoading(true);
    try {
      const response = await userAPI.getUserFollowing(username, { page, limit: 20 });
      setFollowing(response.data.following || []);
      setPagination(response.data.pagination || { currentPage: 1, totalFollowing: 0 });
    } catch (err) {
      console.error('Following error:', err);
      setError('Failed to load following');
    } finally {
      setLoading(false);
    }
  };


  const handleFollowChange = (followedUsername, isFollowing) => {
    setFollowing(prev => prev.map(user => 
      (user.username === followedUsername || user.name === followedUsername)
        ? { ...user, isFollowing }
        : user
    ));
  };


  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }


  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/profile/${username}`)}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h5">
          Following ({pagination.totalFollowing})
        </Typography>
      </Box>


      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}


      {following.length === 0 && !loading ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Not following anyone yet
          </Typography>
          <Typography color="text.secondary">
            This user isn't following anyone yet.
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <List>
            {following.map((user, index) => (
              <ListItem 
                key={user._id}
                divider={index < following.length - 1}
                sx={{ py: 2 }}
              >
                <ListItemAvatar>
                  <Avatar 
                    sx={{ 
                      bgcolor: 'primary.main',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(`/profile/${user.displayUsername || user.username || user.name}`)}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                
                <ListItemText
                  primary={
                    <Typography 
                      variant="subtitle1"
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { color: 'primary.main' }
                      }}
                      onClick={() => navigate(`/profile/${user.displayUsername || user.username || user.name}`)}
                    >
                      {user.name}
                      {user.username && user.username !== user.name && (
                        <Typography component="span" variant="body2" color="text.secondary">
                          {' '}@{user.username}
                        </Typography>
                      )}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      {user.bio && (
                        <Typography variant="body2" color="text.secondary">
                          {user.bio.length > 100 ? `${user.bio.substring(0, 100)}...` : user.bio}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {user.stats?.followersCount || 0} followers • {user.stats?.storiesCount || 0} stories
                      </Typography>
                    </Box>
                  }
                />
                
                <FollowButton
                  username={user.displayUsername || user.username || user.name}
                  isFollowing={user.isFollowing}
                  onFollowChange={(isFollowing) => handleFollowChange(user.username || user.name, isFollowing)}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Container>
  );
}


export default FollowingPage;
