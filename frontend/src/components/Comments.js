import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Avatar, Paper, Divider,
  CircularProgress, Alert, IconButton, Stack
} from '@mui/material';
import { Send, MoreVert, Reply } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { formatDistanceToNow } from 'date-fns';

const CommentsContainer = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.8))',
  backdropFilter: 'blur(15px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: 20,
  padding: theme.spacing(4),
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
}));

const CommentItem = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  marginBottom: theme.spacing(2),
  background: 'rgba(255, 255, 255, 0.6)',
  border: '1px solid rgba(129, 199, 132, 0.1)',
  transition: 'all 0.3s ease',
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.8)',
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
  }
}));

const AddCommentBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  background: 'rgba(129, 199, 132, 0.05)',
  border: '1px solid rgba(129, 199, 132, 0.2)',
  marginBottom: theme.spacing(3)
}));

function Comments({ storyId, initialCommentsCount = 0 }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState('');
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount);

  useEffect(() => {
    fetchComments();
  }, [storyId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/stories/${storyId}/comments`);
      const data = await response.json();

      if (response.ok) {
        setComments(data.comments || []);
        setCommentsCount(data.pagination?.totalComments || 0);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Fetch comments error:', error);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    const token = localStorage.getItem('token') || localStorage.getItem('ff_token');
    if (!token) {
      setError('Please login to comment');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(`http://localhost:5000/api/stories/${storyId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newComment.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setComments(prev => [data.comment, ...prev]);
        setCommentsCount(data.commentsCount);
        setNewComment('');
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Add comment error:', error);
      setError(error.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'just now';
    }
  };

  return (
    <CommentsContainer>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#2e7d32' }}>
        Comments ({commentsCount})
      </Typography>

      {/* Add Comment Section */}
      <AddCommentBox>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#81c784' }}>
          Join the Discussion
        </Typography>
        
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder="Share your thoughts..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.8)'
            }
          }}
        />
        
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {newComment.length}/500 characters
          </Typography>
          
          <Button
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} /> : <Send />}
            onClick={handleAddComment}
            disabled={!newComment.trim() || submitting || newComment.length > 500}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(135deg, #81c784, #aed581)',
              '&:hover': {
                background: 'linear-gradient(135deg, #66bb6a, #81c784)'
              }
            }}
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </Button>
        </Box>
      </AddCommentBox>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Comments List */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress sx={{ color: '#81c784' }} />
        </Box>
      ) : comments.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography variant="h6" color="text.secondary" mb={2}>
            No comments yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Be the first to share your thoughts!
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {comments.map((comment) => (
            <CommentItem key={comment._id}>
              <Box display="flex" gap={2}>
                <Avatar
                  sx={{
                    width: 40,
                    height: 40,
                    background: 'linear-gradient(135deg, #81c784, #aed581)',
                    fontSize: '1rem',
                    fontWeight: 700
                  }}
                >
                  {comment.user?.name?.charAt(0) || 'U'}
                </Avatar>
                
                <Box flexGrow={1}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                      {comment.user?.name || 'Anonymous'}
                    </Typography>
                    
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(comment.createdAt)}
                      </Typography>
                      <IconButton size="small">
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      lineHeight: 1.6, 
                      color: 'text.primary',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {comment.content}
                  </Typography>
                  
                  <Box mt={1}>
                    <Button 
                      size="small" 
                      startIcon={<Reply />}
                      sx={{ 
                        color: '#81c784',
                        textTransform: 'none',
                        fontWeight: 500
                      }}
                    >
                      Reply
                    </Button>
                  </Box>
                </Box>
              </Box>
            </CommentItem>
          ))}
        </Stack>
      )}
    </CommentsContainer>
  );
}

export default Comments;
