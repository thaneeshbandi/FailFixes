import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Avatar, Menu, MenuItem,
  Box, Container, Drawer, List, ListItem, ListItemIcon, ListItemText,
  useTheme, useMediaQuery, Divider
} from '@mui/material';
import {
  AutoFixHigh, Menu as MenuIcon, Dashboard, Create, Explore, Person,
  Settings, Logout, Login, PersonAdd, Home, Close, Chat
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';


// Animations
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


// Styled Components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: `
    linear-gradient(135deg, 
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 255, 255, 0.85) 100%
    )
  `,
  backdropFilter: 'blur(20px) saturate(120%)',
  WebkitBackdropFilter: 'blur(20px) saturate(120%)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  color: theme.palette.text.primary,
  boxShadow: `
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6)
  `,
}));


const LogoContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  cursor: 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    transform: 'scale(1.02)',
  }
}));


const ElegantButton = styled(Button)(({ theme, variant: buttonVariant, active }) => ({
  borderRadius: '16px',
  padding: '10px 24px',
  fontSize: '0.95rem',
  fontWeight: 600,
  textTransform: 'none',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
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
  ...(buttonVariant === 'nav' && {
    color: active ? '#81c784' : theme.palette.text.secondary,
    background: active 
      ? 'linear-gradient(135deg, rgba(129, 199, 132, 0.15), rgba(144, 202, 249, 0.1))' 
      : 'transparent',
    border: active ? '1px solid rgba(129, 199, 132, 0.3)' : '1px solid transparent',
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(129, 199, 132, 0.1), rgba(144, 202, 249, 0.1))',
      color: '#81c784',
      transform: 'translateY(-1px)',
      border: '1px solid rgba(129, 199, 132, 0.3)',
    }
  })
}));


const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: 280,
    background: `
      linear-gradient(135deg, 
        rgba(255, 255, 255, 0.95) 0%,
        rgba(248, 250, 252, 0.95) 100%
      )
    `,
    backdropFilter: 'blur(20px) saturate(120%)',
    WebkitBackdropFilter: 'blur(20px) saturate(120%)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: `
      0 8px 32px rgba(0, 0, 0, 0.08),
      0 4px 16px rgba(0, 0, 0, 0.04)
    `,
  }
}));


const DrawerHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
  background: `
    linear-gradient(135deg, 
      rgba(129, 199, 132, 0.05) 0%,
      rgba(144, 202, 249, 0.05) 100%
    )
  `,
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, #81c784, #aed581, #90caf9)',
  }
}));


const DrawerListItem = styled(ListItem)(({ theme, active }) => ({
  borderRadius: '12px',
  margin: theme.spacing(0.5, 2),
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  background: active 
    ? 'linear-gradient(135deg, rgba(129, 199, 132, 0.15), rgba(144, 202, 249, 0.1))'
    : 'transparent',
  border: active ? '1px solid rgba(129, 199, 132, 0.3)' : '1px solid transparent',
  cursor: 'pointer',
  '&:hover': {
    background: 'linear-gradient(135deg, rgba(129, 199, 132, 0.1), rgba(144, 202, 249, 0.1))',
    transform: 'translateX(4px)',
    border: '1px solid rgba(129, 199, 132, 0.3)',
  }
}));


const ProfileMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: '16px',
    marginTop: theme.spacing(1),
    minWidth: 200,
    background: `
      linear-gradient(135deg, 
        rgba(255, 255, 255, 0.95) 0%,
        rgba(248, 250, 252, 0.95) 100%
      )
    `,
    backdropFilter: 'blur(20px) saturate(120%)',
    WebkitBackdropFilter: 'blur(20px) saturate(120%)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: `
      0 8px 32px rgba(0, 0, 0, 0.12),
      0 4px 16px rgba(0, 0, 0, 0.08)
    `,
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: 'linear-gradient(90deg, #81c784, #aed581, #90caf9)',
      borderRadius: '16px 16px 0 0',
    }
  },
  '& .MuiMenuItem-root': {
    borderRadius: '8px',
    margin: theme.spacing(0.5, 1),
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(129, 199, 132, 0.1), rgba(144, 202, 249, 0.1))',
      transform: 'translateX(4px)',
    }
  }
}));


function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();


  const navigation = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Browse', path: '/browse', icon: Explore },
    ...(isAuthenticated ? [
      { name: 'Write', path: '/write', icon: Create },
      { name: 'Dashboard', path: '/dashboard', icon: Dashboard },
      { name: 'Messages', path: '/chat', icon: Chat }
    ] : [])
  ];


  const isActive = (path) => location.pathname === path;


  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };


  const handleMenuClose = () => {
    setAnchorEl(null);
  };


  const handleLogout = () => {
    logout();
    navigate('/');
    handleMenuClose();
  };


  const renderDesktopNav = () => (
    <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
      {navigation.map((item) => (
        <ElegantButton
          key={item.name}
          variant="nav"
          active={isActive(item.path)}
          onClick={() => navigate(item.path)}
          startIcon={<item.icon />}
        >
          {item.name}
        </ElegantButton>
      ))}
    </Box>
  );


  const renderMobileDrawer = () => (
    <StyledDrawer
      anchor="left"
      open={mobileOpen}
      onClose={() => setMobileOpen(false)}
    >
      <DrawerHeader>
        <LogoContainer onClick={() => { navigate('/'); setMobileOpen(false); }}>
          <Avatar sx={{ 
            background: 'linear-gradient(135deg, #81c784, #aed581)',
            animation: `${gentleFloat} 4s ease-in-out infinite, ${softGlow} 3s ease-in-out infinite alternate`,
          }}>
            <AutoFixHigh />
          </Avatar>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1 }}>
              FailFixes
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Transform setbacks into comebacks
            </Typography>
          </Box>
        </LogoContainer>
      </DrawerHeader>
      
      <List sx={{ pt: 2 }}>
        {navigation.map((item) => (
          <DrawerListItem 
            key={item.name}
            active={isActive(item.path)}
            onClick={() => {
              navigate(item.path);
              setMobileOpen(false);
            }}
          >
            <ListItemIcon sx={{ 
              color: isActive(item.path) ? '#81c784' : 'inherit',
              minWidth: 40 
            }}>
              <item.icon />
            </ListItemIcon>
            <ListItemText 
              primary={item.name}
              sx={{ 
                '& .MuiListItemText-primary': {
                  fontWeight: 600,
                  color: isActive(item.path) ? '#81c784' : 'inherit'
                }
              }}
            />
          </DrawerListItem>
        ))}
      </List>


      {isAuthenticated && (
        <>
          <Divider sx={{ mx: 2, my: 2 }} />
          <List>
            <DrawerListItem onClick={() => { navigate(`/profile/${user?.username || user?.name}`); setMobileOpen(false); }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Person />
              </ListItemIcon>
              <ListItemText primary="Profile" sx={{ '& .MuiListItemText-primary': { fontWeight: 600 } }} />
            </DrawerListItem>
            <DrawerListItem onClick={() => { navigate('/settings'); setMobileOpen(false); }}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Settings />
              </ListItemIcon>
              <ListItemText primary="Settings" sx={{ '& .MuiListItemText-primary': { fontWeight: 600 } }} />
            </DrawerListItem>
          </List>
        </>
      )}


      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <IconButton 
          onClick={() => setMobileOpen(false)}
          sx={{ 
            background: 'rgba(129, 199, 132, 0.1)',
            '&:hover': { background: 'rgba(129, 199, 132, 0.2)' }
          }}
        >
          <Close />
        </IconButton>
      </Box>
    </StyledDrawer>
  );


  return (
    <>
      <StyledAppBar position="sticky" elevation={0}>
        <Container maxWidth="lg">
          <Toolbar sx={{ 
            py: 2.2,
            minHeight: 70,
          }}>
            {isMobile && (
              <IconButton
                edge="start"
                onClick={() => setMobileOpen(true)}
                sx={{ 
                  mr: 2,
                  background: 'rgba(129, 199, 132, 0.1)',
                  '&:hover': { background: 'rgba(129, 199, 132, 0.2)' }
                }}
              >
                <MenuIcon />
              </IconButton>
            )}


            <LogoContainer onClick={() => navigate('/')} sx={{ flexGrow: isMobile ? 1 : 0 }}>
              <Avatar sx={{ 
                background: 'linear-gradient(135deg, #81c784, #aed581)',
                animation: `${gentleFloat} 4s ease-in-out infinite, ${softGlow} 3s ease-in-out infinite alternate`,
                width: 52,
                height: 52
              }}>
                <AutoFixHigh />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1, color: '#2e7d32' }}>
                  FailFixes
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  Transform setbacks into comebacks
                </Typography>
              </Box>
            </LogoContainer>


            <Box sx={{ flexGrow: 1 }} />


            {renderDesktopNav()}


            <Box sx={{ ml: 2 }}>
              {isAuthenticated ? (
                <Avatar
                  onClick={handleProfileMenuOpen}
                  sx={{ 
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #81c784, #aed581)',
                    width: 44,
                    height: 44,
                    fontWeight: 700,
                    transition: 'all 0.3s ease',
                    '&:hover': { 
                      transform: 'scale(1.1)',
                      boxShadow: '0 4px 16px rgba(129, 199, 132, 0.3)'
                    }
                  }}
                >
                  {user?.name?.charAt(0) || 'U'}
                </Avatar>
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <ElegantButton
                    variant="outlined"
                    startIcon={<Login />}
                    onClick={() => navigate('/login')}
                  >
                    Sign In
                  </ElegantButton>
                  <ElegantButton
                    variant="primary"
                    startIcon={<PersonAdd />}
                    onClick={() => navigate('/signup')}
                  >
                    Join Free
                  </ElegantButton>
                </Box>
              )}
            </Box>
          </Toolbar>
        </Container>
      </StyledAppBar>


      {renderMobileDrawer()}


      <ProfileMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { navigate('/dashboard'); handleMenuClose(); }}>
          <Dashboard sx={{ mr: 2, color: '#81c784' }} />
          Dashboard
        </MenuItem>
        <MenuItem onClick={() => { navigate(`/profile/${user?.username || user?.name}`); handleMenuClose(); }}>
          <Person sx={{ mr: 2, color: '#81c784' }} />
          Profile
        </MenuItem>
        <MenuItem onClick={() => { navigate('/chat'); handleMenuClose(); }}>
          <Chat sx={{ mr: 2, color: '#81c784' }} />
          Messages
        </MenuItem>
        <MenuItem onClick={() => { navigate('/settings'); handleMenuClose(); }}>
          <Settings sx={{ mr: 2, color: '#81c784' }} />
          Settings
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <Logout sx={{ mr: 2 }} />
          Logout
        </MenuItem>
      </ProfileMenu>
    </>
  );
}


export default Header;
