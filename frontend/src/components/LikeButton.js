import React, { useState } from 'react';
import { IconButton, Typography, Box, Tooltip, CircularProgress } from '@mui/material';
import { Favorite, FavoriteOutlined } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 🎯 FIXED: Filter out isLiked prop to prevent React warning
const LikeButton = styled(({ isLiked, ...other }) => <IconButton {...other} />)(({ theme, isLiked }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderRadius: 20,
  background: isLiked 
    ? 'linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(233, 30, 99, 0.05))'
    : 'rgba(255, 255, 255, 0.8)',
  border: `1px solid ${isLiked ? '#e91e63' : 'rgba(129, 199, 132, 0.3)'}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    background: isLiked
      ? 'linear-gradient(135deg, rgba(233, 30, 99, 0.2), rgba(233, 30, 99, 0.1))'
      : 'linear-gradient(135deg, rgba(233, 30, 99, 0.1), rgba(233, 30, 99, 0.05))',
    transform: 'scale(1.05)',
    boxShadow: isLiked
      ? '0 4px 16px rgba(233, 30, 99, 0.3)'
      : '0 4px 16px rgba(129, 199, 132, 0.3)'
  },
  '&:disabled': {
    opacity: 0.7,
    transform: 'none',
    pointerEvents: 'none'
  }
}));

function LikeButtonComponent({ storyId, initialLikes = 0, initialIsLiked = false, onLikeChange }) {
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (loading) return;

    const token = localStorage.getItem('token') || localStorage.getItem('ff_token');
    if (!token) {
      if (onLikeChange) {
        onLikeChange(false, likesCount, true); // true indicates need to login
      }
      return;
    }

    try {
      setLoading(true);

      // Optimistic update for immediate UI response
      const newIsLiked = !isLiked;
      const newLikesCount = newIsLiked ? likesCount + 1 : likesCount - 1;
      
      setIsLiked(newIsLiked);
      setLikesCount(newLikesCount);

      const response = await fetch(`http://localhost:5000/api/stories/${storyId}/like`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      // Update with server response (this ensures accuracy)
      setIsLiked(data.isLiked);
      setLikesCount(data.likesCount);

      // Callback for parent component to update its state
      if (onLikeChange) {
        onLikeChange(data.isLiked, data.likesCount);
      }

    } catch (error) {
      console.error('Like error:', error);
      // Revert optimistic update on error
      setIsLiked(initialIsLiked);
      setLikesCount(initialLikes);
    } finally {
      setLoading(false);
    }
  };

  // Update local state when props change (for parent updates)
  React.useEffect(() => {
    setLikesCount(initialLikes);
    setIsLiked(initialIsLiked);
  }, [initialLikes, initialIsLiked]);

  const tooltipTitle = loading 
    ? 'Processing...' 
    : (isLiked ? 'Remove like' : 'Like this story');

  return (
    <Tooltip title={tooltipTitle} arrow placement="top">
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <LikeButton 
          isLiked={isLiked} 
          onClick={handleLike}
          disabled={loading}
        >
          {loading ? (
            <CircularProgress size={16} sx={{ color: isLiked ? '#e91e63' : '#666' }} />
          ) : (
            <>
              {isLiked ? (
                <Favorite sx={{ color: '#e91e63', fontSize: 20 }} />
              ) : (
                <FavoriteOutlined sx={{ color: '#666', fontSize: 20 }} />
              )}
            </>
          )}
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 600, 
              color: isLiked ? '#e91e63' : '#666',
              ml: loading ? 1 : 0
            }}
          >
            {likesCount}
          </Typography>
        </LikeButton>
      </Box>
    </Tooltip>
  );
}

export default LikeButtonComponent;
