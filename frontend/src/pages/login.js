import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Container,
  Fade,
  Slide,
  Chip,
  Stack,
  Avatar,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  AutoFixHigh,
  TrendingUp,
  Psychology,
  EmojiObjects,
  GroupWork,
  Star,
  ArrowForward
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


// Soft Animations
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
    box-shadow: 0 0 15px rgba(139, 195, 74, 0.2), 0 0 30px rgba(139, 195, 74, 0.1); 
  }
  50% { 
    box-shadow: 0 0 25px rgba(139, 195, 74, 0.3), 0 0 40px rgba(139, 195, 74, 0.15); 
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


// Enhanced Styled Components with Larger Sizes
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


const EnhancedGlassCard = styled(Paper)(({ theme }) => ({
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
  padding: theme.spacing(6, 5),
  position: 'relative',
  overflow: 'hidden',
  boxShadow: `
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6)
  `,
  maxWidth: '580px',
  width: '100%',
  margin: '0 auto',
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
        rgba(174, 213, 129, 0.1), 
        transparent
      )
    `,
    animation: `${subtleShimmer} 4s ease-in-out infinite`,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #aed581, #b3e5fc, #ffb3ba, #c8e6c9)',
  }
}));


const BrandLogo = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  marginBottom: theme.spacing(4),
  position: 'relative'
}));


const LogoIcon = styled(AutoFixHigh)(({ theme }) => ({
  fontSize: '4rem',
  background: 'linear-gradient(135deg, #81c784, #aed581, #90caf9)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  animation: `${gentleFloat} 4s ease-in-out infinite, ${softGlow} 3s ease-in-out infinite alternate`,
  filter: 'drop-shadow(0 4px 8px rgba(129, 199, 132, 0.2))',
  marginBottom: theme.spacing(2)
}));


const BrandTitle = styled(Typography)(({ theme }) => ({
  fontSize: '3.2rem',
  fontWeight: 800,
  background: 'linear-gradient(135deg, #81c784 0%, #aed581 25%, #90caf9 50%, #f8bbd9 75%, #b3e5fc 100%)',
  backgroundSize: '200% 200%',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  marginBottom: theme.spacing(1.5),
  letterSpacing: '-0.02em',
  [theme.breakpoints.down('sm')]: {
    fontSize: '2.5rem'
  }
}));


const FeatureShowcase = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(4)
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


const EnhancedTextField = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .MuiOutlinedInput-root': {
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(8px)',
    fontSize: '1.1rem',
    fontWeight: 500,
    minHeight: '60px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: '1.5px solid transparent',
    '& input': {
      padding: '18px 16px',
    },
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.9)',
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      borderColor: 'rgba(129, 199, 132, 0.3)'
    },
    '&.Mui-focused': {
      background: 'rgba(255, 255, 255, 0.95)',
      transform: 'translateY(-1px)',
      boxShadow: '0 6px 20px rgba(129, 199, 132, 0.15)',
      borderColor: '#81c784',
      '& fieldset': {
        borderWidth: '2px'
      }
    },
    '& input:-webkit-autofill': {
      WebkitBoxShadow: '0 0 0 1000px rgba(255, 255, 255, 0.9) inset !important',
      WebkitTextFillColor: 'inherit !important',
      borderRadius: '16px !important'
    }
  },
  '& .MuiInputLabel-root': {
    fontWeight: 500,
    fontSize: '1rem',
    '&.Mui-focused': {
      color: '#81c784'
    }
  }
}));


const EnhancedButton = styled(Button)(({ theme, variant: buttonVariant }) => ({
  borderRadius: '16px',
  padding: '16px 40px',
  fontSize: '1.1rem',
  fontWeight: 600,
  textTransform: 'none',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '56px',
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
    },
    '&:active': {
      transform: 'translateY(0px) scale(0.98)'
    }
  }),
  ...(buttonVariant === 'outlined' && {
    border: '2px solid',
    borderImage: 'linear-gradient(135deg, #81c784, #aed581, #90caf9) 1',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    color: theme.palette.text.primary,
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(129, 199, 132, 0.1), rgba(144, 202, 249, 0.1))',
      transform: 'translateY(-1px) scale(1.01)',
      boxShadow: '0 6px 20px rgba(129, 199, 132, 0.2)'
    }
  }),
  '&:disabled': {
    opacity: 0.6,
    transform: 'none'
  }
}));


const StatsDisplay = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(4),
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr'
  }
}));


const StatCard = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(2.5),
  borderRadius: '12px',
  background: 'rgba(255, 255, 255, 0.6)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  minHeight: '80px',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'translateY(-2px)',
    background: 'rgba(255, 255, 255, 0.75)',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)'
  }
}));


const Login = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  
  const [identifierHasValue, setIdentifierHasValue] = useState(false);
  const [passwordHasValue, setPasswordHasValue] = useState(false);


  useEffect(() => {
    setMounted(true);
  }, []);


  useLayoutEffect(() => {
    const checkAutofill = () => {
      const identifierInput = document.querySelector('input[name="identifier"]');
      const passwordInput = document.querySelector('input[name="password"]');
      
      if (identifierInput?.value) {
        setFormData(prev => ({ ...prev, identifier: identifierInput.value }));
        setIdentifierHasValue(true);
      }
      
      if (passwordInput?.value) {
        setFormData(prev => ({ ...prev, password: passwordInput.value }));
        setPasswordHasValue(true);
      }
    };

    setTimeout(checkAutofill, 100);
    setTimeout(checkAutofill, 500);
    setTimeout(checkAutofill, 1000);
  }, []);


  const makeAnimationStartHandler = (stateSetter) => (e) => {
    const autofilled = !!e.target?.matches("*:-webkit-autofill");
    if (e.animationName === "mui-auto-fill") {
      stateSetter(autofilled);
    }
    if (e.animationName === "mui-auto-fill-cancel") {
      stateSetter(autofilled);
    }
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    if (name === 'identifier') {
      setIdentifierHasValue(value.length > 0);
    }
    if (name === 'password') {
      setPasswordHasValue(value.length > 0);
    }
    
    if (error) setError('');
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(formData);
      
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleGuestAccess = async () => {
    setLoading(true);
    try {
      navigate('/browse');
    } catch (error) {
      setError('Failed to create guest session');
    } finally {
      setLoading(false);
    }
  };


  const features = [
    { icon: <TrendingUp />, text: 'Learn & Grow', color: '#81c784' },
    { icon: <Psychology />, text: 'Share Wisdom', color: '#90caf9' },
    { icon: <EmojiObjects />, text: 'Get Insights', color: '#ffb74d' },
    { icon: <GroupWork />, text: 'Community', color: '#f8bbd9' }
  ];


  return (
    <BackgroundContainer>
      {/* Soft Floating Particles */}
      {[...Array(8)].map((_, i) => (
        <FloatingParticle
          key={i}
          delay={i * 0.4}
          size={Math.random() * 30 + 15}
          left={Math.random() * 100}
          top={Math.random() * 100}
        />
      ))}

      <Container maxWidth="sm" sx={{
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh',
        py: 3
      }}>
        <Fade in={mounted} timeout={800}>
          <EnhancedGlassCard elevation={0}>
            <BrandLogo>
              <LogoIcon />
              <BrandTitle variant="h1">
                FailFixes
              </BrandTitle>
              <Typography 
                variant="h5" 
                sx={{ 
                  color: 'rgba(0, 0, 0, 0.6)',
                  fontWeight: 500,
                  mb: 2,
                  fontSize: '1.3rem'
                }}
              >
                Welcome Back
              </Typography>
              
              <FeatureShowcase>
                {features.map((feature, index) => (
                  <FeatureChip
                    key={index}
                    icon={feature.icon}
                    text={feature.text}
                    color={feature.color}
                  />
                ))}
              </FeatureShowcase>
            </BrandLogo>

            <StatsDisplay>
              <StatCard>
                <Typography variant="h5" fontWeight="bold" sx={{ color: '#81c784' }}>
                  12K+
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Stories
                </Typography>
              </StatCard>
              <StatCard>
                <Typography variant="h5" fontWeight="bold" sx={{ color: '#90caf9' }}>
                  95%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Growth
                </Typography>
              </StatCard>
              <StatCard>
                <Typography variant="h5" fontWeight="bold" sx={{ color: '#ffb74d' }}>
                  200+
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Daily Tips
                </Typography>
              </StatCard>
            </StatsDisplay>

            {error && (
              <Slide direction="down" in={!!error} timeout={400}>
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 3,
                    borderRadius: '12px',
                    background: 'rgba(244, 67, 54, 0.1)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(244, 67, 54, 0.2)'
                  }}
                >
                  {error}
                </Alert>
              </Slide>
            )}

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <EnhancedTextField
                fullWidth
                label="Email or Username"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                required
                placeholder="Enter your email or username"
                autoComplete="username"
                InputLabelProps={{
                  shrink: identifierHasValue || formData.identifier.length > 0
                }}
                inputProps={{
                  onAnimationStart: makeAnimationStartHandler(setIdentifierHasValue)
                }}
              />

              <EnhancedTextField
                fullWidth
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                InputLabelProps={{
                  shrink: passwordHasValue || formData.password.length > 0
                }}
                inputProps={{
                  onAnimationStart: makeAnimationStartHandler(setPasswordHasValue)
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{
                          color: 'rgba(0, 0, 0, 0.5)',
                          '&:hover': { 
                            color: '#81c784',
                            backgroundColor: 'rgba(129, 199, 132, 0.1)'
                          }
                        }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 3 }}>
                <Link
                  onClick={() => navigate('/forgot-password')}
                  sx={{
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textDecoration: 'none',
                    color: '#81c784',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      color: '#66bb6a',
                      transform: 'scale(1.02)'
                    }
                  }}
                >
                  Forgot Password?
                </Link>
              </Stack>

              <EnhancedButton
                type="submit"
                fullWidth
                variant="primary"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={22} color="inherit" /> : <LoginIcon />}
                endIcon={!loading && <ArrowForward />}
                sx={{ mb: 3 }}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </EnhancedButton>

              <Divider sx={{ 
                my: 3,
                '&::before, &::after': {
                  borderColor: 'rgba(0, 0, 0, 0.08)'
                }
              }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', px: 2 }}>
                  OR
                </Typography>
              </Divider>

              <EnhancedButton
                fullWidth
                variant="outlined"
                onClick={handleGuestAccess}
                disabled={loading}
                sx={{ mb: 4 }}
              >
                Continue as Guest
              </EnhancedButton>
            </Box>

            <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
              <Typography variant="body1" color="text.secondary">
                Don't have an account?
              </Typography>
              <Link 
                onClick={() => navigate('/signup')}
                sx={{ 
                  fontWeight: 600,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #81c784, #90caf9)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'scale(1.02)'
                  }
                }}
              >
                Sign Up →
              </Link>
            </Stack>
          </EnhancedGlassCard>
        </Fade>
      </Container>
    </BackgroundContainer>
  );
};


export default Login;
