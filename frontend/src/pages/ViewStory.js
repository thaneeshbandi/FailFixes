/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Avatar,
  Chip,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  Card,
  CardContent,
  TextField,
  Collapse,
  Fade,
  Grow,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  ArrowBack,
  Share,
  Favorite,
  FavoriteOutlined,
  Comment,
  Visibility,
  AccessTime,
  TrendingUp,
  Person,
  Category as CategoryIcon,
  Send,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  School,
  Business,
  Psychology,
  FitnessCenter,
  Computer,
  Palette,
  FamilyRestroom,
  Chat
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatAPI } from '../services/api';

// ✅ ADD API BASE URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Animation keyframes
const gentleFloat = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(1deg); }
`;

const softGlow = keyframes`
  0%, 100% { box-shadow: 0 0 15px rgba(129, 199, 132, 0.2); }
  50% { box-shadow: 0 0 25px rgba(129, 199, 132, 0.3); }
`;

// Styled Components
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
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(8),
}));

const StoryCard = styled(Paper)(({ theme }) => ({
  background: `
    linear-gradient(135deg, 
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.8) 100%
    )
  `,
  backdropFilter: 'blur(20px) saturate(120%)',
  WebkitBackdropFilter: 'blur(20px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '24px',
  padding: theme.spacing(6),
  marginBottom: theme.spacing(4),
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
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(90deg, #81c784, #aed581, #90caf9, #f8bbd9)',
    borderRadius: '24px 24px 0 0',
  }
}));

const ActionButton = styled(Button)(({ variant: buttonVariant, selected }) => ({
  borderRadius: 16,
  padding: '12px 24px',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s ease',
  ...(buttonVariant === 'like' && {
    background: selected 
      ? 'linear-gradient(135deg, #e91e63, #f06292)' 
      : 'rgba(255, 255, 255, 0.8)',
    color: selected ? '#fff' : '#e91e63',
    border: `2px solid ${selected ? '#e91e63' : 'rgba(233, 30, 99, 0.3)'}`,
    '&:hover': {
      background: selected 
        ? 'linear-gradient(135deg, #d81b60, #e91e63)'
        : 'linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(233, 30, 99, 0.05))',
      transform: 'translateY(-2px) scale(1.05)',
    }
  }),
  ...(buttonVariant === 'comment' && {
    background: 'rgba(33, 150, 243, 0.1)',
    color: '#2196f3',
    border: '2px solid rgba(33, 150, 243, 0.3)',
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.2), rgba(33, 150, 243, 0.1))',
      transform: 'translateY(-2px) scale(1.05)',
    }
  }),
  ...(buttonVariant === 'message' && {
    background: 'linear-gradient(135deg, #81c784, #aed581)',
    color: '#fff',
    border: '2px solid #81c784',
    '&:hover': {
      background: 'linear-gradient(135deg, #66bb6a, #81c784)',
      transform: 'translateY(-2px) scale(1.05)',
    }
  })
}));

const MetadataChip = styled(Chip)(({ theme, variant: chipVariant }) => ({
  borderRadius: 16,
  padding: '12px 16px',
  fontSize: '0.9rem',
  fontWeight: 600,
  height: 'auto',
  ...(chipVariant === 'recovery' && {
    background: 'linear-gradient(135deg, #81c784, #aed581)',
    color: '#fff',
    '& .MuiSvgIcon-root': { color: '#fff' }
  }),
  ...(chipVariant === 'status' && {
    background: 'linear-gradient(135deg, #2196f3, #64b5f6)',
    color: '#fff',
    '& .MuiSvgIcon-root': { color: '#fff' }
  })
}));

const CommentCard = styled(Paper)(({ theme }) => ({
  background: 'rgba(255, 255, 255, 0.7)',
  backdropFilter: 'blur(10px)',
  borderRadius: 16,
  padding: theme.spacing(3),
  marginBottom: theme.spacing(2),
  border: '1px solid rgba(255, 255, 255, 0.3)',
}));

function ViewStory() {
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated } = useAuth();

  const categories = [
    { value: 'business', label: 'Business & Startup', icon: Business, color: '#81c784' },
    { value: 'personal', label: 'Personal Growth', icon: Psychology, color: '#90caf9' },
    { value: 'education', label: 'Education & Learning', icon: School, color: '#ffb74d' },
    { value: 'health', label: 'Health & Wellness', icon: FitnessCenter, color: '#f8bbd9' },
    { value: 'relationships', label: 'Relationships', icon: FamilyRestroom, color: '#b39ddb' },
    { value: 'career', label: 'Career & Work', icon: Business, color: '#81c784' },
    { value: 'technology', label: 'Technology', icon: Computer, color: '#90caf9' },
    { value: 'creative', label: 'Creative Arts', icon: Palette, color: '#ffb74d' }
  ];

  const getCategoryInfo = (categoryValue) => {
    return categories.find(cat => cat.value === categoryValue) || 
           { label: categoryValue, icon: CategoryIcon, color: '#81c784' };
  };

  const handleMessage = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user._id === story.author?._id) {
      alert('You cannot send a message to yourself!');
      return;
    }

    try {
      setMessageLoading(true);

      const response = await chatAPI.createDirectChat(story.author._id);

      if (response.data.success) {
        navigate('/chat', { 
          state: { 
            selectedChatId: response.data.chat._id,
            authorName: story.author.name 
          } 
        });
      } else {
        throw new Error(response.data.message || 'Failed to create chat');
      }
    } catch (error) {
      console.error('❌ Message error:', error);
      alert('Error starting conversation. Please try again.');
    } finally {
      setMessageLoading(false);
    }
  };

  // ✅ UPDATED: Fetch story data with environment variable
  useEffect(() => {
    const fetchStory = async () => {
      try {
        setLoading(true);
        setError('');

        const token = localStorage.getItem('token') || localStorage.getItem('ff_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/stories/${id}`, { headers });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load story');
        }

        setStory(data.story);
        console.log('📖 Story loaded:', data.story);
      } catch (err) {
        console.error('❌ Error loading story:', err);
        setError(err.message || 'Failed to load story');
      } finally {
        setLoading(false);
        setMounted(true);
      }
    };

    fetchStory();
  }, [id]);

  // ✅ UPDATED: Handle like with environment variable
  const handleLike = async () => {
    if (likeLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('token') || localStorage.getItem('ff_token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setLikeLoading(true);

      const response = await fetch(`${API_BASE_URL}/stories/${id}/like`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setStory(prev => ({
          ...prev,
          stats: { ...prev.stats, likes: data.likesCount },
          isLiked: data.isLiked
        }));
        console.log('✅ Like updated:', data.isLiked, data.likesCount);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('❌ Like error:', error);
      alert('Error updating like. Please try again.');
    } finally {
      setLikeLoading(false);
    }
  };

  // ✅ UPDATED: Handle comment with environment variable
  const handleComment = async () => {
    if (!commentText.trim() || commentLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('token') || localStorage.getItem('ff_token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setCommentLoading(true);

      const response = await fetch(`${API_BASE_URL}/stories/${id}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: commentText })
      });

      const data = await response.json();

      if (response.ok) {
        setStory(prev => ({
          ...prev,
          comments: [...(prev.comments || []), data.comment],
          stats: { ...prev.stats, comments: data.commentsCount }
        }));
        setCommentText('');
        console.log('✅ Comment added:', data.comment);
      } else {
        throw new Error(data.message || 'Error adding comment');
      }
    } catch (error) {
      console.error('❌ Comment error:', error);
      alert('Error adding comment. Please try again.');
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading) {
    return (
      <BackgroundContainer>
        <Container maxWidth="md" sx={{ py: 8 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
            <CircularProgress size={60} sx={{ color: '#81c784' }} />
          </Box>
        </Container>
      </BackgroundContainer>
    );
  }

  if (error) {
    return (
      <BackgroundContainer>
        <Container maxWidth="md" sx={{ py: 8 }}>
          <Alert severity="error" sx={{ borderRadius: 3, mb: 4 }}>
            {error}
          </Alert>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/browse')}
            sx={{ borderRadius: 2 }}
          >
            Back to Stories
          </Button>
        </Container>
      </BackgroundContainer>
    );
  }

  const categoryInfo = getCategoryInfo(story.category);
  const CategoryIconComponent = categoryInfo.icon;

  return (
    <BackgroundContainer>
      <Container maxWidth="md">
        {/* Header Actions */}
        <Fade in={mounted} timeout={600}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/browse')}
              sx={{ 
                borderRadius: 2, 
                color: '#81c784', 
                borderColor: '#81c784',
                '&:hover': { borderColor: '#66bb6a', backgroundColor: 'rgba(129, 199, 132, 0.1)' }
              }}
            >
              Back to Stories
            </Button>
            <IconButton 
              sx={{ 
                color: '#81c784',
                '&:hover': { backgroundColor: 'rgba(129, 199, 132, 0.1)' }
              }}
            >
              <Share />
            </IconButton>
          </Box>
        </Fade>

        {/* Main Story Card */}
        <Grow in={mounted} timeout={800}>
          <StoryCard>
            {/* Category Badge */}
            {story.category && (
              <Box mb={3}>
                <Chip
                  icon={<CategoryIconComponent />}
                  label={categoryInfo.label}
                  sx={{
                    background: 'linear-gradient(135deg, #81c784, #aed581)',
                    color: '#fff',
                    fontWeight: 600,
                    padding: '8px 12px',
                    '& .MuiSvgIcon-root': { color: '#fff' }
                  }}
                />
              </Box>
            )}

            {/* Story Title */}
            <Typography 
              variant={isMobile ? "h4" : "h3"}
              sx={{ 
                fontWeight: 800, 
                mb: 4,
                color: '#2e7d32',
                lineHeight: 1.2
              }}
            >
              {story.title}
            </Typography>

            {/* Author Info with Message Button */}
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={4}>
              <Box display="flex" alignItems="center">
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    background: 'linear-gradient(135deg, #81c784, #aed581)',
                    mr: 2,
                    animation: `${gentleFloat} 4s ease-in-out infinite`
                  }}
                >
                  <Person sx={{ fontSize: '1.8rem' }} />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {story.author?.name || 'Anonymous'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    @{story.author?.username || 'user'} • {story.readTime || 1} min read
                  </Typography>
                </Box>
              </Box>

              {/* Message Button */}
              {isAuthenticated && user._id !== story.author?._id && (
                <ActionButton
                  variant="message"
                  startIcon={messageLoading ? <CircularProgress size={18} color="inherit" /> : <Chat />}
                  onClick={handleMessage}
                  disabled={messageLoading}
                  sx={{ minWidth: 140 }}
                >
                  {messageLoading ? 'Starting...' : 'Message'}
                </ActionButton>
              )}

              {!isAuthenticated && (
                <Button
                  variant="outlined"
                  startIcon={<Chat />}
                  onClick={() => navigate('/login')}
                  sx={{
                    borderColor: '#81c784',
                    color: '#81c784',
                    '&:hover': { borderColor: '#66bb6a', backgroundColor: 'rgba(129, 199, 132, 0.1)' }
                  }}
                >
                  Sign in to Message
                </Button>
              )}
            </Box>

            {/* Recovery Time and Status Display */}
            <Box mb={4}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#2e7d32' }}>
                Recovery Journey
              </Typography>
              <Stack direction={isMobile ? 'column' : 'row'} spacing={2} mb={2}>
                {story.metadata?.recoveryTime && (
                  <MetadataChip
                    variant="recovery"
                    icon={<AccessTime />}
                    label={`Recovery Time: ${story.metadata.recoveryTime}`}
                  />
                )}
                {story.metadata?.currentStatus && (
                  <MetadataChip
                    variant="status"
                    icon={<TrendingUp />}
                    label={`Current Status: ${story.metadata.currentStatus.replace('_', ' ').toUpperCase()}`}
                  />
                )}
              </Stack>
              {story.metadata?.currentStatus === 'thriving' && (
                <Box display="flex" alignItems="center" mt={1}>
                  <CheckCircle sx={{ color: '#4caf50', fontSize: 20, mr: 1 }} />
                  <Typography variant="body2" sx={{ color: '#4caf50', fontWeight: 600 }}>
                    Success Story - Fully Recovered & Thriving
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Story Content */}
            <Typography 
              variant="body1" 
              sx={{ 
                whiteSpace: 'pre-line',
                lineHeight: 1.8,
                fontSize: '1.1rem',
                mb: 4,
                color: 'text.primary'
              }}
            >
              {story.content}
            </Typography>

            {/* Key Lessons */}
            {story.metadata?.keyLessons && story.metadata.keyLessons.length > 0 && (
              <Box mb={4}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#2e7d32' }}>
                  Key Lessons Learned
                </Typography>
                <Box
                  sx={{
                    background: 'rgba(129, 199, 132, 0.1)',
                    borderRadius: 3,
                    padding: 3,
                    borderLeft: '4px solid #81c784'
                  }}
                >
                  {story.metadata.keyLessons.map((lesson, index) => (
                    <Box key={index} display="flex" alignItems="flex-start" mb={1.5}>
                      <Typography
                        variant="body2"
                        sx={{
                          background: '#81c784',
                          color: '#fff',
                          borderRadius: '50%',
                          width: 24,
                          height: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          mr: 2,
                          mt: 0.5,
                          fontSize: '0.75rem'
                        }}
                      >
                        {index + 1}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500, lineHeight: 1.6 }}>
                        {lesson}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Tags */}
            {story.tags && story.tags.length > 0 && (
              <Box mb={4}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#2e7d32' }}>
                  Tags
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {story.tags.map((tag, index) => (
                    <Chip
                      key={index}
                      label={`#${tag}`}
                      variant="outlined"
                      sx={{
                        borderColor: '#81c784',
                        color: '#81c784',
                        fontWeight: 600,
                        '&:hover': { backgroundColor: 'rgba(129, 199, 132, 0.1)' }
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Divider sx={{ mb: 4 }} />

            {/* Stats */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
              <Stack direction="row" spacing={3}>
                <Box display="flex" alignItems="center">
                  <Visibility sx={{ fontSize: 18, color: '#81c784', mr: 1 }} />
                  <Typography variant="body2" fontWeight="600">
                    {story.stats?.views || 0} views
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Favorite sx={{ fontSize: 18, color: '#e91e63', mr: 1 }} />
                  <Typography variant="body2" fontWeight="600">
                    {story.stats?.likes || 0} likes
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center">
                  <Comment sx={{ fontSize: 18, color: '#2196f3', mr: 1 }} />
                  <Typography variant="body2" fontWeight="600">
                    {story.stats?.comments || 0} comments
                  </Typography>
                </Box>
              </Stack>
            </Box>

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} justifyContent="center">
              <ActionButton
                variant="like"
                selected={story.isLiked}
                startIcon={
                  likeLoading ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : story.isLiked ? (
                    <Favorite />
                  ) : (
                    <FavoriteOutlined />
                  )
                }
                onClick={handleLike}
                disabled={likeLoading || !isAuthenticated}
              >
                {story.isLiked ? 'Liked' : 'Like'} ({story.stats?.likes || 0})
              </ActionButton>

              <ActionButton
                variant="comment"
                startIcon={showComments ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setShowComments(!showComments)}
              >
                Comments ({story.stats?.comments || 0})
              </ActionButton>
            </Stack>

            {/* Authentication Notice */}
            {!isAuthenticated && (
              <Box textAlign="center" mt={3}>
                <Typography variant="body2" color="text.secondary">
                  <Button
                    variant="text" 
                    onClick={() => navigate('/login')}
                    sx={{ textTransform: 'none', color: '#81c784' }}
                  >
                    Sign in
                  </Button>
                  {' '}to like, comment, and message the author
                </Typography>
              </Box>
            )}
          </StoryCard>
        </Grow>

        {/* Comments Section */}
        <Collapse in={showComments}>
          <Fade in={showComments}>
            <StoryCard>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#2e7d32' }}>
                Comments ({story.stats?.comments || 0})
              </Typography>

              {/* Add Comment Form */}
              {isAuthenticated ? (
                <Box mb={4}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Share your thoughts..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)'
                      }
                    }}
                  />
                  <Box display="flex" justifyContent="flex-end">
                    <Button
                      variant="contained"
                      startIcon={commentLoading ? <CircularProgress size={18} color="inherit" /> : <Send />}
                      onClick={handleComment}
                      disabled={!commentText.trim() || commentLoading}
                      sx={{
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #81c784, #aed581)',
                        '&:hover': { background: 'linear-gradient(135deg, #66bb6a, #81c784)' }
                      }}
                    >
                      {commentLoading ? 'Posting...' : 'Post Comment'}
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box mb={4} textAlign="center" py={2} sx={{ background: 'rgba(129, 199, 132, 0.1)', borderRadius: 2 }}>
                  <Typography variant="body1" color="text.secondary">
                    <Button
                      variant="text" 
                      onClick={() => navigate('/login')}
                      sx={{ textTransform: 'none', color: '#81c784', fontWeight: 600 }}
                    >
                      Sign in
                    </Button>
                    {' '}to join the conversation
                  </Typography>
                </Box>
              )}

              {/* Comments List */}
              {story.comments && story.comments.length > 0 ? (
                story.comments.map((comment, index) => (
                  <CommentCard key={index}>
                    <Box display="flex" alignItems="flex-start" gap={2}>
                      <Avatar sx={{ width: 40, height: 40, background: '#81c784' }}>
                        <Person />
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          {comment.user?.name || 'Anonymous'}
                        </Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                          {comment.content}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </CommentCard>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                  No comments yet. Be the first to share your thoughts!
                </Typography>
              )}
            </StoryCard>
          </Fade>
        </Collapse>
      </Container>
    </BackgroundContainer>
  );
}

export default ViewStory;
