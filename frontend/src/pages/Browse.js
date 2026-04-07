/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import {
  Container, Typography, Grid, Box, TextField, InputAdornment,
  FormControl, Select, MenuItem, InputLabel, Chip, Paper, Avatar,
  Fade, Grow, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Stack, Alert, CircularProgress, Card, CardContent, CardActions
} from '@mui/material';
import {
  Search, Category, Business, Psychology, School, FitnessCenter,
  FamilyRestroom, Computer, Palette, AccessTime, Favorite, Visibility,
  Login, PersonAdd, AutoFixHigh, Close, ArrowForward, OpenInNew,
  Comment, FavoriteOutlined
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';


// Custom hook for debounced search
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};


// 🎨 **ELEGANT ANIMATIONS - Matching Home Style**
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

// 🏗️ **ELEGANT STYLED COMPONENTS - Matching Home Style**
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
  padding: theme.spacing(6, 6),
  textAlign: 'center',
  marginBottom: theme.spacing(6),
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

const SearchCard = styled(Paper)(({ theme }) => ({
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
  padding: theme.spacing(5),
  marginBottom: theme.spacing(6),
  boxShadow: `
    0 6px 24px rgba(0, 0, 0, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.04)
  `,
}));

const ElegantButton = styled(Button)(({ theme, variant: buttonVariant }) => ({
  borderRadius: '16px',
  padding: '12px 28px',
  fontSize: '0.95rem',
  fontWeight: 600,
  textTransform: 'none',
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

const CategoryChip = styled(Chip)(({ theme, selected }) => ({
  borderRadius: '16px',
  padding: '8px 4px',
  fontSize: '0.9rem',
  fontWeight: 600,
  minHeight: 40,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  background: selected 
    ? 'linear-gradient(135deg, #81c784 0%, #aed581 100%)'
    : 'rgba(255, 255, 255, 0.7)',
  color: selected ? 'white' : '#374151',
  border: selected ? 'none' : '1px solid rgba(129, 199, 132, 0.3)',
  backdropFilter: 'blur(8px)',
  boxShadow: selected 
    ? '0 4px 15px rgba(129, 199, 132, 0.4)'
    : '0 2px 8px rgba(0, 0, 0, 0.08)',
  '&:hover': {
    transform: 'translateY(-2px) scale(1.02)',
    boxShadow: selected 
      ? '0 8px 25px rgba(129, 199, 132, 0.5)'
      : '0 6px 20px rgba(129, 199, 132, 0.3)',
    background: selected
      ? 'linear-gradient(135deg, #81c784, #aed581)'
      : 'linear-gradient(135deg, rgba(129, 199, 132, 0.1), rgba(144, 202, 249, 0.1))',
  }
}));

const StoryCard = styled(Card)(({ theme }) => ({
  background: `
    linear-gradient(135deg, 
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 255, 255, 0.8) 100%
    )
  `,
  backdropFilter: 'blur(15px) saturate(120%)',
  WebkitBackdropFilter: 'blur(15px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '20px',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: `
    0 6px 20px rgba(0, 0, 0, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.04)
  `,
  '&:hover': {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: `
      0 20px 40px rgba(0, 0, 0, 0.12),
      0 8px 24px rgba(129, 199, 132, 0.25)
    `,
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #81c784, #aed581, #90caf9)',
    borderRadius: '20px 20px 0 0',
  }
}));

// 🎯 Interactive stats components
const StatsChip = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 12,
  backgroundColor: 'rgba(129, 199, 132, 0.1)',
  border: '1px solid rgba(129, 199, 132, 0.2)',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(129, 199, 132, 0.15)',
    transform: 'scale(1.05)'
  }
}));

// 🎯 FIXED: Mini Like Button - filter out isLiked prop to prevent React warning
const MiniLikeButton = styled(({ isLiked, ...other }) => <IconButton {...other} />)(({ theme, isLiked }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: '4px 8px',
  borderRadius: 12,
  backgroundColor: isLiked ? 'rgba(233, 30, 99, 0.1)' : 'rgba(129, 199, 132, 0.1)',
  border: `1px solid ${isLiked ? '#e91e63' : 'rgba(129, 199, 132, 0.3)'}`,
  minWidth: 'auto',
  height: 28,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: isLiked ? 'rgba(233, 30, 99, 0.2)' : 'rgba(233, 30, 99, 0.1)',
    transform: 'scale(1.05)'
  }
}));

function Browse() {
  // 🔧 FIXED: Use environment variable for API URL
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    search: '',
    sortBy: 'recent',
    page: 1,
    limit: 9
  });
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({});
  const [selectedStory, setSelectedStory] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [mounted, setMounted] = useState(false);

  const navigate = useNavigate();

  // Debounce search input with 300ms delay
  const debouncedSearch = useDebounce(searchInput, 300);

  const categories = [
    { value: 'all', label: 'All Stories', icon: Category, color: '#64748b' },
    { value: 'business', label: 'Business', icon: Business, color: '#81c784' },
    { value: 'personal', label: 'Personal Growth', icon: Psychology, color: '#90caf9' },
    { value: 'education', label: 'Education', icon: School, color: '#ffb74d' },
    { value: 'health', label: 'Health', icon: FitnessCenter, color: '#f8bbd9' },
    { value: 'relationships', label: 'Relationships', icon: FamilyRestroom, color: '#b39ddb' },
    { value: 'career', label: 'Career', icon: Business, color: '#ff8a65' },
    { value: 'technology', label: 'Technology', icon: Computer, color: '#81c784' },
    { value: 'creative', label: 'Creative', icon: Palette, color: '#90caf9' },
  ];

  // Update filters when debounced search changes
  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      const newFilters = { ...filters, search: debouncedSearch, page: 1 };
      setFilters(newFilters);
      fetchStories(newFilters);
    }
  }, [debouncedSearch, filters]);

  // Fetch stories
  const fetchStories = async (newFilters = filters) => {
    try {
      setLoading(true);
      setError('');
      
      const queryParams = new URLSearchParams();
      
      if (newFilters.category && newFilters.category !== 'all') {
        queryParams.append('category', newFilters.category);
      }
      
      if (newFilters.search && newFilters.search.trim()) {
        queryParams.append('search', newFilters.search.trim());
      }
      
      queryParams.append('sortBy', newFilters.sortBy);
      queryParams.append('page', newFilters.page.toString());
      queryParams.append('limit', newFilters.limit.toString());

      console.log('🔍 Fetching stories with params:', Object.fromEntries(queryParams));
      console.log('🔗 API Base URL:', API_URL);
      
      const response = await fetch(`${API_URL}/stories?${queryParams}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch stories');
      }

      setStories(data.stories || []);
      setPagination(data.pagination || {});
      
      console.log('✅ Fetched:', data.stories?.length || 0, 'stories - Page:', data.pagination?.currentPage);
      
    } catch (error) {
      console.error('❌ Error fetching stories:', error);
      setError(`Failed to load stories: ${error.message}`);
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
    setMounted(true);
  }, []);

  // 🎯 FIXED: Handle filter changes (separate logic for search vs other filters)
  const handleFilterChange = (key, value) => {
    if (key === 'search') {
      setSearchInput(value); // This will trigger debounced search
    } else {
      // For non-search filters, reset to page 1 except when changing page
      const newFilters = { 
        ...filters, 
        [key]: value, 
        page: key === 'page' ? value : 1  // 🎯 KEY FIX: Don't reset page when changing page
      };
      console.log('🔄 Filter change:', key, '=', value, '| New page:', newFilters.page);
      setFilters(newFilters);
      fetchStories(newFilters);
    }
  };

  // 🎯 NEW: Separate pagination handler for clarity
  const handlePageChange = (newPage) => {
    console.log('📄 Page change: from', filters.page, 'to', newPage);
    handleFilterChange('page', newPage);
  };

  const handleStoryClick = (story) => {
    const user = localStorage.getItem('ff_user') || localStorage.getItem('token');
    if (!user) {
      setSelectedStory(story);
      setOpenDialog(true);
    } else {
      navigate(`/story/${story._id}`);
    }
  };

  // Handle like toggle on Browse page
  const handleLikeToggle = async (storyId, currentIsLiked) => {
    const token = localStorage.getItem('token') || localStorage.getItem('ff_token');
    if (!token) {
      const story = stories.find(s => s._id === storyId);
      setSelectedStory(story);
      setOpenDialog(true);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/stories/${storyId}/like`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setStories(prevStories => 
          prevStories.map(story => 
            story._id === storyId 
              ? { 
                  ...story, 
                  stats: { ...story.stats, likes: data.likesCount },
                  isLiked: data.isLiked 
                }
              : story
          )
        );
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Like toggle error:', error);
    }
  };

  // Handle view increment when clicking "Read Story"
  const handleViewStory = async (storyId) => {
    // Navigate immediately
    navigate(`/story/${storyId}`);
    
    // Optimistically update view count in browse page
    setStories(prevStories => 
      prevStories.map(story => 
        story._id === storyId 
          ? { ...story, stats: { ...story.stats, views: (story.stats.views || 0) + 1 } }
          : story
      )
    );
  };

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
              variant="h2" 
              sx={{ 
                fontWeight: 800, 
                mb: 3,
                background: 'linear-gradient(135deg, #81c784 0%, #aed581 25%, #90caf9 50%, #f8bbd9 75%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Discover Stories
            </Typography>
            
            <Typography variant="h5" sx={{ 
              color: 'rgba(0, 0, 0, 0.6)', 
              mb: 4,
              fontWeight: 400,
              maxWidth: 600,
              mx: 'auto',
            }}>
              Explore inspiring transformation stories from people who turned their challenges into triumphs
            </Typography>
          </HeroCard>
        </Fade>

        {/* Search & Filter Section */}
        <Grow in={mounted} timeout={1000}>
          <SearchCard>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              mb: 4, 
              textAlign: 'center',
              color: '#81c784'
            }}>
              Find Your Inspiration
            </Typography>
            
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search by story title..."
                  value={searchInput}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: '#81c784', fontSize: '1.5rem' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(8px)',
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    label="Category"
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    sx={{ 
                      borderRadius: '16px', 
                      background: 'rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    {categories.map((category) => (
                      <MenuItem key={category.value} value={category.value}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <category.icon sx={{ fontSize: 20, color: category.color }} />
                          <Typography sx={{ fontWeight: 500 }}>
                            {category.label}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={filters.sortBy}
                    label="Sort By"
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    sx={{ 
                      borderRadius: '16px', 
                      background: 'rgba(255, 255, 255, 0.8)',
                    }}
                  >
                    <MenuItem value="recent">
                      <Box display="flex" alignItems="center" gap={2}>
                        <AccessTime sx={{ fontSize: 20 }} />
                        <Typography>Most Recent</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="popular">
                      <Box display="flex" alignItems="center" gap={2}>
                        <Favorite sx={{ fontSize: 20 }} />
                        <Typography>Most Liked</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="views">
                      <Box display="flex" alignItems="center" gap={2}>
                        <Visibility sx={{ fontSize: 20 }} />
                        <Typography>Most Viewed</Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Category Filter Chips */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ 
                fontWeight: 700, 
                mb: 3, 
                textAlign: 'center',
                color: 'text.primary' 
              }}>
                Browse by Category
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={2} justifyContent="center">
                {categories.map((category) => (
                  <CategoryChip
                    key={category.value}
                    label={category.label}
                    selected={filters.category === category.value}
                    onClick={() => handleFilterChange('category', category.value)}
                    icon={<category.icon sx={{ fontSize: '1.2rem' }} />}
                  />
                ))}
              </Box>
            </Box>
          </SearchCard>
        </Grow>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Box display="flex" justifyContent="center" my={8}>
            <CircularProgress size={60} sx={{ color: '#81c784' }} />
          </Box>
        )}

        {/* No Stories State */}
        {!loading && stories.length === 0 && !error && (
          <Paper sx={{ 
            p: 8, 
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.8)',
            borderRadius: '24px',
            mb: 4
          }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: '#81c784' }}>
              No Stories Found
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {filters.search || filters.category !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Be the first to share your story!'}
            </Typography>
            <ElegantButton
              variant="primary"
              onClick={() => navigate('/create-story')}
            >
              Share Your Story
            </ElegantButton>
          </Paper>
        )}

        {/* Stories Grid */}
        {!loading && stories.length > 0 && (
          <Grid container spacing={4}>
            {stories.map((story) => (
              <Grid item xs={12} md={6} lg={4} key={story._id}>
                <StoryCard>
                  <CardContent sx={{ flexGrow: 1, p: 4 }}>
                    <Box display="flex" alignItems="center" mb={2} justifyContent="space-between">
                      <Chip 
                        label={categories.find(cat => cat.value === story.category)?.label || story.category}
                        size="small"
                        sx={{ 
                          background: 'linear-gradient(135deg, #81c784, #aed581)', 
                          color: 'white',
                          fontWeight: 600
                        }}
                      />
                      
                      {/* Interactive Stats Display */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <StatsChip>
                          <Visibility sx={{ fontSize: 14, color: '#81c784' }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                            {story.stats?.views || 0}
                          </Typography>
                        </StatsChip>
                        
                        {/* Interactive Like Button */}
                        <MiniLikeButton
                          isLiked={story.isLiked}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLikeToggle(story._id, story.isLiked);
                          }}
                        >
                          {story.isLiked ? (
                            <Favorite sx={{ fontSize: 14, color: '#e91e63' }} />
                          ) : (
                            <FavoriteOutlined sx={{ fontSize: 14, color: '#666' }} />
                          )}
                          <Typography variant="caption" sx={{ 
                            fontWeight: 600, 
                            color: story.isLiked ? '#e91e63' : '#2e7d32',
                          }}>
                            {story.stats?.likes || 0}
                          </Typography>
                        </MiniLikeButton>
                        
                        <StatsChip>
                          <Comment sx={{ fontSize: 14, color: '#2196f3' }} />
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#2e7d32' }}>
                            {story.stats?.comments || 0}
                          </Typography>
                        </StatsChip>
                      </Box>
                    </Box>
                    
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700, 
                      mb: 2,
                      color: '#2e7d32',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {story.title}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ 
                      mb: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.6,
                    }}>
                      {story.excerpt || story.content?.substring(0, 150) + '...'}
                    </Typography>
                    
                    {story.tags?.length > 0 && (
                      <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                        {story.tags.slice(0, 3).map((tag, index) => (
                          <Chip 
                            key={index}
                            label={tag}
                            size="small"
                            variant="outlined"
                            sx={{ 
                              fontSize: '0.7rem',
                              borderColor: 'rgba(129, 199, 132, 0.3)',
                              color: '#81c784'
                            }}
                          />
                        ))}
                        {story.tags.length > 3 && (
                          <Typography variant="caption" color="text.secondary">
                            +{story.tags.length - 3} more
                          </Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ px: 4, pb: 4, pt: 0, justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {story.metadata?.readTime || 1} min read
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {new Date(story.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                    
                    {/* Read Story Button */}
                    <ElegantButton
                      variant="primary"
                      size="small"
                      startIcon={<OpenInNew />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewStory(story._id);
                      }}
                      sx={{ ml: 'auto' }}
                    >
                      Read Story
                    </ElegantButton>
                  </CardActions>
                </StoryCard>
              </Grid>
            ))}
          </Grid>
        )}

        {/* 🎯 FIXED: Working Pagination */}
        {pagination.totalPages > 1 && (
          <Box display="flex" justifyContent="center" mt={6}>
            <Stack direction="row" spacing={2} alignItems="center">
              <ElegantButton
                variant="outlined"
                disabled={!pagination.hasPrev || loading}
                onClick={() => handlePageChange(filters.page - 1)}
              >
                Previous
              </ElegantButton>
              
              <Box display="flex" alignItems="center" px={3}>
                <Typography variant="body2" fontWeight="600" color="text.primary">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  ({pagination.totalStories} total stories)
                </Typography>
              </Box>
              
              <ElegantButton
                variant="outlined"
                disabled={!pagination.hasNext || loading}
                onClick={() => handlePageChange(filters.page + 1)}
              >
                Next
              </ElegantButton>
            </Stack>
          </Box>
        )}

        {/* Login Prompt Dialog */}
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
            }
          }}
        >
          {selectedStory && (
            <>
              <DialogTitle sx={{ pb: 2 }}>
                <Box sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(90deg, #81c784, #aed581, #90caf9)',
                  borderRadius: '24px 24px 0 0',
                }} />
                <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ pt: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {selectedStory.title}
                  </Typography>
                  <IconButton onClick={() => setOpenDialog(false)}>
                    <Close />
                  </IconButton>
                </Box>
              </DialogTitle>
              
              <DialogContent sx={{ px: 4 }}>
                <Typography variant="body1" sx={{ lineHeight: 1.7, color: 'text.primary', mb: 4 }}>
                  {selectedStory.excerpt || selectedStory.content?.substring(0, 300) + '...'}
                </Typography>
                
                <Paper sx={{ 
                  p: 4, 
                  background: 'rgba(129, 199, 132, 0.05)',
                  border: '1px solid rgba(129, 199, 132, 0.2)',
                  borderRadius: '16px',
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#81c784' }}>
                    Continue Reading
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    Sign up for free to read the complete story and connect with our community of inspiring individuals.
                  </Typography>
                </Paper>
              </DialogContent>
              
              <DialogActions sx={{ p: 4, pt: 2 }}>
                <ElegantButton variant="outlined" onClick={() => navigate('/login')}>
                  Sign In
                </ElegantButton>
                <ElegantButton
                  variant="primary"
                  startIcon={<ArrowForward />}
                  onClick={() => navigate('/register')}
                >
                  Join Free
                </ElegantButton>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Container>
    </BackgroundContainer>
  );
}

export default Browse;
