import React, { useState, useEffect, useCallback } from 'react';
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
  Button,
  Skeleton
} from '@mui/material';
import { ArrowBack, People } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { userAPI } from '../services/api';
import FollowButton from '../components/FollowButton';


function FollowersPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ 
    currentPage: 1, 
    totalFollowers: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });


  const fetchFollowers = useCallback(async (page = 1) => {
    if (!username) {
      setError('Username is required');
      setLoading(false);
      return;
    }


    try {
      setLoading(true);
      setError('');
      
      console.log('🔄 Fetching followers for:', username, 'page:', page);
      
      const response = await userAPI.getUserFollowers(username, { 
        page, 
        limit: 20 
      });


      console.log('📊 Followers API response:', response);


      const responseData = response.data || response;
      const followersData = responseData.followers || [];
      const paginationData = responseData.pagination || {
        currentPage: page,
        totalFollowers: followersData.length,
        totalPages: Math.ceil(followersData.length / 20),
        hasNext: false,
        hasPrev: false
      };


      setFollowers(followersData);
      setPagination(paginationData);
      
      console.log('✅ Followers loaded:', followersData.length);


    } catch (err) {
      console.error('❌ Followers error:', err);
      
      if (err.response?.status === 404) {
        setError(`User "${username}" not found`);
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else if (err.message === 'Network Error') {
        setError('Network error. Please check your connection.');
      } else {
        setError(err.response?.data?.message || 'Failed to load followers');
      }
      
      setFollowers([]);
      setPagination({ currentPage: 1, totalFollowers: 0, totalPages: 0, hasNext: false, hasPrev: false });
    } finally {
      setLoading(false);
    }
  }, [username]);


  useEffect(() => {
    if (username) {
      fetchFollowers(1);
    }
  }, [username, fetchFollowers]);


  const handleFollowChange = useCallback((followedUsername, isFollowing) => {
    console.log('🔄 Updating follow status:', followedUsername, isFollowing);
    
    setFollowers(prevFollowers => 
      prevFollowers.map(follower => {
        const followerUsername = follower.displayUsername || follower.username || follower.name;
        
        if (followerUsername && followerUsername.toLowerCase() === followedUsername.toLowerCase()) {
          return { ...follower, isFollowing };
        }
        return follower;
      })
    );
  }, []);


  const handleRetry = useCallback(() => {
    fetchFollowers(pagination.currentPage);
  }, [fetchFollowers, pagination.currentPage]);


  const handleLoadMore = useCallback(() => {
    if (pagination.hasNext && !loading) {
      fetchFollowers(pagination.currentPage + 1);
    }
  }, [fetchFollowers, pagination.hasNext, pagination.currentPage, loading]);


  if (loading && followers.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate(`/profile/${username}`)}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h5">
            Loading Followers...
          </Typography>
        </Box>
        
        <Paper>
          <List>
            {[...Array(5)].map((_, index) => (
              <ListItem key={index} sx={{ py: 2 }}>
                <ListItemAvatar>
                  <Skeleton variant="circular" width={56} height={56} />
                </ListItemAvatar>
                <ListItemText
                  primary={<Skeleton variant="text" width="60%" />}
                  secondary={
                    <Box>
                      <Skeleton variant="text" width="80%" />
                      <Skeleton variant="text" width="40%" />
                    </Box>
                  }
                />
                <Skeleton variant="rectangular" width={80} height={36} />
              </ListItem>
            ))}
          </List>
        </Paper>
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
          color="primary"
        >
          Back to Profile
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {username}'s Followers ({pagination.totalFollowers})
        </Typography>
      </Box>


      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}


      {/* Empty State */}
      {followers.length === 0 && !loading && !error ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No followers yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {username} doesn't have any followers yet.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate('/browse')}
            color="primary"
          >
            Discover Stories
          </Button>
        </Paper>
      ) : (
        /* Followers List */
        <Paper elevation={2}>
          <List disablePadding>
            {followers.map((follower, index) => {
              const followerUsername = follower.displayUsername || follower.username || follower.name;
              const followerId = follower._id || follower.id || `${followerUsername}-${index}`;
              
              return (
                <ListItem 
                  key={followerId}
                  divider={index < followers.length - 1}
                  sx={{ py: 2 }}
                >
                  <ListItemAvatar>
                    <Avatar 
                      sx={{ 
                        bgcolor: 'primary.main',
                        cursor: 'pointer',
                        width: 56,
                        height: 56,
                        fontSize: '1.5rem'
                      }}
                      onClick={() => navigate(`/profile/${followerUsername}`)}
                    >
                      {(follower.name || 'U').charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  
                  <ListItemText
                    primary={
                      <Typography 
                        variant="subtitle1"
                        sx={{ 
                          cursor: 'pointer',
                          fontWeight: 600,
                          '&:hover': { color: 'primary.main' }
                        }}
                        onClick={() => navigate(`/profile/${followerUsername}`)}
                      >
                        {follower.name || 'Anonymous User'}
                        {follower.username && follower.username !== follower.name && (
                          <Typography component="span" variant="body2" color="text.secondary">
                            {' '}@{follower.username}
                          </Typography>
                        )}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        {follower.bio && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {follower.bio.length > 100 
                              ? `${follower.bio.substring(0, 100)}...` 
                              : follower.bio
                            }
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {follower.stats?.followersCount || 0} followers • {follower.stats?.storiesCount || 0} stories
                        </Typography>
                      </Box>
                    }
                  />
                  
                  <FollowButton
                    username={followerUsername}
                    initialFollowStatus={follower.isFollowing}
                    onFollowChange={(isFollowing) => handleFollowChange(followerUsername, isFollowing)}
                    size="small"
                  />
                </ListItem>
              );
            })}
          </List>


          {/* Pagination / Load More */}
          {pagination.hasNext && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Button
                variant="outlined"
                onClick={handleLoadMore}
                disabled={loading}
                color="primary"
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading...
                  </>
                ) : (
                  'Load More Followers'
                )}
              </Button>
            </Box>
          )}


          {/* Show pagination info */}
          {followers.length > 0 && (
            <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary">
                Showing {followers.length} of {pagination.totalFollowers} followers
                {pagination.totalPages > 1 && (
                  <> • Page {pagination.currentPage} of {pagination.totalPages}</>
                )}
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Container>
  );
}


export default FollowersPage;
