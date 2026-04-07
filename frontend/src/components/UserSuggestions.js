import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Box,
  CircularProgress,
  Button,
  Chip,
  Stack,
  Tooltip,
  Alert,
  Collapse
} from '@mui/material';
import { 
  People, 
  Psychology, 
  TrendingUp, 
  GroupAdd,
  Favorite,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../services/api';
import FollowButton from './FollowButton';

function UserSuggestions() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [algorithm, setAlgorithm] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const response = await userAPI.getSuggestedUsers();
        console.log('📊 Suggestions response:', response.data);
        
        setUsers(response.data.users || []);
        setAlgorithm(response.data.algorithm || 'basic');
      } catch (error) {
        console.error('❌ Suggestions error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, []);

  const handleFollowChange = (username, isFollowing) => {
    setUsers(prev => prev.map(user => 
      (user.username === username || user.name === username)
        ? { ...user, isFollowing }
        : user
    ));
  };

  const handleToggleShowAll = () => {
    setShowAll(prev => !prev);
  };

  const getReasonDetails = (reason) => {
    switch (reason) {
      case 'friends_of_friends':
      case 'mutual_friends':
        return {
          icon: <GroupAdd fontSize="inherit" />,
          label: 'Mutual friends',
          color: 'primary',
          tooltip: 'Friends of people you follow'
        };
      case 'similar_interests':
        return {
          icon: <Favorite fontSize="inherit" />,
          label: 'Similar interests',
          color: 'secondary',
          tooltip: 'Likes similar content to you'
        };
      case 'similar_taste':
        return {
          icon: <Psychology fontSize="inherit" />,
          label: 'Similar taste',
          color: 'success',
          tooltip: 'Liked the same stories as you'
        };
      case 'trending':
        return {
          icon: <TrendingUp fontSize="inherit" />,
          label: 'Trending',
          color: 'warning',
          tooltip: 'Popular in the community'
        };
      default:
        return {
          icon: <People fontSize="inherit" />,
          label: 'Recommended',
          color: 'default',
          tooltip: 'Recommended for you'
        };
    }
  };

  const getPrimaryReason = (reasons) => {
    if (!reasons || !Array.isArray(reasons) || reasons.length === 0) {
      return 'trending';
    }
    
    const priorityOrder = [
      'friends_of_friends',
      'mutual_friends', 
      'similar_interests',
      'similar_taste',
      'trending'
    ];
    
    for (const priority of priorityOrder) {
      if (reasons.includes(priority)) {
        return priority;
      }
    }
    
    return reasons[0];
  };

  const renderUserItem = (user) => {
    const primaryReason = getPrimaryReason(user.reasons || user.suggestionReasons);
    const reasonDetails = getReasonDetails(primaryReason);
    const allReasons = user.reasons || user.suggestionReasons || [];
    
    return (
      <ListItem 
        key={user._id || user.userId} 
        disablePadding 
        sx={{ 
          py: 1.5,
          flexDirection: 'column',
          alignItems: 'flex-start',
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:last-child': { borderBottom: 'none' }
        }}
      >
        <Box display="flex" width="100%" alignItems="flex-start">
          <ListItemAvatar>
            <Avatar 
              src={user.avatar}
              sx={{ 
                bgcolor: 'primary.main',
                cursor: 'pointer',
                width: 48,
                height: 48
              }}
              onClick={() => navigate(`/profile/${user.username || user.displayUsername || user.name}`)}
            >
              {(user.name || 'U').charAt(0).toUpperCase()}
            </Avatar>
          </ListItemAvatar>
          
          <ListItemText
            sx={{ flex: 1 }}
            primary={
              <Box>
                <Typography 
                  variant="subtitle2"
                  sx={{ 
                    cursor: 'pointer',
                    fontWeight: 600,
                    '&:hover': { color: 'primary.main' }
                  }}
                  onClick={() => navigate(`/profile/${user.username || user.displayUsername || user.name}`)}
                >
                  {user.name}
                  {user.username && user.username !== user.name && (
                    <Typography component="span" variant="body2" color="text.secondary" fontWeight={400}>
                      {' '}@{user.username}
                    </Typography>
                  )}
                </Typography>
              </Box>
            }
            secondary={
              <Box mt={0.5}>
                {user.bio && (
                  <Typography variant="caption" display="block" color="text.primary" mb={0.5}>
                    {user.bio.length > 60 ? `${user.bio.substring(0, 60)}...` : user.bio}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {user.followersCount || user.stats?.followersCount || 0} followers
                  {user.mutualFriends > 0 && (
                    <> • {user.mutualFriends} mutual</>
                  )}
                </Typography>
              </Box>
            }
          />
          
          <FollowButton
            username={user.username || user.displayUsername || user.name}
            isFollowing={user.isFollowing}
            onFollowChange={(isFollowing) => handleFollowChange(
              user.username || user.displayUsername || user.name, 
              isFollowing
            )}
            size="small"
          />
        </Box>

        {allReasons.length > 0 && (
          <Stack 
            direction="row" 
            spacing={0.5} 
            mt={1} 
            ml={7}
            flexWrap="wrap"
            sx={{ gap: 0.5 }}
          >
            {allReasons.slice(0, 2).map((reason, index) => {
              const details = getReasonDetails(reason);
              return (
                <Tooltip key={index} title={details.tooltip} arrow>
                  <Chip
                    icon={details.icon}
                    label={details.label}
                    size="small"
                    color={details.color}
                    variant="outlined"
                    sx={{ 
                      height: 24,
                      fontSize: '0.7rem',
                      '& .MuiChip-icon': {
                        fontSize: '0.9rem'
                      }
                    }}
                  />
                </Tooltip>
              );
            })}
            {allReasons.length > 2 && (
              <Chip
                label={`+${allReasons.length - 2}`}
                size="small"
                variant="outlined"
                sx={{ height: 24, fontSize: '0.7rem' }}
              />
            )}
          </Stack>
        )}
      </ListItem>
    );
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="caption" display="block" mt={1} color="text.secondary">
          Finding users for you...
        </Typography>
      </Paper>
    );
  }

  if (users.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <People color="action" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="h6" gutterBottom>
          No Suggestions Yet
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Follow some users and like stories to get personalized suggestions!
        </Typography>
        <Button 
          variant="outlined" 
          size="small"
          onClick={() => navigate('/explore')}
        >
          Explore Stories
        </Button>
      </Paper>
    );
  }

  const initialUsers = users.slice(0, 5);
  const remainingUsers = users.slice(5);

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <People />
          Suggested For You
        </Typography>
        
        {algorithm === 'hybrid_graph' && (
          <Tooltip title="Powered by AI recommendations">
            <Chip 
              icon={<Psychology />}
              label="Smart"
              size="small"
              color="primary"
              variant="outlined"
            />
          </Tooltip>
        )}
      </Box>

      {algorithm === 'hybrid_graph' && (
        <Alert severity="info" sx={{ mb: 2, py: 0 }}>
          <Typography variant="caption">
            Based on your network and interests
          </Typography>
        </Alert>
      )}
      
      <List disablePadding>
        {initialUsers.map(user => renderUserItem(user))}
        
        {remainingUsers.length > 0 && (
          <Collapse in={showAll} timeout="auto" unmountOnExit>
            {remainingUsers.map(user => renderUserItem(user))}
          </Collapse>
        )}
      </List>
      
      {users.length > 5 && (
        <Box textAlign="center" mt={2}>
          <Button 
            variant="text" 
            size="small"
            onClick={handleToggleShowAll}
            startIcon={showAll ? <ExpandLess /> : <ExpandMore />}
            endIcon={<People />}
          >
            {showAll ? 'Show Less' : `See All ${users.length} Suggestions`}
          </Button>
        </Box>
      )}
    </Paper>
  );
}

export default UserSuggestions;
