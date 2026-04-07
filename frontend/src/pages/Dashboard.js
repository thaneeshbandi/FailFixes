/* eslint-disable no-console */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Fade,
  Grow,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  useTheme,
  useMediaQuery,
  Skeleton,
  Alert,
  CircularProgress,
  Divider,
  AvatarGroup,
  Collapse
} from '@mui/material';
import {
  Create,
  Visibility,
  Favorite,
  Timeline,
  Celebration,
  ArrowForward,
  AddCircle,
  Explore,
  Star,
  LocalFireDepartment,
  Refresh,
  People,
  PersonAdd,
  Comment,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';


// Animations
const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(2deg); }
`;


const pulse = keyframes`
  0%, 100% { 
    box-shadow: 0 0 20px rgba(129, 199, 132, 0.4);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 40px rgba(129, 199, 132, 0.8);
    transform: scale(1.05);
  }
`;


// Styled Components
const BackgroundContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: `
    radial-gradient(circle at 20% 20%, rgba(129, 199, 132, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(144, 202, 249, 0.15) 0%, transparent 50%),
    linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 25%, #fef7f0 50%, #f0fff4 75%, #f5f8ff 100%)
  `,
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(8),
}));


const WelcomeSection = styled(Paper)(({ theme }) => ({
  background: `linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)`,
  backdropFilter: 'blur(20px)',
  borderRadius: '28px',
  padding: theme.spacing(6),
  marginBottom: theme.spacing(6),
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)'
}));


const StatsCard = styled(Card)(({ color }) => ({
  borderRadius: '24px',
  background: `linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)`,
  backdropFilter: 'blur(15px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  transition: 'all 0.4s ease',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
  '&:hover': {
    transform: 'translateY(-12px) scale(1.03)',
    boxShadow: '0 32px 80px rgba(0, 0, 0, 0.15)',
    '& .icon-container': {
      transform: 'scale(1.15) rotate(10deg)',
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
    },
    '& .stat-value': {
      transform: 'scale(1.1)',
      color: color,
    }
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: `linear-gradient(90deg, ${color}, ${color}cc)`,
    borderRadius: '24px 24px 0 0',
  }
}));


const IconContainer = styled(Box)(({ color }) => ({
  width: 70,
  height: 70,
  borderRadius: '18px',
  background: `linear-gradient(135deg, ${color}15, ${color}25)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '20px',
  marginLeft: 'auto',
  marginRight: 'auto',
  transition: 'all 0.4s ease',
  border: `2px solid ${color}30`,
}));


const ActionButton = styled(Button)(({ variant: buttonVariant }) => ({
  borderRadius: '18px',
  padding: '16px 32px',
  fontSize: '1.1rem',
  fontWeight: 700,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  ...(buttonVariant === 'primary' && {
    background: 'linear-gradient(135deg, #81c784 0%, #aed581 50%, #90caf9 100%)',
    color: 'white',
    boxShadow: '0 8px 25px rgba(129, 199, 132, 0.4)',
    '&:hover': {
      transform: 'translateY(-4px) scale(1.05)',
      boxShadow: '0 16px 40px rgba(129, 199, 132, 0.5)',
    }
  }),
  ...(buttonVariant === 'outlined' && {
    border: '2px solid #81c784',
    color: '#81c784',
    background: 'rgba(255, 255, 255, 0.1)',
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(129, 199, 132, 0.1), rgba(144, 202, 249, 0.1))',
      transform: 'translateY(-2px) scale(1.02)',
    }
  })
}));


function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);


  const [showAllFollowers, setShowAllFollowers] = useState(false);
  const [showAllFollowing, setShowAllFollowing] = useState(false);
  const [followersDisplayCount, setFollowersDisplayCount] = useState(3);
  const [followingDisplayCount, setFollowingDisplayCount] = useState(3);


  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();


  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (!isAuthenticated || !user) return;


    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');


      console.log('📊 Fetching dashboard data...');
      const response = await dashboardAPI.getDashboard();
      setDashboardData(response.data.dashboard);
      
      console.log('✅ Dashboard data loaded:', response.data.dashboard);
    } catch (err) {
      console.error('❌ Dashboard error:', err);
      setError('Failed to load dashboard data');
      
      if (!dashboardData) {
        setDashboardData({
          user: { name: user?.name || 'User', username: user?.username || 'user' },
          stats: { 
            storiesShared: 0, 
            totalViews: 0, 
            totalLikes: 0,
            followersCount: 0,
            followingCount: 0
          },
          recentStories: [],
          recentFollowers: [],
          recentFollowing: [],
          growth: { growthRate: 0, isPositive: true }
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setMounted(true);
    }
  }, [isAuthenticated, user, dashboardData]);


  useEffect(() => {
    let isMounted = true;


    const loadDashboard = async () => {
      if (isMounted) {
        if (location.state?.refresh) {
          console.log('🔄 Refreshing from story creation');
          await fetchDashboardData(true);
          navigate(location.pathname, { replace: true, state: {} });
        } else {
          await fetchDashboardData();
        }
      }
    };


    loadDashboard();


    return () => {
      isMounted = false;
    };
  }, [location.state?.refresh]);


  const handleManualRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    fetchDashboardData(true);
  }, [fetchDashboardData]);


  const handleShowMoreFollowers = () => {
    setShowAllFollowers(!showAllFollowers);
    setFollowersDisplayCount(showAllFollowers ? 3 : (dashboardData?.recentFollowers?.length || 3));
  };


  const handleShowMoreFollowing = () => {
    setShowAllFollowing(!showAllFollowing);
    setFollowingDisplayCount(showAllFollowing ? 3 : (dashboardData?.recentFollowing?.length || 3));
  };


  if (!isAuthenticated || !user) {
    return (
      <BackgroundContainer>
        <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ mb: 2, fontWeight: 800, color: '#2e7d32' }}>
            Welcome to FailFixes! 🚀
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, color: '#64748b' }}>
            Please sign in to access your dashboard
          </Typography>
          <ActionButton variant="primary" size="large" onClick={() => navigate('/login')}>
            Sign In
          </ActionButton>
        </Container>
      </BackgroundContainer>
    );
  }


  if (loading && !dashboardData) {
    return (
      <BackgroundContainer>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: '24px', mb: 4 }} />
          <Grid container spacing={3}>
            {[1, 2, 3, 4].map((i) => (
              <Grid item xs={12} sm={3} key={i}>
                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: '24px' }} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </BackgroundContainer>
    );
  }


  const statsData = [
    {
      title: 'Stories Shared',
      value: dashboardData?.stats?.storiesShared || 0,
      icon: <Create sx={{ fontSize: 32 }} />,
      color: '#4caf50',
      description: 'Inspiring stories you\'ve shared'
    },
    {
      title: 'Total Views',
      value: (dashboardData?.stats?.totalViews || 0).toLocaleString(),
      icon: <Visibility sx={{ fontSize: 32 }} />,
      color: '#2196f3', 
      description: 'People who read your stories'
    },
    {
      title: 'Hearts Received',
      value: dashboardData?.stats?.totalLikes || dashboardData?.stats?.heartsReceived || 0,
      icon: <Favorite sx={{ fontSize: 32 }} />,
      color: '#f44336',
      description: 'Community appreciation'
    },
    {
      title: 'Followers',
      value: dashboardData?.stats?.followersCount || 0,
      icon: <People sx={{ fontSize: 32 }} />,
      color: '#9c27b0',
      description: 'People following your journey'
    }
  ];


  return (
    <BackgroundContainer>
      <Container maxWidth="lg">
        {error && (
          <Alert severity="warning" sx={{ mb: 4, borderRadius: 3 }}>
            {error}
          </Alert>
        )}


        {/* Welcome Section */}
        <Fade in={mounted} timeout={1000}>
          <WelcomeSection>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={8}>
                <Box display="flex" alignItems="center" mb={2}>
                  <Avatar
                    sx={{
                      width: 90,
                      height: 90,
                      mr: 3,
                      background: 'linear-gradient(135deg, #81c784, #aed581)',
                      fontSize: '2.5rem',
                      fontWeight: 800,
                      animation: `${float} 6s ease-in-out infinite`,
                      boxShadow: '0 8px 25px rgba(129, 199, 132, 0.4)',
                    }}
                  >
                    {dashboardData?.user?.name?.charAt(0) || user?.name?.charAt(0) || 'U'}
                  </Avatar>
                  <Box>
                    <Typography 
                      variant="h2" 
                      sx={{ 
                        fontWeight: 800, 
                        background: 'linear-gradient(135deg, #2e7d32, #81c784, #90caf9)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: { xs: '2.5rem', md: '3.5rem' },
                        mb: 1
                      }}
                    >
                      Welcome back, {dashboardData?.user?.name || user?.name || 'User'}! 👋
                    </Typography>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        color: '#64748b',
                        fontWeight: 500,
                        fontSize: '1.5rem'
                      }}
                    >
                      Ready to inspire someone today? ✨
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box display="flex" flexDirection="column" gap={3}>
                  <ActionButton
                    variant="primary"
                    startIcon={<Create />}
                    endIcon={<ArrowForward />}
                    onClick={() => navigate('/create-story')}
                    fullWidth
                    size="large"
                  >
                    Share Your Story
                  </ActionButton>
                  <ActionButton
                    variant="outlined"
                    startIcon={refreshing ? <CircularProgress size={20} /> : <Refresh />}
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    fullWidth
                  >
                    {refreshing ? 'Refreshing...' : 'Refresh Data'}
                  </ActionButton>
                </Box>
              </Grid>
            </Grid>
          </WelcomeSection>
        </Fade>


        {/* Stats Cards */}
        <Grid container spacing={4} sx={{ mb: 6 }}>
          {statsData.map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Grow in={mounted} timeout={1200 + index * 200}>
                <StatsCard color={stat.color}>
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <IconContainer className="icon-container" color={stat.color}>
                      {React.cloneElement(stat.icon, { 
                        sx: { fontSize: 32, color: stat.color }
                      })}
                    </IconContainer>
                    
                    <Typography 
                      className="stat-value"
                      variant="h2" 
                      sx={{ 
                        fontWeight: 900, 
                        color: '#1e293b', 
                        mb: 1,
                        fontSize: { xs: '2rem', md: '2.5rem' },
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {stat.value}
                    </Typography>
                    
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 700, 
                        color: stat.color,
                        mb: 1,
                        fontSize: '1.1rem'
                      }}
                    >
                      {stat.title}
                    </Typography>
                    
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#64748b',
                        fontSize: '0.9rem'
                      }}
                    >
                      {stat.description}
                    </Typography>
                  </CardContent>
                </StatsCard>
              </Grow>
            </Grid>
          ))}
        </Grid>


        {/* Social Section with In-Place Expansion */}
        <Grid container spacing={4} sx={{ mb: 6 }}>
          {/* Recent Followers */}
          <Grid item xs={12} md={6}>
            <Grow in={mounted} timeout={1400}>
              <Paper 
                elevation={0}
                sx={{
                  borderRadius: '24px',
                  p: 4,
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                  height: 'fit-content'
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                  <Box display="flex" alignItems="center">
                    <People sx={{ fontSize: '1.5rem', color: '#9c27b0', mr: 1.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                      Your Followers
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ color: '#9c27b0', fontWeight: 700 }}>
                    {dashboardData?.stats?.followersCount || 0}
                  </Typography>
                </Box>


                {dashboardData?.recentFollowers?.length > 0 ? (
                  <>
                    <AvatarGroup max={4} sx={{ mb: 2, justifyContent: 'flex-start' }}>
                      {dashboardData.recentFollowers.slice(0, 4).map((follower, index) => (
                        <Avatar
                          key={follower.id || index}
                          sx={{ 
                            width: 40, 
                            height: 40,
                            background: 'linear-gradient(135deg, #9c27b0, #e1bee7)',
                            cursor: 'pointer'
                          }}
                          onClick={() => navigate(`/profile/${follower.username}`)}
                        >
                          {follower.name?.charAt(0) || 'U'}
                        </Avatar>
                      ))}
                    </AvatarGroup>
                    
                    <List sx={{ p: 0, maxHeight: showAllFollowers ? 'none' : 200, overflow: 'auto' }}>
                      {dashboardData.recentFollowers.slice(0, followersDisplayCount).map((follower, index) => (
                        <ListItem 
                          key={follower.id || index} 
                          sx={{ 
                            p: 1, 
                            borderRadius: 2, 
                            background: 'rgba(156, 39, 176, 0.05)',
                            mb: 1,
                            cursor: 'pointer'
                          }}
                          onClick={() => navigate(`/profile/${follower.username}`)}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ width: 32, height: 32, background: '#9c27b0' }}>
                              {follower.name?.charAt(0) || 'U'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {follower.name || 'Anonymous'}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                @{follower.username} • {follower.stats?.storiesCount || 0} stories
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>


                    {dashboardData.recentFollowers.length > 3 && (
                      <Button
                        variant="outlined"
                        onClick={handleShowMoreFollowers}
                        fullWidth
                        startIcon={showAllFollowers ? <ExpandLess /> : <ExpandMore />}
                        sx={{ 
                          mt: 2,
                          borderColor: '#9c27b0',
                          color: '#9c27b0',
                          '&:hover': { borderColor: '#7b1fa2', backgroundColor: 'rgba(156, 39, 176, 0.1)' }
                        }}
                      >
                        {showAllFollowers ? 'View Less' : `View More (${dashboardData.recentFollowers.length - followersDisplayCount} remaining)`}
                      </Button>
                    )}
                  </>
                ) : (
                  <Box textAlign="center" py={4}>
                    <PersonAdd sx={{ fontSize: '2rem', color: '#9c27b0', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No followers yet. Share more stories to grow your community!
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grow>
          </Grid>


          {/* Recent Following */}
          <Grid item xs={12} md={6}>
            <Grow in={mounted} timeout={1500}>
              <Paper 
                elevation={0}
                sx={{
                  borderRadius: '24px',
                  p: 4,
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                  height: 'fit-content'
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                  <Box display="flex" alignItems="center">
                    <Star sx={{ fontSize: '1.5rem', color: '#ff9800', mr: 1.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                      You're Following
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ color: '#ff9800', fontWeight: 700 }}>
                    {dashboardData?.stats?.followingCount || 0}
                  </Typography>
                </Box>


                {dashboardData?.recentFollowing?.length > 0 ? (
                  <>
                    <AvatarGroup max={4} sx={{ mb: 2, justifyContent: 'flex-start' }}>
                      {dashboardData.recentFollowing.slice(0, 4).map((following, index) => (
                        <Avatar
                          key={following.id || index}
                          sx={{ 
                            width: 40, 
                            height: 40,
                            background: 'linear-gradient(135deg, #ff9800, #ffcc02)',
                            cursor: 'pointer'
                          }}
                          onClick={() => navigate(`/profile/${following.username}`)}
                        >
                          {following.name?.charAt(0) || 'U'}
                        </Avatar>
                      ))}
                    </AvatarGroup>
                    
                    <List sx={{ p: 0, maxHeight: showAllFollowing ? 'none' : 200, overflow: 'auto' }}>
                      {dashboardData.recentFollowing.slice(0, followingDisplayCount).map((following, index) => (
                        <ListItem 
                          key={following.id || index} 
                          sx={{ 
                            p: 1, 
                            borderRadius: 2, 
                            background: 'rgba(255, 152, 0, 0.05)',
                            mb: 1,
                            cursor: 'pointer'
                          }}
                          onClick={() => navigate(`/profile/${following.username}`)}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ width: 32, height: 32, background: '#ff9800' }}>
                              {following.name?.charAt(0) || 'U'}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {following.name || 'Anonymous'}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                @{following.username} • {following.stats?.storiesCount || 0} stories
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>


                    {dashboardData.recentFollowing.length > 3 && (
                      <Button
                        variant="outlined"
                        onClick={handleShowMoreFollowing}
                        fullWidth
                        startIcon={showAllFollowing ? <ExpandLess /> : <ExpandMore />}
                        sx={{ 
                          mt: 2,
                          borderColor: '#ff9800',
                          color: '#ff9800',
                          '&:hover': { borderColor: '#f57c00', backgroundColor: 'rgba(255, 152, 0, 0.1)' }
                        }}
                      >
                        {showAllFollowing ? 'View Less' : `View More (${dashboardData.recentFollowing.length - followingDisplayCount} remaining)`}
                      </Button>
                    )}
                  </>
                ) : (
                  <Box textAlign="center" py={4}>
                    <Explore sx={{ fontSize: '2rem', color: '#ff9800', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Not following anyone yet. Discover inspiring creators!
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grow>
          </Grid>
        </Grid>


        {/* Recent Stories */}
        <Grow in={mounted} timeout={1600}>
          <Paper 
            elevation={0}
            sx={{
              borderRadius: '24px',
              p: 4,
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Box display="flex" alignItems="center" mb={3}>
              <LocalFireDepartment sx={{ fontSize: '1.5rem', color: '#ff9800', mr: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                Recent Stories
              </Typography>
            </Box>


            {dashboardData?.recentStories?.length > 0 ? (
              <List sx={{ p: 0 }}>
                {dashboardData.recentStories.slice(0, 3).map((story, index) => (
                  <ListItem key={story.id || index} sx={{ p: 2, mb: 1, borderRadius: 2, background: 'rgba(255,255,255,0.5)' }}>
                    <ListItemAvatar>
                      <Avatar sx={{ 
                        background: story.status === 'published' 
                          ? 'linear-gradient(135deg, #4caf50, #81c784)'
                          : 'linear-gradient(135deg, #ff9800, #ffb74d)',
                        width: 48,
                        height: 48
                      }}>
                        {story.status === 'published' ? <Visibility /> : <Create />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {story.title}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Box display="flex" alignItems="center" gap={2} mb={0.5}>
                            <Box display="flex" alignItems="center">
                              <Visibility sx={{ fontSize: 16, color: '#81c784', mr: 0.5 }} />
                              <Typography variant="caption">{story.views}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center">
                              <Favorite sx={{ fontSize: 16, color: '#e91e63', mr: 0.5 }} />
                              <Typography variant="caption">{story.likes}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center">
                              <Comment sx={{ fontSize: 16, color: '#2196f3', mr: 0.5 }} />
                              <Typography variant="caption">{story.comments || 0}</Typography>
                            </Box>
                          </Box>
                          <Chip
                            label={story.status}
                            size="small"
                            sx={{ 
                              mt: 1,
                              background: story.status === 'published' ? '#4caf5015' : '#ff980015',
                              color: story.status === 'published' ? '#4caf50' : '#ff9800',
                              fontSize: '0.7rem'
                            }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box textAlign="center" py={4}>
                <Create sx={{ fontSize: '2rem', color: '#81c784', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  No stories yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Share your first story to get started!
                </Typography>
              </Box>
            )}


            <ActionButton
              variant="outlined"
              onClick={() => navigate('/browse')}
              fullWidth
              sx={{ mt: 3 }}
            >
              View All Stories
            </ActionButton>
          </Paper>
        </Grow>
      </Container>
    </BackgroundContainer>
  );
}


export default Dashboard;
