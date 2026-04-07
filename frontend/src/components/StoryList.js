import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Box,
  Chip,
  Button,
  Pagination,
  CircularProgress,
  Grow,
  Paper,
  Stack,
} from '@mui/material';
import {
  Favorite,
  Visibility,
  ReadMore,
  AccessTime,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { formatDistanceToNow } from 'date-fns';

// Animations
const gentleFloat = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
`;

// Styled Components
const StoryCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.8) 100%)`,
  backdropFilter: 'blur(15px) saturate(120%)',
  WebkitBackdropFilter: 'blur(15px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '20px',
  overflow: 'hidden',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: `0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)`,
  '&:hover': {
    transform: 'translateY(-4px) scale(1.01)',
    boxShadow: `0 12px 32px rgba(0, 0, 0, 0.12), 0 6px 16px rgba(129, 199, 132, 0.2)`,
    '& .story-avatar': {
      animation: `${gentleFloat} 2s ease-in-out infinite`,
    },
    '& .read-button': {
      background: 'linear-gradient(135deg, #81c784, #aed581)',
      color: 'white',
      transform: 'scale(1.05)',
    }
  }
}));

const EmptyState = styled(Paper)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(8),
  background: 'rgba(255, 255, 255, 0.8)',
  backdropFilter: 'blur(20px)',
  borderRadius: '24px',
  border: '1px solid rgba(255, 255, 255, 0.3)',
}));

function StoriesList({ stories, loading, onStoryClick, pagination, onPageChange }) {
  
  // Get category color
  const getCategoryColor = (category) => {
    const colors = {
      business: '#81c784',
      personal: '#90caf9',
      education: '#ffb74d',
      health: '#f8bbd9',
      relationships: '#b39ddb',
      career: '#ff8a65',
      technology: '#81c784',
      creative: '#90caf9',
    };
    return colors[category] || '#64748b';
  };

  // Format read time
  const formatReadTime = (readTime) => {
    return readTime ? `${readTime} min read` : '5 min read';
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress size={60} sx={{ color: '#81c784' }} />
        <Typography variant="h6" sx={{ mt: 3, color: 'text.secondary' }}>
          Loading stories...
        </Typography>
      </Box>
    );
  }

  // Empty state
  if (!stories || stories.length === 0) {
    return (
      <EmptyState>
        <Typography variant="h4" sx={{ 
          fontWeight: 700, 
          mb: 3, 
          color: '#81c784' 
        }}>
          No Stories Found
        </Typography>
        <Typography variant="h6" sx={{ 
          color: 'text.secondary', 
          mb: 4,
          maxWidth: 400,
          mx: 'auto' 
        }}>
          Be the first to share your inspiring transformation story with our community.
        </Typography>
        <Button
          variant="contained"
          size="large"
          sx={{
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #81c784, #aed581)',
            color: 'white',
            fontWeight: 600,
            px: 4,
            py: 1.5,
          }}
        >
          Share Your Story
        </Button>
      </EmptyState>
    );
  }

  return (
    <>
      {/* Stories Grid */}
      <Grid container spacing={4}>
        {stories.map((story, index) => (
          <Grid item xs={12} sm={6} lg={4} key={story._id}>
            <Grow in timeout={800 + index * 200}>
              <StoryCard onClick={() => onStoryClick(story)}>
                <CardContent sx={{ p: 4, flexGrow: 1 }}>
                  {/* Category & Read Time */}
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                    <Chip 
                      label={story.category} 
                      sx={{
                        background: `${getCategoryColor(story.category)}20`,
                        color: getCategoryColor(story.category),
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        textTransform: 'capitalize',
                      }}
                    />
                    <Box display="flex" alignItems="center" gap={1}>
                      <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ 
                        color: 'text.secondary',
                        fontWeight: 600,
                      }}>
                        {formatReadTime(story.readTime || story.metadata?.readTime)}
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Title */}
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 700, 
                      color: 'text.primary', 
                      mb: 2,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {story.title}
                  </Typography>
                  
                  {/* Excerpt */}
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'text.secondary', 
                      mb: 3,
                      lineHeight: 1.6,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {story.excerpt || story.content?.substring(0, 150) + '...'}
                  </Typography>
                  
                  {/* Author */}
                  <Box display="flex" alignItems="center" gap={2} mb={3}>
                    <Avatar 
                      className="story-avatar"
                      sx={{ 
                        width: 40, 
                        height: 40,
                        background: 'linear-gradient(135deg, #81c784, #aed581)',
                        fontSize: '1rem',
                        fontWeight: 700,
                      }}
                    >
                      {story.author?.name?.charAt(0) || story.author?.username?.charAt(0) || 'U'}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" sx={{ 
                        fontWeight: 600, 
                        color: 'text.primary',
                      }}>
                        {story.author?.name || story.author?.username || 'Anonymous'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ 
                        fontWeight: 500,
                      }}>
                        {story.publishedAt 
                          ? formatDistanceToNow(new Date(story.publishedAt), { addSuffix: true })
                          : formatDistanceToNow(new Date(story.createdAt), { addSuffix: true })
                        }
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Stats & Read Button */}
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={3}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Favorite sx={{ fontSize: 16, color: '#f8bbd9' }} />
                        <Typography variant="body2" sx={{ 
                          color: 'text.secondary', 
                          fontWeight: 600,
                        }}>
                          {story.stats?.likes || 0}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Visibility sx={{ fontSize: 16, color: '#90caf9' }} />
                        <Typography variant="body2" sx={{ 
                          color: 'text.secondary', 
                          fontWeight: 600,
                        }}>
                          {story.stats?.views || 0}
                        </Typography>
                      </Box>
                    </Stack>
                    
                    <Button
                      className="read-button"
                      size="small"
                      endIcon={<ReadMore />}
                      sx={{
                        borderRadius: '12px',
                        background: 'rgba(129, 199, 132, 0.1)',
                        color: '#81c784',
                        fontWeight: 600,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'rgba(129, 199, 132, 0.2)',
                        }
                      }}
                    >
                      Read
                    </Button>
                  </Box>

                  {/* Tags */}
                  {story.tags && story.tags.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      {story.tags.slice(0, 3).map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          variant="outlined"
                          sx={{ 
                            mr: 0.5, 
                            mb: 0.5,
                            borderColor: 'rgba(129, 199, 132, 0.3)',
                            color: '#81c784',
                            fontSize: '0.75rem',
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </StoryCard>
            </Grow>
          </Grid>
        ))}
      </Grid>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={6}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.currentPage}
            onChange={(event, value) => onPageChange(value)}
            color="primary"
            size="large"
            sx={{
              '& .MuiPaginationItem-root': {
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '1rem',
                minWidth: 44,
                height: 44,
                margin: '0 4px',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                background: 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  transform: 'translateY(-2px) scale(1.05)',
                  boxShadow: '0 6px 20px rgba(129, 199, 132, 0.3)',
                  background: 'rgba(129, 199, 132, 0.1)',
                }
              },
              '& .Mui-selected': {
                background: 'linear-gradient(135deg, #81c784, #aed581) !important',
                color: 'white !important',
                boxShadow: '0 4px 15px rgba(129, 199, 132, 0.4)',
                transform: 'translateY(-1px)',
              }
            }}
          />
        </Box>
      )}
    </>
  );
}

export default StoriesList;
