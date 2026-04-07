import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Avatar,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  useTheme,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Person,
  LocationOn,
  CalendarToday,
  Article,
  Favorite,
  Visibility,
  PersonAdd,
  PersonRemove,
  Share,
  Refresh,
  Edit
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// API Service functions
const userAPI = {
  getUserProfile: async (username) => {
    const response = await axios.get(`${API_BASE_URL}/users/profile/${username}`);
    return response;
  },
  trackProfileView: async (profileId) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_BASE_URL}/users/profile/${profileId}/view`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response;
  },
  followUser: async (username) => {
    const token = localStorage.getItem('token');
    const response = await axios.post(
      `${API_BASE_URL}/users/follow/${username}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return response;
  }
};

const storiesAPI = {
  getStoriesByAuthor: async (username, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await axios.get(`${API_BASE_URL}/stories/user/${username}?${queryString}`);
    return response;
  },
  trackStoryView: async (storyId) => {
    const response = await axios.post(`${API_BASE_URL}/stories/${storyId}/view`);
    return response;
  }
};

// Styled Components
const ProfileHeader = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #81c784, #aed581, #90caf9)',
  color: 'white',
  borderRadius: '24px',
  padding: theme.spacing(6),
  marginBottom: theme.spacing(4),
  position: 'relative',
  overflow: 'hidden'
}));

const StatsCard = styled(Card)(({ theme }) => ({
  borderRadius: '16px',
  textAlign: 'center',
  padding: theme.spacing(2),
  background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7))',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.3)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 25px rgba(0,0,0,0.12)',
  }
}));

const ActionButton = styled(Button)(({ variant: buttonVariant }) => ({
  borderRadius: '12px',
  padding: '12px 24px',
  fontWeight: 600,
  textTransform: 'none',
  ...(buttonVariant === 'follow' && {
    background: 'linear-gradient(135deg, #81c784, #aed581)',
    color: 'white',
    '&:hover': {
      background: 'linear-gradient(135deg, #66bb6a, #81c784)'
    }
  }),
  ...(buttonVariant === 'unfollow' && {
    background: 'linear-gradient(135deg, #f44336, #e57373)',
    color: 'white',
    '&:hover': {
      background: 'linear-gradient(135deg, #d32f2f, #f44336)'
    }
  })
}));

const StoryCard = styled(Card)(({ theme }) => ({
  borderRadius: '16px',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  border: '1px solid rgba(0,0,0,0.08)',
  '&:hover': {
    transform: 'translateY(-6px)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
    borderColor: '#81c784'
  }
}));

function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated } = useAuth();
  const theme = useTheme();

  // State management
  const [profile, setProfile] = useState(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [viewsUpdated, setViewsUpdated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Helper functions
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return 'U';
    
    const words = trimmedName.split(' ').filter(word => word.length > 0);
    if (words.length === 0) return 'U';
    
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      });
    } catch (error) {
      return 'Unknown';
    }
  };

  const formatNumber = (num) => {
    if (typeof num !== 'number') return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Calculate total story views from actual stories
  const calculateTotalStoryViews = () => {
    return stories.reduce((total, story) => {
      return total + (story.views || story.viewCount || 0);
    }, 0);
  };

  // Track profile view
  const trackProfileView = async (profileId) => {
    if (!isAuthenticated || !currentUser || !profileId) return;
    
    // Don't track views on own profile
    if (currentUser._id === profileId || currentUser.id === profileId) return;
    
    try {
      console.log('📊 Tracking profile view for:', profileId);
      await userAPI.trackProfileView(profileId);
      setViewsUpdated(true);
    } catch (error) {
      console.error('❌ Error tracking profile view:', error);
    }
  };

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setError('Username is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        setViewsUpdated(false);

        console.log('🔄 Fetching profile for username:', username);

        const response = await userAPI.getUserProfile(username);
        
        if (response.data && (response.data.success !== false)) {
          const profileData = response.data.user || response.data.profile || response.data;
          setProfile(profileData);
          console.log('✅ Profile data received:', profileData);

          // Track profile view after successful fetch
          if (!viewsUpdated && profileData) {
            setTimeout(() => trackProfileView(profileData._id || profileData.id), 1000);
          }
        } else {
          throw new Error('Profile not found');
        }
      } catch (err) {
        console.error('❌ Profile fetch error:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load profile');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username, isAuthenticated, currentUser]);

  // Fetch user stories
  useEffect(() => {
    const fetchStories = async () => {
      if (!username) return;

      try {
        setStoriesLoading(true);
        console.log('🔄 Fetching stories for username:', username);

        const response = await storiesAPI.getStoriesByAuthor(username, { 
          limit: 20,
          sort: 'createdAt',
          order: 'desc'
        });
        
        console.log('📝 Raw stories response:', response.data);
        
        if (response.data) {
          // Handle different response formats
          let storiesData = [];
          
          if (response.data.stories) {
            storiesData = response.data.stories;
          } else if (Array.isArray(response.data)) {
            storiesData = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            storiesData = response.data.data;
          }
          
          // Filter out any non-story content (like impact posts)
          const filteredStories = storiesData.filter(story => {
            if (!story) return false;
            
            // Filter out impact posts or other non-story content
            const isRegularStory = !story.type || 
                                  story.type === 'story' || 
                                  story.type === 'fail_story' ||
                                  story.type === 'experience';
            
            const notImpactPost = story.category !== 'impact' && 
                                 !story.title?.toLowerCase().includes('impact post');
            
            return isRegularStory && notImpactPost;
          });
          
          setStories(filteredStories);
          console.log('✅ Stories loaded and filtered:', filteredStories.length);
          console.log('📊 Sample story data:', filteredStories[0]);
        } else {
          setStories([]);
          console.log('⚠️ No stories data in response');
        }
      } catch (err) {
        console.error('❌ Stories fetch error:', err);
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        setStories([]);
      } finally {
        setStoriesLoading(false);
      }
    };

    fetchStories();
  }, [username]);

  // Handle story click with view tracking
  const handleStoryClick = async (story) => {
    try {
      // Track story view
      const storyId = story._id || story.id;
      if (storyId) {
        console.log('📊 Tracking story view:', storyId);
        await storiesAPI.trackStoryView(storyId);
        
        // Update local story views immediately
        setStories(prev => prev.map(s => 
          (s._id || s.id) === storyId 
            ? { ...s, views: (s.views || 0) + 1, viewCount: (s.viewCount || s.views || 0) + 1 }
            : s
        ));
      }
      
      // Navigate to story
      navigate(`/story/${storyId}`);
    } catch (error) {
      console.error('❌ Error tracking story view:', error);
      // Still navigate even if tracking fails
      navigate(`/story/${story._id || story.id}`);
    }
  };

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!profile) {
      console.error('No profile data available for follow action');
      return;
    }

    try {
      setFollowLoading(true);

      const targetUsername = profile.username || profile.name || username;
      console.log('🔄 Following user:', targetUsername);

      const response = await userAPI.followUser(targetUsername);

      if (response.data && response.data.success !== false) {
        const newFollowStatus = response.data.isFollowing;
        const adjustment = newFollowStatus ? 1 : -1;
        
        setProfile(prev => ({
          ...prev,
          isFollowing: newFollowStatus,
          followersCount: Math.max(0, (prev.followersCount || 0) + adjustment)
        }));
        
        console.log('✅ Follow action successful:', response.data.message);
      } else {
        throw new Error(response.data?.message || 'Failed to follow user');
      }
    } catch (error) {
      console.error('❌ Follow error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error following user. Please try again.';
      alert(errorMessage);
    } finally {
      setFollowLoading(false);
    }
  };

  // Refresh profile data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Re-fetch both profile and stories
      const profileResponse = await userAPI.getUserProfile(username);
      if (profileResponse.data) {
        const profileData = profileResponse.data.user || profileResponse.data.profile || profileResponse.data;
        setProfile(profileData);
      }
      
      const storiesResponse = await storiesAPI.getStoriesByAuthor(username, { 
        limit: 20,
        sort: 'createdAt',
        order: 'desc'
      });
      
      if (storiesResponse.data) {
        let storiesData = storiesResponse.data.stories || storiesResponse.data.data || storiesResponse.data;
        if (Array.isArray(storiesData)) {
          const filteredStories = storiesData.filter(story => {
            const isRegularStory = !story.type || story.type === 'story' || story.type === 'fail_story';
            const notImpactPost = story.category !== 'impact';
            return isRegularStory && notImpactPost;
          });
          setStories(filteredStories);
        }
      }
      
      console.log('✅ Profile data refreshed');
    } catch (error) {
      console.error('❌ Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={60} sx={{ color: '#81c784' }} />
        </Box>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ borderRadius: 3, mb: 4 }}>
          {error}
        </Alert>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => navigate('/browse')}
            sx={{ borderRadius: 2 }}
            color="primary"
          >
            Back to Stories
          </Button>
          <Button
            variant="contained"
            onClick={handleRefresh}
            sx={{ borderRadius: 2 }}
            color="primary"
          >
            Try Again
          </Button>
        </Box>
      </Container>
    );
  }

  // No profile found
  if (!profile) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="warning" sx={{ borderRadius: 3, mb: 4 }}>
          User profile not found
        </Alert>
        <Button
          variant="outlined"
          onClick={() => navigate('/browse')}
          sx={{ borderRadius: 2 }}
          color="primary"
        >
          Back to Stories
        </Button>
      </Container>
    );
  }

  // Safe data access with defaults
  const displayName = profile.name || profile.username || 'Anonymous User';
  const displayUsername = profile.username || profile.name || 'user';
  const userBio = profile.bio || 'No bio available';
  const userLocation = profile.location || '';
  const memberSince = formatDate(profile.createdAt);
  const avatarInitials = getInitials(displayName);

  // Better stats calculation with actual story count and total story views
  const stats = {
    stories: stories.length,
    followers: profile.followersCount || 0,
    following: profile.followingCount || 0,
    views: calculateTotalStoryViews()
  };

  // Check if current user can follow this profile
  const isOwnProfile = isAuthenticated && currentUser && 
                      (currentUser._id === profile._id || currentUser.id === profile._id ||
                       currentUser.username === profile.username);
  const canFollow = isAuthenticated && !isOwnProfile;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Profile Header */}
      <ProfileHeader>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Profile
          </Typography>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh Profile">
              <IconButton
                onClick={handleRefresh}
                disabled={refreshing}
                sx={{ color: 'white' }}
              >
                <Refresh sx={{ transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 1s' }} />
              </IconButton>
            </Tooltip>
            {isOwnProfile && (
              <Tooltip title="Edit Profile">
                <IconButton
                  onClick={() => navigate('/profile/edit')}
                  sx={{ color: 'white' }}
                >
                  <Edit />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Grid container spacing={4} alignItems="center">
          <Grid item>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                fontSize: '2.5rem',
                fontWeight: 800,
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                border: '3px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              {avatarInitials}
            </Avatar>
          </Grid>
          <Grid item xs>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
              {displayName}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
              @{displayUsername}
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
              {userBio}
            </Typography>
            
            {/* Profile Details */}
            <Box display="flex" flexWrap="wrap" gap={2} mb={3}>
              {userLocation && (
                <Box display="flex" alignItems="center">
                  <LocationOn sx={{ fontSize: 18, mr: 1, opacity: 0.8 }} />
                  <Typography variant="body2">{userLocation}</Typography>
                </Box>
              )}
              <Box display="flex" alignItems="center">
                <CalendarToday sx={{ fontSize: 18, mr: 1, opacity: 0.8 }} />
                <Typography variant="body2">Joined {memberSince}</Typography>
              </Box>
            </Box>

            {/* Action Buttons */}
            <Box display="flex" gap={2}>
              {canFollow && (
                <ActionButton
                  variant={profile.isFollowing ? 'unfollow' : 'follow'}
                  startIcon={followLoading ? <CircularProgress size={18} /> : 
                           (profile.isFollowing ? <PersonRemove /> : <PersonAdd />)}
                  onClick={handleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? 'Processing...' : 
                   (profile.isFollowing ? 'Unfollow' : 'Follow')}
                </ActionButton>
              )}
              <Button
                variant="outlined"
                startIcon={<Share />}
                sx={{
                  borderColor: 'rgba(255,255,255,0.5)',
                  color: 'white',
                  '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href)
                      .then(() => alert('Profile link copied to clipboard!'))
                      .catch(() => alert('Unable to copy link'));
                  } else {
                    alert('Clipboard not supported in your browser');
                  }
                }}
              >
                Share Profile
              </Button>
            </Box>
          </Grid>
        </Grid>
      </ProfileHeader>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { 
            label: 'Stories Written', 
            value: stats.stories, 
            icon: <Article />, 
            color: '#81c784'
          },
          { 
            label: 'Followers', 
            value: stats.followers, 
            icon: <Person />, 
            color: '#90caf9'
          },
          { 
            label: 'Following', 
            value: stats.following, 
            icon: <PersonAdd />, 
            color: '#ffb74d'
          },
          { 
            label: 'Total Story Views', 
            value: stats.views, 
            icon: <Visibility />, 
            color: '#f8bbd9'
          }
        ].map((stat, index) => (
          <Grid item xs={6} md={3} key={index}>
            <StatsCard>
              <Box display="flex" justifyContent="center" mb={1}>
                {React.cloneElement(stat.icon, { 
                  sx: { fontSize: 32, color: stat.color } 
                })}
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                {formatNumber(stat.value)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
            </StatsCard>
          </Grid>
        ))}
      </Grid>

      {/* Content Tabs */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
          sx={{
            background: 'linear-gradient(135deg, #81c784, #aed581)',
            '& .MuiTab-root': { color: 'white', fontWeight: 600 }
          }}
        >
          <Tab label={`Stories (${stats.stories})`} />
          <Tab label="About" />
        </Tabs>

        <Box p={3}>
          {activeTab === 0 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Published Stories ({stats.stories})
                </Typography>
                {isOwnProfile && (
                  <Button
                    variant="contained"
                    startIcon={<Article />}
                    onClick={() => navigate('/stories/create')}
                    sx={{ borderRadius: 2 }}
                  >
                    Create Story
                  </Button>
                )}
              </Box>
              
              {storiesLoading ? (
                <Box display="flex" flexDirection="column" alignItems="center" py={4}>
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Loading stories...
                  </Typography>
                </Box>
              ) : stories.length > 0 ? (
                <Grid container spacing={3}>
                  {stories.map((story, index) => (
                    <Grid item xs={12} md={6} key={story._id || story.id || index}>
                      <StoryCard onClick={() => handleStoryClick(story)}>
                        <CardContent>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                            {story.title || 'Untitled Story'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {story.excerpt || story.summary || 
                             (story.content ? story.content.substring(0, 120) + '...' : 
                              story.description ? story.description.substring(0, 120) + '...' : 
                              'No description available')}
                          </Typography>
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Chip 
                              label={story.category || 'General'} 
                              size="small"
                              sx={{ background: '#81c78420', color: '#2e7d32' }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(story.createdAt || story.dateCreated)}
                            </Typography>
                          </Box>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box display="flex" gap={2}>
                              <Box display="flex" alignItems="center">
                                <Visibility sx={{ fontSize: 16, mr: 0.5, color: '#666' }} />
                                <Typography variant="caption">
                                  {formatNumber(story.views || story.viewCount || 0)}
                                </Typography>
                              </Box>
                              <Box display="flex" alignItems="center">
                                <Favorite sx={{ fontSize: 16, mr: 0.5, color: '#e91e63' }} />
                                <Typography variant="caption">
                                  {formatNumber(story.likes || story.likeCount || 0)}
                                </Typography>
                              </Box>
                            </Box>
                            <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                              Read More →
                            </Typography>
                          </Box>
                        </CardContent>
                      </StoryCard>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box textAlign="center" py={8}>
                  <Article sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                    No stories published yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {isOwnProfile 
                      ? "You haven't shared any stories yet. Start sharing your experiences!"
                      : `${displayName} hasn't shared any stories yet.`
                    }
                  </Typography>
                  {isOwnProfile && (
                    <Button
                      variant="contained"
                      startIcon={<Article />}
                      onClick={() => navigate('/stories/create')}
                      sx={{ borderRadius: 2 }}
                    >
                      Create Your First Story
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                About {displayName}
              </Typography>
              
              <List>
                <ListItem>
                  <ListItemText
                    primary="Bio"
                    secondary={userBio}
                  />
                </ListItem>
                <Divider />
                {userLocation && (
                  <>
                    <ListItem>
                      <ListItemText
                        primary="Location"
                        secondary={userLocation}
                      />
                    </ListItem>
                    <Divider />
                  </>
                )}
                <ListItem>
                  <ListItemText
                    primary="Member Since"
                    secondary={memberSince}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Username"
                    secondary={`@${displayUsername}`}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Stories Written"
                    secondary={`${stats.stories} ${stats.stories === 1 ? 'story' : 'stories'}`}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Total Story Views"
                    secondary={formatNumber(stats.views)}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Average Views per Story"
                    secondary={stats.stories > 0 ? formatNumber(Math.round(stats.views / stats.stories)) : '0'}
                  />
                </ListItem>
              </List>
            </Box>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default UserProfile;
