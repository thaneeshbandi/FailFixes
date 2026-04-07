import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContexts'; // ✅ ADD THIS

// Import Components
import Header from './components/layout/header';
import Footer from './components/layout/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Import Pages
import Home from './pages/Home';
import Login from './pages/login';
import Signup from './pages/Signup';
import Browse from './pages/Browse';
import CreateStory from './pages/CreateStory';
import ViewStory from './pages/ViewStory';
import Dashboard from './pages/Dashboard';
import UserProfile from './pages/UserProfile';
import FollowersPage from './pages/Followers';
import FollowingPage from './pages/Following';
import ChatPage from './pages/ChatPage'; // ✅ ADD THIS

// 🎨 **ENHANCED THEME CONFIGURATION**
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6366f1',
      light: '#8b5cf6',
      dark: '#4338ca',
      contrastText: '#ffffff',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    background: {
      default: '#fafbfc',
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#6b7280',
    },
    divider: 'rgba(107, 114, 128, 0.12)',
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
    h1: { 
      fontSize: '3.5rem', 
      fontWeight: 900,
      lineHeight: 1.1,
      letterSpacing: '-0.025em'
    },
    h2: { 
      fontSize: '2.75rem', 
      fontWeight: 800,
      lineHeight: 1.2,
      letterSpacing: '-0.025em'
    },
    h3: { 
      fontSize: '2.25rem', 
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.025em'
    },
    h4: { 
      fontSize: '1.875rem', 
      fontWeight: 700,
      lineHeight: 1.3
    },
    h5: { 
      fontSize: '1.5rem', 
      fontWeight: 600,
      lineHeight: 1.4
    },
    h6: { 
      fontSize: '1.25rem', 
      fontWeight: 600,
      lineHeight: 1.4
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.7,
      fontWeight: 400,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      fontWeight: 400,
    },
    button: { 
      textTransform: 'none', 
      fontWeight: 700,
      fontSize: '0.875rem',
      letterSpacing: '0.025em'
    },
  },
  shape: { 
    borderRadius: 16 
  },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f5f9',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#cbd5e1',
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#94a3b8',
          },
        },
        '*': {
          boxSizing: 'border-box',
        },
        a: {
          textDecoration: 'none',
          color: 'inherit',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '12px 24px',
          fontWeight: 700,
          fontSize: '0.875rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          textTransform: 'none',
          boxShadow: 'none',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
          },
          '&:active': {
            transform: 'translateY(0px)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          '&:hover': {
            transform: 'translateY(-4px) scale(1.02)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
        },
        elevation2: {
          boxShadow: '0 8px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.05)',
        },
        elevation3: {
          boxShadow: '0 12px 24px rgba(0, 0, 0, 0.1), 0 8px 15px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            transition: 'all 0.3s ease',
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#10b981',
              },
            },
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#10b981',
                borderWidth: 2,
              },
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          color: '#111827',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <SocketProvider> {/* ✅ ADD SOCKET PROVIDER */}
          <Router>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              minHeight: '100vh',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
            }}>
              <Header />
              
              <main style={{ 
                flex: 1,
                position: 'relative',
                zIndex: 1
              }}>
                <Routes>
                  {/* 🏠 Home Route - Landing + Feed combined */}
                  <Route path="/" element={<Home />} />
                  
                  {/* 🔐 Authentication Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  
                  {/* 📚 Story Routes */}
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/stories" element={<Browse />} />
                  
                  {/* ✍️ Create Story Routes */}
                  <Route path="/write" element={
                    <ProtectedRoute>
                      <CreateStory />
                    </ProtectedRoute>
                  } />
                  <Route path="/create" element={
                    <ProtectedRoute>
                      <CreateStory />
                    </ProtectedRoute>
                  } />
                  <Route path="/create-story" element={
                    <ProtectedRoute>
                      <CreateStory />
                    </ProtectedRoute>
                  } />
                  
                  {/* 📖 View Story Route */}
                  <Route path="/story/:id" element={<ViewStory />} />
                  
                  {/* 📊 Dashboard Route */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  
                  {/* 👤 User Profile Routes */}
                  <Route path="/profile/:username" element={<UserProfile />} />
                  <Route path="/profile/:username/followers" element={<FollowersPage />} />
                  <Route path="/profile/:username/following" element={<FollowingPage />} />
                  
                  {/* ✅ ADD CHAT ROUTE */}
                  <Route path="/chat" element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/messages" element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  } />
                  
                  {/* 🔄 Redirects for legacy routes */}
                  <Route path="/home" element={<Navigate to="/" replace />} />
                  <Route path="/stories/:id" element={<Navigate to="/story/:id" replace />} />
                  
                  {/* 🚫 Catch-all route - redirect to home */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
              
              <Footer />
            </div>
          </Router>
        </SocketProvider> {/* ✅ CLOSE SOCKET PROVIDER */}
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
