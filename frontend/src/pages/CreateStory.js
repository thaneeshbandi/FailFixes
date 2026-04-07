/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Box,
  Chip,
  Paper,
  Alert,
  CircularProgress,
  Fade,
  Grow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Divider,
  IconButton,
  LinearProgress,
  Skeleton,
  Avatar,
  Stack,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Create,
  Save,
  Preview,
  Close,
  Add,
  AutoFixHigh,
  Psychology,
  TipsAndUpdates,
  ArrowBack,
  Edit,
  CheckCircle,
  Lightbulb,
  Timeline,
  EmojiEvents,
  Business,
  FitnessCenter,
  FamilyRestroom,
  Computer,
  Palette,
  RocketLaunch,
  School,
  Category,
  AccessTime,
  TrendingUp
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

/* ───────────────────────────
   ANIMATION KEYFRAMES
─────────────────────────── */
const gentleFloat = keyframes`
  0%,100% { transform: translateY(0) rotate(0deg); }
  50%     { transform: translateY(-8px) rotate(1deg); }
`;
const softGlow = keyframes`
  0%,100% { box-shadow: 0 0 15px rgba(129,199,132,.2), 0 0 30px rgba(129,199,132,.1); }
  50%     { box-shadow: 0 0 25px rgba(129,199,132,.3), 0 0 40px rgba(129,199,132,.15); }
`;
const subtleShimmer = keyframes`
  0% {background-position:-200px 0;} 100% {background-position:200px 0;}
`;
const softParticle = keyframes`
  0%,100% { transform: translate(0,0); opacity:.2; }
  50%     { transform: translate(8px,-15px); opacity:.4; }
`;

/* ───────────────────────────
   STYLED COMPONENTS
─────────────────────────── */
const BackgroundContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: `
    radial-gradient(circle at 20% 20%, rgba(174,213,129,.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(255,183,195,.15) 0%, transparent 50%),
    radial-gradient(circle at 40% 60%, rgba(179,229,252,.15) 0%, transparent 50%),
    linear-gradient(135deg,#f8f9ff 0%,#f0f4ff 25%,#fef7f0 50%,#f0fff4 75%,#f5f8ff 100%)
  `,
  position: 'relative',
  overflow: 'hidden',
  paddingTop: theme.spacing(4),
  paddingBottom: theme.spacing(8),
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60'
      xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E
      %3Cg fill='%23e8f5e8' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E
      %3C/g%3E%3C/g%3E%3C/svg%3E")`,
    pointerEvents: 'none'
  }
}));

const FloatingParticle = styled(Box)(({ delay, size, left, top }) => ({
  position: 'absolute',
  left : `${left}%`,
  top  : `${top}%`,
  width: `${size}px`,
  height: `${size}px`,
  borderRadius: '50%',
  background: 'linear-gradient(135deg,rgba(174,213,129,.2),rgba(179,229,252,.15))',
  animation: `${softParticle} ${4 + Math.random() * 3}s ease-in-out infinite`,
  animationDelay: `${delay}s`,
  backdropFilter: 'blur(1px)',
  border: '1px solid rgba(174,213,129,.1)'
}));

const ElegantCard = styled(Card)(() => ({
  background: `linear-gradient(135deg,rgba(255,255,255,.85)0%,rgba(255,255,255,.75)50%,rgba(255,255,255,.65)100%)`,
  backdropFilter: 'blur(20px) saturate(120%)',
  border: '1px solid rgba(255,255,255,.3)',
  borderRadius: '24px',
  overflow: 'hidden',
  position: 'relative',
  boxShadow: `0 8px 32px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.04),inset 0 1px 0 rgba(255,255,255,.6)`,
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    left: '-100%',
    background: `linear-gradient(90deg,transparent,rgba(129,199,132,.1),transparent)`,
    animation: `${subtleShimmer} 6s ease-in-out infinite`
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg,#81c784,#aed581,#90caf9,#f8bbd9)',
    borderRadius: '24px 24px 0 0'
  }
}));

const EnhancedTextField = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .MuiOutlinedInput-root': {
    borderRadius: 16,
    background: 'rgba(255,255,255,.8)',
    backdropFilter: 'blur(8px)',
    fontSize: '1rem',
    fontWeight: 500,
    transition: 'all .3s ease',
    '&:hover': {
      background: 'rgba(255,255,255,.9)',
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(0,0,0,.08)',
      borderColor: 'rgba(129,199,132,.3)'
    },
    '&.Mui-focused': {
      background: 'rgba(255,255,255,.95)',
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 20px rgba(129,199,132,.15)',
      borderColor: '#81c784'
    }
  },
  '& .MuiInputLabel-root': {
    fontWeight: 500,
    '&.Mui-focused': { color: '#81c784' }
  }
}));

const ElegantButton = styled(Button)(({ variant: buttonVariant }) => ({
  borderRadius: 16,
  padding: '14px 32px',
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  minHeight: 50,
  transition: 'all .3s ease',
  ...(buttonVariant === 'primary' && {
    background: 'linear-gradient(135deg,#81c784 0%,#aed581 50%,#90caf9 100%)',
    backgroundSize: '150% 150%',
    color: '#fff',
    boxShadow: '0 4px 15px rgba(129,199,132,.3)',
    '&:hover': {
      backgroundPosition: 'right center',
      transform: 'translateY(-2px) scale(1.01)',
      boxShadow: '0 8px 25px rgba(129,199,132,.4)'
    }
  }),
  ...(buttonVariant === 'outlined' && {
    border: '2px solid #81c784',
    color: '#81c784',
    background: 'rgba(255,255,255,.1)',
    backdropFilter: 'blur(8px)',
    '&:hover': {
      background: 'linear-gradient(135deg,rgba(129,199,132,.1),rgba(144,202,249,.1))',
      transform: 'translateY(-1px) scale(1.01)',
      boxShadow: '0 6px 20px rgba(129,199,132,.2)'
    }
  })
}));

const CategoryChip = styled(Chip)(({ selected }) => ({
  borderRadius: 16,
  padding: '16px 12px',
  fontSize: '.9rem',
  fontWeight: 600,
  minHeight: 70,
  cursor: 'pointer',
  transition: 'all .3s ease',
  background: selected
    ? 'linear-gradient(135deg,#81c784 0%,#aed581 100%)'
    : 'rgba(255,255,255,.7)',
  color: selected ? '#fff' : '#374151',
  border: selected ? 'none' : '1px solid rgba(129,199,132,.3)',
  backdropFilter: 'blur(8px)',
  boxShadow: selected
    ? '0 4px 15px rgba(129,199,132,.4)'
    : '0 2px 8px rgba(0,0,0,.08)',
  '&:hover': {
    transform: 'translateY(-3px) scale(1.02)',
    boxShadow: selected
      ? '0 8px 25px rgba(129,199,132,.5)'
      : '0 6px 20px rgba(129,199,132,.3)'
  }
}));

const ProgressCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: 20,
  background: 'rgba(255,255,255,.8)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,.3)',
  boxShadow: '0 6px 20px rgba(0,0,0,.08)',
  position: 'sticky',
  top: 100
}));

const RequiredSelect = styled(FormControl)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .MuiOutlinedInput-root': {
    borderRadius: 16,
    background: 'rgba(255,255,255,.8)',
    backdropFilter: 'blur(8px)',
    '&:hover': {
      background: 'rgba(255,255,255,.9)',
    },
    '&.Mui-focused': {
      background: 'rgba(255,255,255,.95)',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#81c784',
      }
    }
  }
}));

function CreateStory() {
  const [storyData, setStoryData] = useState({
    title: '',
    content: '',
    category: '',
    tags: [],
    metadata: {
      recoveryTime: '',
      currentStatus: '',
      keyLessons: ['']
    }
  });
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [mounted, setMounted] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);

  // AI states
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiInput, setAIInput] = useState('');
  const [aiLoading, setAILoading] = useState(false);

  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const categories = [
    { value: 'business',      label: 'Business & Startup',   icon: Business,      color: '#81c784' },
    { value: 'personal',      label: 'Personal Growth',      icon: Psychology,    color: '#90caf9' },
    { value: 'education',     label: 'Education & Learning', icon: School,        color: '#ffb74d' },
    { value: 'health',        label: 'Health & Wellness',    icon: FitnessCenter, color: '#f8bbd9' },
    { value: 'relationships', label: 'Relationships',        icon: FamilyRestroom,color: '#b39ddb' },
    { value: 'career',        label: 'Career & Work',        icon: Business,      color: '#81c784' },
    { value: 'technology',    label: 'Technology',           icon: Computer,      color: '#90caf9' },
    { value: 'creative',      label: 'Creative Arts',        icon: Palette,       color: '#ffb74d' }
  ];
  const recoveryTimeOptions = [
    '1 month', '3 months', '6 months', '1 year', '2 years', '3+ years'
  ];
  const currentStatusOptions = [
    'recovering', 'recovered', 'thriving', 'helping_others'
  ];

  const calculateProgress = () => {
    const parts = [
      storyData.title.length >= 10,
      storyData.content.length >= 100,
      !!storyData.category,
      storyData.tags.length > 0,
      !!storyData.metadata.recoveryTime,
      !!storyData.metadata.currentStatus
    ];
    setProgress((parts.filter(Boolean).length / 6) * 100);
  };

  const updateWordCount = () => {
    const words = storyData.content.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
    setReadTime(Math.max(1, Math.ceil(words / 200)));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setInitialLoading(false);
      setMounted(true);
    }, 1500);
    calculateProgress();
    updateWordCount();
    return () => clearTimeout(t);
  }, [storyData]);

  const handleInputChange = (field, value) => setStoryData(p => ({ ...p, [field]: value }));
  const handleMetadataChange = (field, value) =>
    setStoryData(p => ({ ...p, metadata: { ...p.metadata, [field]: value } }));

  const addTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !storyData.tags.includes(tag) && storyData.tags.length < 5) {
      setStoryData(p => ({ ...p, tags: [...p.tags, tag] }));
      setNewTag('');
    }
  };

  const removeTag = (t) => setStoryData(p => ({ ...p, tags: p.tags.filter(tag => tag !== t) }));

  const addKeyLesson = () => {
    if (storyData.metadata.keyLessons.length < 5) {
      handleMetadataChange('keyLessons', [...storyData.metadata.keyLessons, '']);
    }
  };
  const updateKeyLesson = (idx, val) => {
    const list = [...storyData.metadata.keyLessons];
    list[idx] = val;
    handleMetadataChange('keyLessons', list);
  };
  const removeKeyLesson = (idx) =>
    handleMetadataChange('keyLessons', storyData.metadata.keyLessons.filter((_, i) => i !== idx));

  const validateForm = () => {
    if (storyData.title.length < 10)  { warn('Title needs at least 10 characters');  return false; }
    if (storyData.content.length < 100){ warn('Story needs at least 100 characters'); return false; }
    if (!storyData.category)           { warn('Please select a category');           return false; }
    if (!storyData.metadata.recoveryTime)    { warn('Recovery time is required');    return false; }
    if (!storyData.metadata.currentStatus)   { warn('Current status is required');   return false; }
    return true;
    function warn(msg){ setSnackbar({open:true,message:msg,severity:'warning'}); }
  };

  const handleSubmit = async (asDraft = false) => {
    if (!validateForm() && !asDraft) return;
    setLoading(true);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('ff_token');
      if (!token) throw new Error('loginRequired');
      const m = storyData.metadata;
      const cleanMeta = {};
      cleanMeta.recoveryTime  = m.recoveryTime.trim();
      cleanMeta.currentStatus = m.currentStatus.trim();
      const lessons = m.keyLessons.filter(l => l && l.trim());
      if (lessons.length) cleanMeta.keyLessons = lessons;
      if (readTime) cleanMeta.readTime = readTime;

      const payload = {
        title   : storyData.title.trim(),
        content : storyData.content.trim(),
        category: storyData.category,
        tags    : storyData.tags.slice(0, 5),
        metadata: cleanMeta,
        status  : asDraft ? 'draft' : 'published'
      };

      const res = await fetch(`${process.env.REACT_APP_API_URL}/stories`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body   : JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || 'Failed to save');
        err.status  = res.status;
        err.details = data.errors || [];
        throw err;
      }

      setSnackbar({
        open    : true,
        message : data.message || (asDraft ? 'Story saved as draft!' : 'Story published successfully!'),
        severity: 'success'
      });

      resetForm();

      setTimeout(() => {
        navigate('/dashboard', {
          replace: true,
          state: { refresh: true }
        });
      }, 2000);

    } catch (err) {
      console.error('save error →', err);
      let msg = 'Failed to save story. Please try again.';

      if (err.message === 'loginRequired') {
        msg = 'Please login to create a story';
        setTimeout(() => navigate('/login'), 1500);
      } else if (err.status === 400 && err.details.length) {
        msg = err.details.map(e => `${e.field}: ${e.message}`).join(' • ');
      } else if (err.message.toLowerCase().includes('network')) {
        msg = 'Network error. Please check your connection.';
      }
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setStoryData({
    title:'', content:'', category:'', tags:[],
    metadata:{ recoveryTime:'', currentStatus:'', keyLessons:[''] }
  });

  // AI story handlers
  const handleGenerateAI = async () => {
    if (!aiInput.trim()) {
      setSnackbar({ open: true, message: "Please provide a topic or idea for AI", severity: "warning" });
      return;
    }
    setAILoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/ai/generate-story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiInput })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "AI generation failed");
      }
      setStoryData(story => ({
        ...story,
        title: data.title || "",
        content: data.content || ""
      }));
      setShowAIDialog(false);
      setSnackbar({ open: true, message: "AI story generated!", severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message || "Failed to generate story.", severity: 'error' });
    }
    setAILoading(false);
  };

  if (initialLoading) {
    return (
      <BackgroundContainer>
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <ElegantCard sx={{ p: 8, textAlign: 'center' }}>
            <Skeleton variant="text" width="60%" height={80} sx={{ mx:'auto', mb:4 }} />
            <Skeleton variant="rectangular" width="100%" height={400} sx={{ borderRadius:4 }} />
          </ElegantCard>
        </Container>
      </BackgroundContainer>
    );
  }

  return (
    <BackgroundContainer>
      {[...Array(6)].map((_, i) => (
        <FloatingParticle
          key={i}
          delay={i*0.5}
          size={Math.random()*25+10}
          left={Math.random()*100}
          top={Math.random()*100}
        />
      ))}
      <Container maxWidth="lg">
        <Fade in={mounted} timeout={800}>
          <Box textAlign="center" mb={8}>
            <Avatar
              sx={{
                width:80, height:80,
                background:'linear-gradient(135deg,#81c784,#aed581)',
                m:'0 auto 24px',
                animation:`${gentleFloat} 4s ease-in-out infinite, ${softGlow} 3s ease-in-out infinite alternate`
              }}
            >
              <Create sx={{ fontSize:'2.5rem' }} />
            </Avatar>
            <Typography
              variant="h2"
              sx={{
                fontWeight:800, mb:2,
                background:'linear-gradient(135deg,#81c784 0%,#aed581 25%,#90caf9 50%,#f8bbd9 75%)',
                backgroundClip:'text',
                WebkitBackgroundClip:'text',
                WebkitTextFillColor:'transparent'
              }}
            >
              Share Your Story
            </Typography>
            <Typography variant="h5" sx={{ color:'rgba(0,0,0,.6)', mb:6, fontWeight:400 }}>
              Transform your experience into inspiration for others
            </Typography>
            <Stack direction="row" spacing={3} justifyContent="center">
              <ElegantButton variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate(-1)}>
                Go Back
              </ElegantButton>
              <ElegantButton
                variant="outlined"
                startIcon={<Preview />}
                onClick={() => setShowPreview(true)}
                disabled={!storyData.title || !storyData.content}
              >
                Preview
              </ElegantButton>
              <ElegantButton
                variant="primary"
                startIcon={<Psychology />}
                sx={{ mb: 0 }}
                onClick={() => setShowAIDialog(true)}
              >
                Create With AI
              </ElegantButton>
            </Stack>
          </Box>
        </Fade>

        <Grid container spacing={6}>
          {/* form column */}
          <Grid item xs={12} lg={8}>
            <Grow in={mounted} timeout={1000}>
              <ElegantCard>
                <CardContent sx={{ p:6 }}>
                  {/* title */}
                  <Box mb={6}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar sx={{ width:50, height:50, background:'linear-gradient(135deg,#81c784,#aed581)', mr:2 }}>
                        <AutoFixHigh />
                      </Avatar>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight:700, mb:.5 }}>
                          Story Title
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Create an engaging title for your story
                        </Typography>
                      </Box>
                    </Box>
                    <EnhancedTextField
                      fullWidth
                      label="Your story title"
                      placeholder="e.g., How I Turned My Greatest Failure Into Success"
                      value={storyData.title}
                      onChange={(e)=>handleInputChange('title',e.target.value)}
                      helperText={`${storyData.title.length}/200 characters`}
                      error={storyData.title.length>200}
                    />
                  </Box>

                  {/* category */}
                  <Box mb={6}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar sx={{ width:50, height:50, background:'linear-gradient(135deg,#90caf9,#81c784)', mr:2 }}>
                        <Category />
                      </Avatar>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight:700, mb:.5 }}>
                          Category
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Choose the category that best fits your story
                        </Typography>
                      </Box>
                    </Box>

                    <Grid container spacing={3}>
                      {categories.map((c)=>(
                        <Grid item xs={12} sm={6} md={4} key={c.value}>
                          <CategoryChip
                            label={
                              <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1.5, py:1 }}>
                                <c.icon sx={{ fontSize:'2rem', color: storyData.category===c.value?'#fff':c.color }} />
                                <Typography variant="body2" sx={{ fontWeight:600, textAlign:'center', fontSize:'.875rem', lineHeight:1.2 }}>
                                  {c.label}
                                </Typography>
                              </Box>
                            }
                            selected={storyData.category===c.value}
                            onClick={()=>handleInputChange('category',c.value)}
                            sx={{ width:'100%', justifyContent:'center' }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>

                  {/* content */}
                  <Box mb={6}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar sx={{ width:50, height:50, background:'linear-gradient(135deg,#f8bbd9,#ffb74d)', mr:2 }}>
                        <Edit />
                      </Avatar>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight:700, mb:.5 }}>
                          Your Story
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Share your authentic journey
                        </Typography>
                      </Box>
                    </Box>

                    <EnhancedTextField
                      fullWidth
                      multiline
                      rows={12}
                      label="Tell your story"
                      placeholder={`Share your transformation journey:

• What was your challenge or setback?
• How did it impact you?
• What steps did you take to overcome it?
• What did you learn from the experience?
• How are you different now?

Your authentic story can inspire and help others facing similar challenges.`}
                      value={storyData.content}
                      onChange={(e)=>handleInputChange('content',e.target.value)}
                      helperText={`${wordCount} words • ${readTime} min read`}
                    />
                  </Box>

                  {/* tags */}
                  <Box mb={6}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <Avatar sx={{ width:50, height:50, background:'linear-gradient(135deg,#ffb74d,#81c784)', mr:2 }}>
                        <TipsAndUpdates />
                      </Avatar>
                      <Box>
                        <Typography variant="h5" sx={{ fontWeight:700, mb:.5 }}>
                          Tags
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Add tags to help others find your story (max 5)
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display:'flex', flexWrap:'wrap', gap:2, mb:3, p:3,
                        background:'rgba(255,255,255,.6)',
                        borderRadius:'16px',
                        border:'1px solid rgba(129,199,132,.2)',
                        minHeight:60
                      }}
                    >
                      {storyData.tags.map((tag,i)=>(
                        <Chip
                          key={i}
                          label={tag}
                          onDelete={()=>removeTag(tag)}
                          deleteIcon={<Close />}
                          sx={{
                            background:'linear-gradient(135deg,#81c784,#aed581)',
                            color:'#fff',
                            fontWeight:600,
                            '&:hover':{ background:'linear-gradient(135deg,#66bb6a,#81c784)' }
                          }}
                        />
                      ))}

                      <Box display="flex" alignItems="center" gap={2} flexGrow={1}>
                        <TextField
                          placeholder={storyData.tags.length<5?'Add a tag...':'Maximum 5 tags'}
                          value={newTag}
                          onChange={(e)=>setNewTag(e.target.value)}
                          onKeyPress={(e)=>e.key==='Enter'&&addTag()}
                          disabled={storyData.tags.length>=5}
                          variant="standard"
                          sx={{
                            flexGrow:1,
                            '& .MuiInput-underline:before':{ display:'none' },
                            '& .MuiInput-underline:after' :{ display:'none' }
                          }}
                        />
                        <IconButton onClick={addTag} disabled={!newTag.trim()||storyData.tags.length>=5} sx={{ color:'#81c784' }}>
                          <Add />
                        </IconButton>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle:'italic' }}>
                      Example: resilience, entrepreneurship, mental-health, career-change
                    </Typography>
                  </Box>

                  {/* Recovery Details */}
                  <Divider sx={{ mb:4 }} />
                  <Box display="flex" alignItems="center" mb={3}>
                    <Avatar sx={{ width:50, height:50, background:'linear-gradient(135deg,#e91e63,#f06292)', mr:2 }}>
                      <AccessTime />
                    </Avatar>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight:700, mb:.5 }}>
                        Recovery Details
                        <Chip label="Required" size="small" color="error" sx={{ ml:2, fontWeight:600 }} />
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Help others understand your journey timeline and current progress
                      </Typography>
                    </Box>
                  </Box>
                  <Grid container spacing={3} mb={6}>
                    <Grid item xs={12} sm={6}>
                      <RequiredSelect fullWidth>
                        <InputLabel>Recovery Time *</InputLabel>
                        <Select
                          value={storyData.metadata.recoveryTime}
                          onChange={(e)=>handleMetadataChange('recoveryTime',e.target.value)}
                          label="Recovery Time *"
                          required
                        >
                          {recoveryTimeOptions.map(time=>(
                            <MenuItem key={time} value={time}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <AccessTime sx={{ fontSize:18, color:'#81c784' }} />
                                {time}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </RequiredSelect>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <RequiredSelect fullWidth>
                        <InputLabel>Current Status *</InputLabel>
                        <Select
                          value={storyData.metadata.currentStatus}
                          onChange={(e)=>handleMetadataChange('currentStatus',e.target.value)}
                          label="Current Status *"
                          required
                        >
                          {currentStatusOptions.map(status=>(
                            <MenuItem key={status} value={status}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <TrendingUp sx={{ fontSize:18, color:'#81c784' }} />
                                {status.replace('_',' ').toUpperCase()}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </RequiredSelect>
                    </Grid>
                  </Grid>

                  {/* Key Lessons (optional) */}
                  <Divider sx={{ mb:4 }} />
                  <Box mb={6}>
                    <Typography variant="h6" sx={{ fontWeight:700, mb:2 }}>
                      Key Lessons (Optional - Max 5)
                    </Typography>
                    {storyData.metadata.keyLessons.map((lesson, idx)=>(
                      <Box key={idx} display="flex" alignItems="center" gap={2} mb={2}>
                        <EnhancedTextField
                          fullWidth
                          placeholder={`Lesson ${idx+1}`}
                          value={lesson}
                          onChange={(e)=>updateKeyLesson(idx,e.target.value)}
                        />
                        <IconButton onClick={()=>removeKeyLesson(idx)}>
                          <Close />
                        </IconButton>
                      </Box>
                    ))}
                    {storyData.metadata.keyLessons.length<5 && (
                      <ElegantButton variant="outlined" startIcon={<Add />} onClick={addKeyLesson}>
                        Add Lesson
                      </ElegantButton>
                    )}
                  </Box>

                  {/* actions */}
                  <Divider sx={{ mb:4 }} />
                  <Stack direction="row" spacing={3} justifyContent="center">
                    <ElegantButton
                      variant="outlined"
                      startIcon={<Save />}
                      onClick={()=>handleSubmit(true)}
                      disabled={loading}
                    >
                      Save as Draft
                    </ElegantButton>

                    <ElegantButton
                      variant="primary"
                      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <EmojiEvents />}
                      onClick={()=>handleSubmit(false)}
                      disabled={loading || progress < 85}
                    >
                      {loading ? 'Publishing...' : 'Publish Story'}
                    </ElegantButton>
                  </Stack>
                </CardContent>
              </ElegantCard>
            </Grow>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} lg={4}>
            <Grow in={mounted} timeout={1200}>
              <Box>
                {/* Progress card */}
                <ProgressCard sx={{ mb:4 }}>
                  <Box display="flex" alignItems="center" mb={3}>
                    <Avatar sx={{ width:40, height:40, background:'linear-gradient(135deg,#81c784,#aed581)', mr:2 }}>
                      <Timeline />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight:700 }}>
                      Progress
                    </Typography>
                  </Box>

                  <Box sx={{ mb:3 }}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" fontWeight="600">Completion</Typography>
                      <Typography variant="body2" fontWeight="700" sx={{ color:'#81c784' }}>
                        {progress.toFixed(0)}%
                      </Typography>
                    </Box>

                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height:8, borderRadius:4,
                        background:'rgba(129,199,132,.2)',
                        '& .MuiLinearProgress-bar':{
                          background:'linear-gradient(90deg,#81c784,#aed581)',
                          borderRadius:4
                        }
                      }}
                    />
                  </Box>
                  <Stack spacing={2}>
                    <Box display="flex" alignItems="center">
                      <CheckCircle sx={{ fontSize:20, mr:2, color:storyData.title.length>=10?'#81c784':'#e0e0e0' }} />
                      <Typography variant="body2" fontWeight="500">Title (10+ characters)</Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <CheckCircle sx={{ fontSize:20, mr:2, color:storyData.content.length>=100?'#81c784':'#e0e0e0' }} />
                      <Typography variant="body2" fontWeight="500">Story content (100+ characters)</Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <CheckCircle sx={{ fontSize:20, mr:2, color:storyData.category?'#81c784':'#e0e0e0' }} />
                      <Typography variant="body2" fontWeight="500">Category selected</Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <CheckCircle sx={{ fontSize:20, mr:2, color:storyData.tags.length>0?'#81c784':'#e0e0e0' }} />
                      <Typography variant="body2" fontWeight="500">Tags added</Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <CheckCircle sx={{ fontSize:20, mr:2, color:storyData.metadata.recoveryTime?'#81c784':'#e0e0e0' }} />
                      <Typography variant="body2" fontWeight="500">Recovery time selected *</Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      <CheckCircle sx={{ fontSize:20, mr:2, color:storyData.metadata.currentStatus?'#81c784':'#e0e0e0' }} />
                      <Typography variant="body2" fontWeight="500">Current status selected *</Typography>
                    </Box>
                  </Stack>
                </ProgressCard>
                {/* Tips card */}
                <ProgressCard>
                  <Box display="flex" alignItems="center" mb={3}>
                    <Avatar sx={{ width:40, height:40, background:'linear-gradient(135deg,#90caf9,#81c784)', mr:2 }}>
                      <Lightbulb />
                    </Avatar>
                    <Typography variant="h6" sx={{ fontWeight:700 }}>
                      Writing Tips
                    </Typography>
                  </Box>

                  <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">• Start with your challenge or setback</Typography>
                    <Typography variant="body2" color="text.secondary">• Share your emotions and feelings</Typography>
                    <Typography variant="body2" color="text.secondary">• Describe your journey to overcome it</Typography>
                    <Typography variant="body2" color="text.secondary">• Share the lessons you learned</Typography>
                    <Typography variant="body2" color="text.secondary">• Include your recovery timeline</Typography>
                    <Typography variant="body2" color="text.secondary">• End with hope and encouragement</Typography>
                  </Stack>
                </ProgressCard>
              </Box>
            </Grow>
          </Grid>
        </Grid>

        {/* Preview dialog */}
        <Dialog
          open={showPreview}
          onClose={()=>setShowPreview(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx:{
              borderRadius:'24px',
              background:'rgba(255,255,255,.95)',
              backdropFilter:'blur(20px)'
            }
          }}
        >
          <DialogTitle>
            <Typography variant="h5" sx={{ fontWeight:700 }}>Story Preview</Typography>
          </DialogTitle>

          <DialogContent>
            {storyData.category && (
              <Chip
                label={categories.find(c=>c.value===storyData.category)?.label}
                sx={{ mb:2, background:'#81c784', color:'#fff' }}
              />
            )}

            <Typography variant="h4" sx={{ fontWeight:700, mb:2 }}>
              {storyData.title || 'Your Story Title'}
            </Typography>

            {(storyData.metadata.recoveryTime || storyData.metadata.currentStatus) && (
              <Box sx={{ mb:3, p:2, background:'rgba(129,199,132,.1)', borderRadius:2 }}>
                {storyData.metadata.recoveryTime && (
                  <Chip
                    icon={<AccessTime />}
                    label={`Recovery: ${storyData.metadata.recoveryTime}`}
                    size="small"
                    sx={{ mr:1, mb:1 }}
                  />
                )}
                {storyData.metadata.currentStatus && (
                  <Chip
                    icon={<TrendingUp />}
                    label={`Status: ${storyData.metadata.currentStatus.replace('_',' ')}`}
                    size="small"
                    sx={{ mr:1, mb:1 }}
                  />
                )}
              </Box>
            )}

            <Typography variant="body1" sx={{ whiteSpace:'pre-line', lineHeight:1.7, mb:3 }}>
              {storyData.content || 'Your story content will appear here...'}
            </Typography>

            {storyData.tags.length>0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb:1, fontWeight:600 }}>Tags:</Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {storyData.tags.map((t,i)=>(
                    <Chip key={i} label={t} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ p:3 }}>
            <ElegantButton variant="outlined" onClick={()=>setShowPreview(false)}>
              Continue Editing
            </ElegantButton>
            <ElegantButton
              variant="primary"
              startIcon={<RocketLaunch />}
              onClick={()=>{ setShowPreview(false); handleSubmit(false);} }
              disabled={loading || progress<85}
            >
              Publish Story
            </ElegantButton>
          </DialogActions>
        </Dialog>

        {/* 🧠 AI STORY DIALOG */}
        <Dialog open={showAIDialog} onClose={() => setShowAIDialog(false)}>
          <DialogTitle>
            <Psychology sx={{ mr:1, color: "#81c784" }} /> Create Story With AI
          </DialogTitle>
          <DialogContent>
            <Typography gutterBottom>
              Describe the topic, challenge, or idea you want the AI to expand into a story.
            </Typography>
            <TextField
              fullWidth autoFocus multiline minRows={3}
              label="Story prompt / key points"
              placeholder="e.g., Overcoming failure in college..."
              value={aiInput}
              onChange={e => setAIInput(e.target.value)}
              sx={{ my:2 }}
            />
            {aiLoading && (
              <Box display="flex" alignItems="center" gap={2} mt={2}>
                <CircularProgress size={20} />
                <Typography fontWeight={600}>Generating your story with AI...</Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <ElegantButton variant="outlined" onClick={() => setShowAIDialog(false)}>
              Cancel
            </ElegantButton>
            <ElegantButton
              variant="primary"
              startIcon={<RocketLaunch />}
              disabled={aiLoading}
              onClick={handleGenerateAI}
            >
              Generate
            </ElegantButton>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={()=>setSnackbar(s=>({ ...s, open:false }))}
          anchorOrigin={{ vertical:'bottom', horizontal:'center' }}
        >
          <Alert
            onClose={()=>setSnackbar(s=>({ ...s, open:false }))}
            severity={snackbar.severity}
            sx={{ borderRadius:3, fontWeight:600 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </BackgroundContainer>
  );
}

export default CreateStory;
