import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  Paper,
  Avatar,
  Stack,
  Fade,
  Grow,
  Alert,
  Chip,
  CardContent,
  CardActions,
  IconButton,
  CircularProgress,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Divider
} from '@mui/material';
import {
  TrendingUp,
  People,
  Star,
  KeyboardArrowRight,
  Explore,
  Create,
  AutoFixHigh,
  Psychology,
  EmojiObjects,
  GroupWork,
  School,
  Favorite,
  FavoriteBorder,
  Comment,
  Visibility,
  Search,
  NewReleases,
  Timeline
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storiesAPI, usersAPI } from '../services/api';
import FollowButton from '../components/FollowButton';
import UserSuggestions from '../components/UserSuggestions';


const gentleFloat = keyframes`
  0%, 100% { 
    transform: translateY(0px) rotate(0deg); 
  }
  50% { 
    transform: translateY(-8px) rotate(1deg); 
  }
`;


const softGlow = keyframes`
  0%, 100% { 
    box-shadow: 0 0 15px rgba(129, 199, 132, 0.2), 0 0 30px rgba(129, 199, 132, 0.1); 
  }
  50% { 
    box-shadow: 0 0 25px rgba(129, 199, 132, 0.3), 0 0 40px rgba(129, 199, 132, 0.15); 
  }
`;


const subtleShimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: 200px 0;
  }
`;


const softParticle = keyframes`
  0%, 100% { 
    transform: translateY(0px) translateX(0px); 
    opacity: 0.2; 
  }
  50% { 
    transform: translateY(-15px) translateX(8px); 
    opacity: 0.4; 
  }
`;


const BackgroundContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: `
    radial-gradient(circle at 20% 20%, rgba(174, 213, 129, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(255, 183, 195, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 40% 60%, rgba(179, 229, 252, 0.15) 0%, transparent 50%),
    linear-gradient(135deg, 
      #f8f9ff 0%, 
      #f0f4ff 25%,
      #fef7f0 50%,
      #f0fff4 75%,
      #f5f8ff 100%
    )
  `,
  position: 'relative',
  overflow: 'hidden',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(8),
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e8f5e8' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")
    `,
    pointerEvents: 'none',
  },
}));


const FloatingParticle = styled(Box)(({ delay, size, left, top }) => ({
  position: 'absolute',
  left: `${left}%`,
  top: `${top}%`,
  width: `${size}px`,
  height: `${size}px`,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(174, 213, 129, 0.2), rgba(179, 229, 252, 0.15))',
  animation: `${softParticle} ${4 + Math.random() * 3}s ease-in-out infinite`,
  animationDelay: `${delay}s`,
  backdropFilter: 'blur(1px)',
  border: '1px solid rgba(174, 213, 129, 0.1)'
}));


const HeroCard = styled(Paper)(({ theme }) => ({
  background: `
    linear-gradient(135deg, 
      rgba(255, 255, 255, 0.85) 0%,
      rgba(255, 255, 255, 0.75) 50%,
      rgba(255, 255, 255, 0.65) 100%
    )
  `,
  backdropFilter: 'blur(20px) saturate(120%)',
  WebkitBackdropFilter: 'blur(20px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '24px',
  padding: theme.spacing(8, 6),
  textAlign: 'center',
  marginBottom: theme.spacing(8),
  position: 'relative',
  overflow: 'hidden',
  boxShadow: `
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6)
  `,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '100%',
    height: '100%',
    background: `
      linear-gradient(90deg, 
        transparent, 
        rgba(129, 199, 132, 0.1), 
        transparent
      )
    `,
    animation: `${subtleShimmer} 6s ease-in-out infinite`,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #81c784, #aed581, #90caf9, #f8bbd9)',
    borderRadius: '24px 24px 0 0',
  }
}));


const StatCard = styled(Card)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(4),
  borderRadius: '20px',
  background: `
    linear-gradient(135deg, 
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.8) 100%
    )
  `,
  backdropFilter: 'blur(15px) saturate(120%)',
  WebkitBackdropFilter: 'blur(15px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  height: '100%',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: `
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04)
  `,
  '&:hover': {
    transform: 'translateY(-4px) scale(1.01)',
    boxShadow: `
      0 12px 32px rgba(0, 0, 0, 0.12),
      0 6px 16px rgba(129, 199, 132, 0.2)
    `,
  }
}));


const FeatureCard = styled(Paper)(({ theme }) => ({
  background: `
    linear-gradient(135deg, 
      rgba(255, 255, 255, 0.85) 0%,
      rgba(255, 255, 255, 0.75) 100%
    )
  `,
  backdropFilter: 'blur(20px) saturate(120%)',
  WebkitBackdropFilter: 'blur(20px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '20px',
  padding: theme.spacing(6),
  marginBottom: theme.spacing(6),
  boxShadow: `
    0 6px 24px rgba(0, 0, 0, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.04)
  `,
}));


const ElegantButton = styled(Button)(({ theme, variant: buttonVariant }) => ({
  borderRadius: '16px',
  padding: '14px 32px',
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '50px',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  ...(buttonVariant === 'primary' && {
    background: 'linear-gradient(135deg, #81c784 0%, #aed581 50%, #90caf9 100%)',
    backgroundSize: '150% 150%',
    color: 'white',
    boxShadow: '0 4px 15px rgba(129, 199, 132, 0.3)',
    '&:hover': {
      backgroundPosition: 'right center',
      transform: 'translateY(-2px) scale(1.01)',
      boxShadow: '0 8px 25px rgba(129, 199, 132, 0.4)'
    }
  }),
  ...(buttonVariant === 'outlined' && {
    border: '2px solid #81c784',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    color: '#81c784',
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(129, 199, 132, 0.1), rgba(144, 202, 249, 0.1))',
      transform: 'translateY(-1px) scale(1.01)',
      boxShadow: '0 6px 20px rgba(129, 199, 132, 0.2)',
      borderWidth: '2px',
    }
  }),
}));


const FeatureChip = ({ icon, text, color, ...props }) => (
  <Chip
    icon={icon}
    label={text}
    size="medium"
    sx={{
      background: `linear-gradient(135deg, ${color}30 0%, ${color}20 100%)`,
      color: 'text.primary',
      fontWeight: 500,
      fontSize: '0.85rem',
      padding: (theme) => theme.spacing(0.5, 1),
      border: `1px solid ${color}40`,
      backdropFilter: 'blur(5px)',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        transform: 'translateY(-1px) scale(1.02)',
        boxShadow: `0 4px 12px ${color}30`,
        background: `linear-gradient(135deg, ${color}40 0%, ${color}30 100%)`
      }
    }}
    {...props}
  />
);


function Home() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedType, setFeedType] = useState('all');


  useEffect(() => {
    setMounted(true);
  }, []);


  useEffect(() => {
    if (isAuthenticated) {
      loadStories();
    }
  }, [isAuthenticated, activeTab, searchTerm, feedType]);


  const loadStories = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('📰 Loading stories...', { feedType, activeTab, searchTerm });
      let response;
      
      if (feedType === 'following') {
        console.log('🔄 Loading following feed...');
        response = await usersAPI.getUserFeed({ limit: 20 });
        console.log('✅ Following feed loaded:', response.data);
      } else {
        const sortBy = activeTab === 0 ? 'recent' : activeTab === 1 ? 'popular' : 'views';
        console.log('🔄 Loading public stories...', { sortBy });
        response = await storiesAPI.getAllStories({ 
          sortBy,
          search: searchTerm,
          limit: 20
        });
        console.log('✅ Public stories loaded:', response.data);
      }
      
      const loadedStories = response.data.stories || [];
      console.log('📊 Stories with follow status:', loadedStories.map(s => ({
        author: s.displayAuthor || s.authorUsername,
        isFollowing: s.isFollowing
      })));
      
      setStories(loadedStories);
      
      if (response.data.debug) {
        console.log('📊 Feed debug info:', response.data.debug);
      }
      
    } catch (err) {
      console.error('❌ Error loading stories:', err);
      setError(`Failed to load ${feedType === 'following' ? 'following' : 'public'} stories`);
      setStories([]);
    } finally {
      setLoading(false);
    }
  };


  const handleFollow = async (username) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }


    try {
      console.log('👥 Following user:', username);
      const response = await usersAPI.followUser(username);
      
      if (response.data.success) {
        const newFollowingStatus = response.data.isFollowing;
        
        setStories(prev => prev.map(story => {
          const storyAuthor = story.displayAuthor || story.authorUsername;
          if (storyAuthor === username) {
            return {
              ...story,
              isFollowing: newFollowingStatus
            };
          }
          return story;
        }));
        
        console.log('✅ Follow status updated:', {
          username,
          isFollowing: newFollowingStatus
        });
      }
      
    } catch (err) {
      console.error('❌ Error following user:', err);
    }
  };


  const handleLike = async (storyId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }


    try {
      console.log('👍 Liking story:', storyId);
      const response = await storiesAPI.likeStory(storyId);
      
      setStories(prev => prev.map(story => 
        story._id === storyId 
          ? { 
              ...story, 
              isLiked: response.data.isLiked,
              stats: { ...story.stats, likes: response.data.likesCount }
            }
          : story
      ));
      
      console.log('✅ Like updated successfully');
    } catch (err) {
      console.error('❌ Error liking story:', err);
    }
  };


  const handleSearch = (e) => {
    e.preventDefault();
  };


  const stats = [
    {
      title: 'Success Stories',
      value: '12,000+',
      icon: TrendingUp,
      color: '#81c784',
      description: 'Inspiring transformations'
    },
    {
      title: 'Community Members',
      value: '45,000+',
      icon: People,
      color: '#90caf9',
      description: 'People growing together'
    },
    {
      title: 'Lives Transformed',
      value: '100,000+',
      icon: Star,
      color: '#ffb74d',
      description: 'Stories that inspire'
    },
  ];


  const features = [
    {
      title: 'Share Your Story',
      description: 'Write your transformation journey and inspire others with your authentic experience',
      icon: '✍️',
      step: '01',
      color: '#81c784'
    },
    {
      title: 'Inspire Others',
      description: 'Help others learn from your experience and growth through meaningful connections',
      icon: '✨',
      step: '02',
      color: '#90caf9'
    },
    {
      title: 'Build Community',
      description: 'Connect with resilient individuals from around the world who share similar journeys',
      icon: '🤝',
      step: '03',
      color: '#f8bbd9'
    },
    {
      title: 'Transform Lives',
      description: 'Turn your setbacks into powerful stories that create positive impact',
      icon: '🚀',
      step: '04',
      color: '#ffb74d'
    }
  ];


  const communityFeatures = [
    { icon: <TrendingUp />, text: 'Growth Stories', color: '#81c784' },
    { icon: <Psychology />, text: 'Mental Wellness', color: '#90caf9' },
    { icon: <EmojiObjects />, text: 'Life Insights', color: '#ffb74d' },
    { icon: <GroupWork />, text: 'Supportive Community', color: '#f8bbd9' }
  ];


  const StoryCard = ({ story }) => {
    const authorUsername = story.displayAuthor || story.authorUsername;
    const isOwnStory = user && (
      (story.author && story.author._id === user._id) ||
      authorUsername === user.username ||
      authorUsername === user.name
    );
    
    const isFollowingAuthor = story.isFollowing || false;
    
    const isFollowingFeed = feedType === 'following';
    const shouldShowFollowButton = isAuthenticated && !isOwnStory && !isFollowingAuthor && !isFollowingFeed;
    const shouldShowFollowingChip = isAuthenticated && !isOwnStory && isFollowingAuthor && !isFollowingFeed;


    return (
      <Card 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          cursor: 'pointer',
          borderRadius: 3,
          '&:hover': { 
            transform: 'translateY(-2px)', 
            boxShadow: 4 
          },
          transition: 'all 0.2s ease'
        }}
        onClick={() => navigate(`/story/${story._id}`)}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <Avatar 
              sx={{ 
                width: 32, 
                height: 32, 
                mr: 1,
                bgcolor: 'primary.main',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${authorUsername}`);
              }}
            >
              {(authorUsername || 'A').charAt(0).toUpperCase()}
            </Avatar>
            <Box flexGrow={1}>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': { color: 'primary.main' }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${authorUsername}`);
                }}
              >
                {authorUsername}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(story.createdAt).toLocaleDateString()}
                {isFollowingFeed && (
                  <Chip
                    label="Following"
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ ml: 1, height: 16, fontSize: '0.6rem' }}
                  />
                )}
              </Typography>
            </Box>
            
            {shouldShowFollowButton && (
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFollow(authorUsername);
                }}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  minWidth: 'auto',
                  px: 2
                }}
              >
                Follow
              </Button>
            )}
            
            {shouldShowFollowingChip && (
              <Chip
                label="Following"
                size="small"
                color="primary"
                variant="outlined"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFollow(authorUsername);
                }}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    borderColor: '#f44336',
                    color: '#f44336'
                  }
                }}
              />
            )}
          </Box>
          
          <Typography variant="h6" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
            {story.title}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
            {story.excerpt || `${story.content.substring(0, 150)}...`}
          </Typography>
          
          <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
            <Chip 
              label={story.category || 'General'} 
              size="small" 
              color="primary" 
              variant="outlined"
            />
            {story.metadata?.currentStatus && (
              <Chip 
                label={story.metadata.currentStatus} 
                size="small" 
                color="secondary"
                variant="outlined"
              />
            )}
          </Box>
        </CardContent>
        
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                handleLike(story._id);
              }}
              color={story.isLiked ? "error" : "default"}
            >
              {story.isLiked ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
            <Typography variant="caption">
              {story.stats?.likes || 0}
            </Typography>
            
            <Box display="flex" alignItems="center">
              <Comment fontSize="small" color="action" />
              <Typography variant="caption" sx={{ ml: 0.5 }}>
                {story.stats?.comments || 0}
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center">
              <Visibility fontSize="small" color="action" />
              <Typography variant="caption" sx={{ ml: 0.5 }}>
                {story.stats?.views || 0}
              </Typography>
            </Box>
          </Box>
          
          <Typography variant="caption" color="text.secondary">
            {story.metadata?.readTime || Math.ceil((story.content || '').split(' ').length / 200) || 1} min read
          </Typography>
        </CardActions>
      </Card>
    );
  };


  // Show landing page for non-authenticated users
  if (!isAuthenticated) {
    return (
      <BackgroundContainer>
        {/* Floating Particles */}
        {[...Array(6)].map((_, i) => (
          <FloatingParticle
            key={i}
            delay={i * 0.4}
            size={Math.random() * 25 + 10}
            left={Math.random() * 100}
            top={Math.random() * 100}
          />
        ))}


        <Container maxWidth="lg">
          {/* Hero Section */}
          <Fade in={mounted} timeout={800}>
            <HeroCard>
              <Avatar sx={{ 
                width: 80, 
                height: 80,
                background: 'linear-gradient(135deg, #81c784, #aed581)',
                margin: '0 auto 24px',
                animation: `${gentleFloat} 4s ease-in-out infinite, ${softGlow} 3s ease-in-out infinite alternate`,
              }}>
                <AutoFixHigh sx={{ fontSize: '2.5rem' }} />
              </Avatar>
              
              <Typography 
                variant="h1" 
                sx={{ 
                  fontWeight: 800, 
                  mb: 3,
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  background: 'linear-gradient(135deg, #81c784 0%, #aed581 25%, #90caf9 50%, #f8bbd9 75%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.1,
                }}
              >
                Transform Setbacks into Comebacks
              </Typography>
              
              <Typography variant="h5" sx={{ 
                color: 'rgba(0, 0, 0, 0.6)', 
                mb: 4,
                fontWeight: 400,
                maxWidth: 600,
                mx: 'auto',
                lineHeight: 1.6,
              }}>
                Join our community of resilient individuals sharing inspiring journeys 
                from challenges to extraordinary success
              </Typography>


              <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                {communityFeatures.map((feature, index) => (
                  <FeatureChip
                    key={index}
                    icon={feature.icon}
                    text={feature.text}
                    color={feature.color}
                  />
                ))}
              </Box>


              <Stack 
                direction={{ xs: 'column', sm: 'row' }} 
                spacing={3} 
                justifyContent="center"
              >
                <ElegantButton
                  variant="primary"
                  size="large"
                  endIcon={<KeyboardArrowRight />}
                  onClick={() => navigate('/signup')}
                >
                  Join Our Community
                </ElegantButton>
                
                <ElegantButton
                  variant="outlined"
                  size="large"
                  startIcon={<Explore />}
                  onClick={() => navigate('/browse')}
                >
                  Discover Stories
                </ElegantButton>
              </Stack>
            </HeroCard>
          </Fade>


          {/* Stats Section */}
          <Grid container spacing={4} sx={{ mb: 8 }}>
            {stats.map((stat, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Grow in={mounted} timeout={1200 + index * 200}>
                  <StatCard>
                    <Box sx={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: `${stat.color}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 3,
                      border: `2px solid ${stat.color}40`,
                    }}>
                      <stat.icon sx={{ fontSize: '1.75rem', color: stat.color }} />
                    </Box>
                    
                    <Typography variant="h3" sx={{ 
                      fontWeight: 800, 
                      mb: 1,
                      color: stat.color,
                    }}>
                      {stat.value}
                    </Typography>
                    
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700, 
                      mb: 1,
                      color: 'text.primary',
                    }}>
                      {stat.title}
                    </Typography>
                    
                    <Typography variant="body2" sx={{ 
                      color: 'text.secondary',
                      fontWeight: 500,
                    }}>
                      {stat.description}
                    </Typography>
                  </StatCard>
                </Grow>
              </Grid>
            ))}
          </Grid>


          {/* How It Works */}
          <Grow in={mounted} timeout={1600}>
            <FeatureCard>
              <Typography variant="h3" sx={{ 
                mb: 6, 
                textAlign: 'center',
                fontWeight: 800,
                color: '#81c784',
              }}>
                How FailFixes Works
              </Typography>
              
              <Grid container spacing={4}>
                {features.map((feature, index) => (
                  <Grid item xs={12} sm={6} md={3} key={index}>
                    <Box sx={{ textAlign: 'center', p: 2 }}>
                      <Typography sx={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 800,
                        color: feature.color,
                        mb: 2,
                        letterSpacing: '1px',
                        opacity: 0.8,
                      }}>
                        STEP {feature.step}
                      </Typography>
                      
                      <Typography sx={{ 
                        fontSize: '2.5rem', 
                        mb: 2,
                        animation: `${gentleFloat} ${3 + index * 0.5}s ease-in-out infinite`,
                      }}>
                        {feature.icon}
                      </Typography>
                      
                      <Typography variant="h6" sx={{ 
                        mb: 2, 
                        fontWeight: 700,
                        color: 'text.primary',
                      }}>
                        {feature.title}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ 
                        color: 'text.secondary', 
                        lineHeight: 1.6,
                        fontWeight: 500,
                      }}>
                        {feature.description}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>


              <Box textAlign="center" sx={{ mt: 6 }}>
                <ElegantButton
                  variant="primary"
                  size="large"
                  startIcon={<Create />}
                  onClick={() => navigate('/signup')}
                >
                  Join Our Community
                </ElegantButton>
              </Box>
            </FeatureCard>
          </Grow>
        </Container>
      </BackgroundContainer>
    );
  }


  // Show feed for authenticated users
  return (
    <BackgroundContainer>
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Main Feed */}
          <Grid item xs={12} md={8}>
            {/* Welcome Message */}
            <Paper sx={{ p: 3, mb: 3, textAlign: 'center', borderRadius: 3 }}>
              <Typography variant="h4" gutterBottom sx={{ 
                fontWeight: 800,
                background: 'linear-gradient(135deg, #81c784 0%, #aed581 25%, #90caf9 50%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Welcome back, {user.name}! 👋
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Ready to inspire someone today or discover new stories?
              </Typography>
            </Paper>


            {/* Feed Type Toggle */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
              <Tabs 
                value={feedType === 'all' ? 0 : 1}
                onChange={(e, newValue) => setFeedType(newValue === 0 ? 'all' : 'following')}
                variant="fullWidth"
                sx={{
                  '& .MuiTab-root': {
                    fontWeight: 600,
                    textTransform: 'none'
                  }
                }}
              >
                <Tab icon={<Explore />} label="Discover Stories" />
                <Tab icon={<Timeline />} label="Following Feed" />
              </Tabs>
            </Paper>


            {feedType === 'all' && (
              <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
                <Tabs 
                  value={activeTab} 
                  onChange={(e, newValue) => setActiveTab(newValue)}
                  variant="fullWidth"
                  sx={{
                    '& .MuiTab-root': {
                      fontWeight: 600,
                      textTransform: 'none'
                    }
                  }}
                >
                  <Tab icon={<NewReleases />} label="Recent" />
                  <Tab icon={<TrendingUp />} label="Popular" />
                  <Tab icon={<Visibility />} label="Most Viewed" />
                </Tabs>
              </Paper>
            )}


            {/* Search Bar */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
              <form onSubmit={handleSearch}>
                <TextField
                  fullWidth
                  placeholder="Search inspiring stories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                />
              </form>
            </Paper>


            {/* Stories */}
            {loading ? (
              <Box display="flex" justifyContent="center" py={8}>
                <CircularProgress size={50} sx={{ color: '#81c784' }} />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
                {error}
                <Button 
                  onClick={loadStories} 
                  sx={{ ml: 2 }}
                  variant="outlined"
                  size="small"
                >
                  Retry
                </Button>
              </Alert>
            ) : stories.length === 0 ? (
              <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  {feedType === 'following' ? 'No stories from people you follow' : 'No stories found'}
                </Typography>
                <Typography color="text.secondary" paragraph>
                  {feedType === 'following' 
                    ? 'Follow some users to see their stories here! Check out suggested users in the sidebar.'
                    : 'Try adjusting your search or filters.'
                  }
                </Typography>
                {feedType === 'following' && (
                  <Button 
                    variant="contained" 
                    onClick={() => setFeedType('all')}
                    sx={{
                      background: 'linear-gradient(135deg, #81c784, #aed581)',
                      '&:hover': { background: 'linear-gradient(135deg, #66bb6a, #81c784)' }
                    }}
                  >
                    Browse All Stories
                  </Button>
                )}
              </Paper>
            ) : (
              <Grid container spacing={3}>
                {stories.map((story) => (
                  <Grid item xs={12} key={story._id}>
                    <StoryCard story={story} />
                  </Grid>
                ))}
              </Grid>
            )}
          </Grid>


          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            <UserSuggestions />
            
            <Paper sx={{ p: 3, mt: 3, textAlign: 'center', borderRadius: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ 
                fontWeight: 700,
                color: '#81c784'
              }}>
                Share Your Story
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Have a failure-to-success story? Share it with our community and inspire others!
              </Typography>
              <Button
                variant="contained"
                startIcon={<Create />}
                onClick={() => navigate('/write')}
                fullWidth
                sx={{
                  background: 'linear-gradient(135deg, #81c784, #aed581)',
                  '&:hover': { background: 'linear-gradient(135deg, #66bb6a, #81c784)' }
                }}
              >
                Write Story
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </BackgroundContainer>
  );
}


export default Home;
