import React, { useState } from 'react';
import { Button, IconButton } from '@mui/material';
import { PersonAdd, PersonRemove } from '@mui/icons-material';
import { userAPI } from '../services/api';

function FollowButton({ 
  username, 
  isFollowing: initialFollowing = false, 
  onFollowChange,
  size = "medium",
  variant = "contained"
}) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleFollow = async (e) => {
    e?.stopPropagation();
    setLoading(true);
    
    try {
      const response = await userAPI.followUser(username);
      setIsFollowing(response.data.isFollowing);
      onFollowChange?.(response.data.isFollowing);
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (size === "small") {
    return (
      <IconButton
        onClick={handleFollow}
        disabled={loading}
        size="small"
        color={isFollowing ? "default" : "primary"}
      >
        {isFollowing ? <PersonRemove fontSize="small" /> : <PersonAdd fontSize="small" />}
      </IconButton>
    );
  }

  return (
    <Button
      variant={isFollowing ? "outlined" : variant}
      startIcon={isFollowing ? <PersonRemove /> : <PersonAdd />}
      onClick={handleFollow}
      disabled={loading}
      color={isFollowing ? "default" : "primary"}
      size={size}
    >
      {loading ? 'Loading...' : (isFollowing ? 'Unfollow' : 'Follow')}
    </Button>
  );
}

export default FollowButton;
