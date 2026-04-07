import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Avatar,
  Chip,
  IconButton,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Fade,
  Grow,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack,
  Favorite,
  FavoriteBorder,
  Share,
  Visibility,
  AccessTime,
  Person,
  Category,
  TrendingUp,
  Edit,
  Delete,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useAuth } from '../App';
import api, { storiesAPI } from '../services/api'; // ✅ Import storiesAPI

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const heartBeat = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
`;

// Styled Components
const StoryContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(6),
  minHeight: '100vh',
}));

const StoryPaper = styled(Paper)(({ theme }) => ({
  borderRadius: '24px',
  padding: theme.spacing(5, 4),
  marginBottom: theme.spacing(4),
  background: '#ffffff',
  border: '1px solid rgba(0, 0, 0, 0.06)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #81c784, #aed581, #90caf9)',
  }
}));

const CategoryBadge = styled(Chip)(({ theme, categoryColor }) => ({
  background: `${categoryColor}15`,
  color: categoryColor,
  fontWeight: 600,
  border: `1px solid ${categoryColor}30`,
  borderRadius: '12px',
  fontSize: '0.9rem',
  padding: '8px 4px',
}));

const ActionButton = styled(IconButton)(({ theme, active }) => ({
  borderRadius: '12px',
  padding: '12px',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  background: active ? 'rgba(244, 67, 54, 0.1)' : 'rgba(248, 250, 252, 0.8)',
  color: active ? '#f44336' : '#64748b',
  border: '1px solid',
  borderColor: active ? 'rgba(244, 67, 54, 0.3)' : 'rgba(100, 116, 139, 0.2)',
  '&:hover': {
    background: active ? 'rgba(244, 67, 54, 0.2)' : 'rgba(100, 116, 139, 0.1)',
    transform: 'scale(1.1)',
    ...(active && {
      animation: `${heartBeat} 0.6s ease-in-out`,
    })
  }
}));

const BackButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  padding: '8px 20px',
  color: '#64748b',
  backgroundColor: 'rgba(248, 250, 252, 0.8)',
  border: '1px solid rgba(100, 116, 139, 0.2)',
  fontWeight: 600,
  textTransform: 'none',
  '&:hover': {
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
  }
}));

const StoryContent = styled(Typography)(({ theme }) => ({
  fontSize: '1.125rem',
  lineHeight: 1.8,
  color: '#374151',
  marginBottom: theme.spacing(3),
  whiteSpace: 'pre-line',
  '& p': {
    marginBottom: theme.spacing(2),
  }
}));

function StoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [mounted, setMounted] = useState(false);

  const categories = {
    business: { label: 'Business & Startup', icon: '💼', color: '#1976d2' },
    personal: { label: 'Personal Growth', icon: '🌱', color: '#4caf50' },
    education: { label: 'Education & Learning', icon: '📚', color: '#ff9800' },
    health: { label: 'Health & Wellness', icon: '💪', color: '#f44336' },
    relationships: { label: 'Relationships', icon: '❤️', color: '#e91e63' },
    career: { label: 'Career & Work', icon: '🚀', color: '#673ab7' },
    technology: { label: 'Technology', icon: '💻', color: '#00bcd4' },
    creative: { label: 'Creative Arts', icon: '🎨', color: '#ff5722' },
  };

  useEffect(() => {
    setMounted(true);
    fetchStory();
  }, [id]);

  // ✅ FIXED: Added view tracking
  const fetchStory = async () => {
    try {
      setLoading(true);
      console.log('📖 Fetching story:', id);
      
      // Fetch the story
      const response = await api.get(`/stories/${id}`);
      
      if (response.data.success) {
        setStory(response.data.data);
        setIsLiked(response.data.data.likedBy?.includes(user?.id) || false);
        
        // ✅ INCREMENT VIEW COUNT (This was missing!)
        try {
          console.log('📊 Incrementing view count for story:', id);
          await storiesAPI.incrementView(id);
          console.log('✅ View count incremented successfully');
        } catch (viewError) {
          console.error('❌ Failed to increment view (non-critical):', viewError);
          // Don't throw - view tracking failure shouldn't break the page
        }
      }
    } catch (error) {
      console.error('❌ Error fetching story:', error);
      setError(error.response?.data?.message || 'Story not found');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const response = await api.post(`/stories/${id}/like`);
      if (response.data.success) {
        setIsLiked(response.data.data.isLiked);
        setStory(prev => ({
          ...prev,
          engagement: {
            ...prev.engagement,
            likes: response.data.data.likes
          }
        }));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: story.title,
      text: story.excerpt || story.content.substring(0, 150) + '...',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Share was cancelled or failed');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Story link copied to clipboard!');
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <StoryContainer maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh">
          <CircularProgress size={60} sx={{ color: '#81c784', mb: 3 }} />
          <Typography variant="h6" color="text.secondary">
            Loading your inspiring story...
          </Typography>
        </Box>
      </StoryContainer>
    );
  }

  if (error) {
    return (
      <StoryContainer maxWidth="md">
        <Box textAlign="center" py={8}>
          <Typography variant="h4" sx={{ mb: 2, color: '#f44336' }}>
            Story Not Found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            The story you're looking for doesn't exist or may have been removed.
          </Typography>
          <BackButton
            startIcon={<ArrowBack />}
            onClick={() => navigate('/browse')}
          >
            Browse Stories
          </BackButton>
        </Box>
      </StoryContainer>
    );
  }

  if (!story) return null;

  const categoryInfo = categories[story.category] || categories.personal;
  const isAuthor = user?.id === story.author?._id || user?.id === story.author;

  return (
    <StoryContainer maxWidth="md">
      {/* Back Button */}
      <Fade in={mounted} timeout={800}>
        <Box sx={{ mb: 3 }}>
          <BackButton
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
          >
            Back
          </BackButton>
        </Box>
      </Fade>

      {/* Main Story Content */}
      <Grow in={mounted} timeout={1000}>
        <StoryPaper elevation={0}>
          {/* Story Header */}
          <Box sx={{ mb: 4 }}>
            {/* Category and Actions */}
            <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={3}>
              <CategoryBadge 
                label={`${categoryInfo.icon} ${categoryInfo.label}`}
                categoryColor={categoryInfo.color}
              />
              
              <Box display="flex" gap={1}>
                <Tooltip title={isLiked ? "Unlike" : "Like this story"}>
                  <ActionButton 
                    active={isLiked}
                    onClick={handleLike}
                  >
                    {isLiked ? <Favorite /> : <FavoriteBorder />}
                  </ActionButton>
                </Tooltip>
                
                <Tooltip title="Share story">
                  <ActionButton onClick={handleShare}>
                    <Share />
                  </ActionButton>
                </Tooltip>

                {isAuthor && (
                  <Tooltip title="Edit story">
                    <ActionButton onClick={() => navigate(`/edit-story/${id}`)}>
                      <Edit />
                    </ActionButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Story Title */}
            <Typography 
              variant="h2" 
              sx={{ 
                fontWeight: 900, 
                color: '#1e293b',
                mb: 3,
                lineHeight: 1.2,
                fontSize: { xs: '2rem', md: '3rem' },
              }}
            >
              {story.title}
            </Typography>

            {/* Author and Meta Info */}
            <Box display="flex" alignItems="center" flexWrap="wrap" gap={3} mb={3}>
              <Box display="flex" alignItems="center" gap={1.5}>
                <Avatar 
                  sx={{ 
                    width: 48, 
                    height: 48,
                    background: 'linear-gradient(135deg, #81c784, #90caf9)',
                    fontSize: '1.2rem',
                    fontWeight: 700
                  }}
                  src={story.author?.avatar}
                >
                  {story.authorName?.charAt(0) || story.author?.name?.charAt(0) || 'A'}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    {story.authorName || story.author?.name || 'Anonymous'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Published on {formatDate(story.createdAt)}
                  </Typography>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap={3}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <AccessTime sx={{ fontSize: 18, color: '#64748b' }} />
                  <Typography variant="body2" color="text.secondary">
                    {story.readTime} min read
                  </Typography>
                </Box>
                
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Visibility sx={{ fontSize: 18, color: '#64748b' }} />
                  <Typography variant="body2" color="text.secondary">
                    {story.engagement?.views || 0} views
                  </Typography>
                </Box>
                
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Favorite sx={{ fontSize: 18, color: '#f44336' }} />
                  <Typography variant="body2" color="text.secondary">
                    {story.engagement?.likes || 0} likes
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Story Tags */}
            {story.tags && story.tags.length > 0 && (
              <Box display="flex" flexWrap="wrap" gap={1} mb={3}>
                {story.tags.map((tag, index) => (
                  <Chip 
                    key={index} 
                    label={tag} 
                    size="small" 
                    variant="outlined"
                    sx={{ 
                      borderRadius: 2,
                      borderColor: 'rgba(100, 116, 139, 0.2)',
                      color: '#64748b',
                      '&:hover': {
                        backgroundColor: 'rgba(100, 116, 139, 0.08)',
                      }
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* Story Content */}
          <StoryContent variant="body1">
            {story.content}
          </StoryContent>

          {/* Story Metadata */}
          {story.metadata && (
            <Box sx={{ 
              p: 3, 
              borderRadius: 4, 
              background: 'linear-gradient(135deg, rgba(129, 199, 132, 0.08) 0%, rgba(144, 202, 249, 0.08) 100%)',
              border: '1px solid rgba(129, 199, 132, 0.15)',
              mb: 4 
            }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}>
                📊 Story Details
              </Typography>
              
              <Box display="flex" flexWrap="wrap" gap={3}>
                {story.metadata.recoveryTime && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b' }}>
                      Recovery Time:
                    </Typography>
                    <Typography variant="body1" color="text.primary">
                      {story.metadata.recoveryTime}
                    </Typography>
                  </Box>
                )}
                
                {story.metadata.currentStatus && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b' }}>
                      Current Status:
                    </Typography>
                    <Typography variant="body1" color="text.primary">
                      {story.metadata.currentStatus.replace('_', ' ').charAt(0).toUpperCase() + 
                       story.metadata.currentStatus.replace('_', ' ').slice(1)}
                    </Typography>
                  </Box>
                )}
              </Box>

              {story.metadata.keyLessons && story.metadata.keyLessons.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b', mb: 2 }}>
                    💡 Key Lessons Learned:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, m: 0 }}>
                    {story.metadata.keyLessons.map((lesson, index) => (
                      <Typography component="li" variant="body1" key={index} sx={{ mb: 1, color: 'text.primary' }}>
                        {lesson}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Engagement Section */}
          <Box display="flex" alignItems="center" justifyContent="space-between" pt={3} sx={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="body2" color="text.secondary">
                Show your appreciation:
              </Typography>
              <ActionButton 
                active={isLiked}
                onClick={handleLike}
              >
                {isLiked ? <Favorite /> : <FavoriteBorder />}
              </ActionButton>
            </Box>
            
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="body2" color="text.secondary">
                {story.engagement?.likes || 0} people found this inspiring
              </Typography>
            </Box>
          </Box>
        </StoryPaper>
      </Grow>

      {/* Related Stories or Call to Action */}
      <Grow in={mounted} timeout={1400}>
        <Paper sx={{ 
          p: 4, 
          borderRadius: 4, 
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(129, 199, 132, 0.05) 100%)',
          border: '1px solid rgba(25, 118, 210, 0.1)' 
        }}>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: '#1e293b' }}>
            Inspired by this story? 
          </Typography>
          <Typography variant="body1" sx={{ color: '#64748b', mb: 3 }}>
            Share your own transformation journey and inspire others in our community.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Edit />}
            onClick={() => navigate('/create-story')}
            sx={{
              background: 'linear-gradient(135deg, #81c784 0%, #90caf9 100%)',
              borderRadius: '12px',
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: '0 6px 20px rgba(129, 199, 132, 0.3)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(129, 199, 132, 0.4)',
              }
            }}
          >
            Share Your Story
          </Button>
        </Paper>
      </Grow>
    </StoryContainer>
  );
}

export default StoryDetail;
