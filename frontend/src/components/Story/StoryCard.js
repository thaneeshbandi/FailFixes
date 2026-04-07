import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  Visibility,
  Share,
  ReadMore,
  TrendingUp,
  AccessTime,
  Person,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

// Animations
const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
`;

const shimmer = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const heartBeat = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

// Styled Components
const StoryCardContainer = styled(Card)(({ theme, featured }) => ({
  borderRadius: '20px',
  overflow: 'hidden',
  background: '#ffffff',
  border: '1px solid rgba(0, 0, 0, 0.06)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  ...(featured && {
    background: 'linear-gradient(135deg, rgba(129, 199, 132, 0.05) 0%, rgba(144, 202, 249, 0.05) 100%)',
    border: '1px solid rgba(129, 199, 132, 0.2)',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      background: 'linear-gradient(90deg, #81c784, #aed581, #90caf9)',
    }
  }),
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12)',
    '& .story-image': {
      transform: 'scale(1.05)',
    },
    '& .read-more-btn': {
      background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
      color: 'white',
      transform: 'translateX(4px)',
    },
    '& .shimmer-effect': {
      left: '100%',
    }
  }
}));

const CategoryBadge = styled(Chip)(({ theme, categoryColor }) => ({
  background: `${categoryColor}15`,
  color: categoryColor,
  fontWeight: 600,
  border: `1px solid ${categoryColor}30`,
  borderRadius: '8px',
  fontSize: '0.75rem',
  '&:hover': {
    background: `${categoryColor}25`,
  }
}));

const FeaturedBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  right: 12,
  background: 'linear-gradient(135deg, #ff9800, #ffb74d)',
  color: 'white',
  borderRadius: '8px',
  padding: '4px 8px',
  fontSize: '0.7rem',
  fontWeight: 700,
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  animation: `${float} 3s ease-in-out infinite`,
  boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
}));

const AuthorSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  background: 'rgba(248, 250, 252, 0.8)',
  borderRadius: '12px',
  marginBottom: theme.spacing(2),
}));

const StatsSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.5, 0),
  borderTop: '1px solid rgba(0, 0, 0, 0.08)',
  marginTop: 'auto',
}));

const ActionButton = styled(IconButton)(({ theme, active }) => ({
  borderRadius: '10px',
  padding: '8px',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  background: active ? 'rgba(244, 67, 54, 0.1)' : 'transparent',
  color: active ? '#f44336' : '#64748b',
  '&:hover': {
    background: active ? 'rgba(244, 67, 54, 0.2)' : 'rgba(100, 116, 139, 0.1)',
    transform: 'scale(1.1)',
    ...(active && {
      animation: `${heartBeat} 0.6s ease-in-out`,
    })
  }
}));

const ReadMoreButton = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '8px',
  background: 'rgba(255, 255, 255, 0.9)',
  color: '#1976d2',
  border: '1px solid rgba(25, 118, 210, 0.2)',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
    color: 'white',
    transform: 'translateY(-1px)',
  }
}));

const ShimmerOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: '-100%',
  width: '100%',
  height: '100%',
  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
  transition: 'left 0.6s ease',
  pointerEvents: 'none',
}));

function StoryCard({ 
  story, 
  onLike, 
  onShare, 
  currentUserId,
  showAuthor = true,
  compact = false 
}) {
  const navigate = useNavigate();

  const categories = {
    business: { label: 'Business', icon: '💼', color: '#1976d2' },
    personal: { label: 'Personal Growth', icon: '🌱', color: '#4caf50' },
    education: { label: 'Education', icon: '📚', color: '#ff9800' },
    health: { label: 'Health & Wellness', icon: '💪', color: '#f44336' },
    relationships: { label: 'Relationships', icon: '❤️', color: '#e91e63' },
    career: { label: 'Career', icon: '🚀', color: '#673ab7' },
    technology: { label: 'Technology', icon: '💻', color: '#00bcd4' },
    creative: { label: 'Creative Arts', icon: '🎨', color: '#ff5722' },
  };

  const categoryInfo = categories[story.category] || categories.personal;
  const isLiked = story.likedBy?.includes(currentUserId);

  const handleCardClick = (e) => {
    e.preventDefault();
    navigate(`/story/${story._id}`);
  };

  const handleLikeClick = (e) => {
    e.stopPropagation();
    onLike?.(story._id);
  };

  const handleShareClick = (e) => {
    e.stopPropagation();
    onShare?.(story);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const truncateText = (text, length) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  return (
    <Fade in timeout={600}>
      <StoryCardContainer 
        featured={story.featured}
        onClick={handleCardClick}
      >
        <ShimmerOverlay className="shimmer-effect" />
        
        {story.featured && (
          <FeaturedBadge>
            <TrendingUp sx={{ fontSize: 12 }} />
            Featured
          </FeaturedBadge>
        )}

        <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Category and Read Time */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <CategoryBadge 
              label={`${categoryInfo.icon} ${categoryInfo.label}`}
              categoryColor={categoryInfo.color}
              size="small"
            />
            <Box display="flex" alignItems="center" gap={0.5}>
              <AccessTime sx={{ fontSize: 14, color: '#64748b' }} />
              <Typography variant="caption" color="text.secondary">
                {story.readTime || 5} min
              </Typography>
            </Box>
          </Box>

          {/* Story Title */}
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 700, 
              color: '#1e293b', 
              mb: 2,
              lineHeight: 1.3,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 1 : 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {story.title}
          </Typography>

          {/* Story Excerpt */}
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#64748b', 
              mb: 3,
              lineHeight: 1.6,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 2 : 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {story.excerpt || truncateText(story.content, 150)}
          </Typography>

          {/* Author Info */}
          {showAuthor && (
            <AuthorSection>
              <Avatar 
                sx={{ 
                  width: 32, 
                  height: 32,
                  background: 'linear-gradient(135deg, #81c784, #90caf9)',
                  fontSize: '0.9rem',
                  fontWeight: 700
                }}
                src={story.author?.avatar}
              >
                {story.authorName?.charAt(0) || story.author?.name?.charAt(0) || 'A'}
              </Avatar>
              <Box flexGrow={1}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>
                  {story.authorName || story.author?.name || 'Anonymous'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(story.createdAt)} • {story.engagement?.views || 0} views
                </Typography>
              </Box>
            </AuthorSection>
          )}

          {/* Tags */}
          {story.tags && story.tags.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {story.tags.slice(0, 3).map((tag, index) => (
                  <Chip 
                    key={index} 
                    label={tag} 
                    size="small" 
                    variant="outlined"
                    sx={{ 
                      borderRadius: 2, 
                      fontSize: '0.7rem',
                      height: 24,
                      borderColor: 'rgba(100, 116, 139, 0.2)',
                      color: '#64748b'
                    }}
                  />
                ))}
                {story.tags.length > 3 && (
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 1 }}>
                    +{story.tags.length - 3} more
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Stats and Actions */}
          <StatsSection>
            <Box display="flex" alignItems="center" gap={2}>
              <Tooltip title={isLiked ? "Unlike" : "Like this story"}>
                <ActionButton 
                  active={isLiked}
                  onClick={handleLikeClick}
                  size="small"
                >
                  {isLiked ? <Favorite sx={{ fontSize: 18 }} /> : <FavoriteBorder sx={{ fontSize: 18 }} />}
                </ActionButton>
              </Tooltip>
              
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                {story.engagement?.likes || 0}
              </Typography>

              <Box display="flex" alignItems="center" gap={0.5} ml={1}>
                <Visibility sx={{ fontSize: 16, color: '#64748b' }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  {story.engagement?.views || 0}
                </Typography>
              </Box>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Tooltip title="Share this story">
                <ActionButton onClick={handleShareClick} size="small">
                  <Share sx={{ fontSize: 16 }} />
                </ActionButton>
              </Tooltip>

              <ReadMoreButton className="read-more-btn">
                <ReadMore sx={{ fontSize: 16 }} />
                Read More
              </ReadMoreButton>
            </Box>
          </StatsSection>
        </CardContent>
      </StoryCardContainer>
    </Fade>
  );
}

export default StoryCard;
