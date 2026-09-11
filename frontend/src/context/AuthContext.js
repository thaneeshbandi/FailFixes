import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  Backdrop,
  Box,
  Avatar,
  Typography,
  CircularProgress,
} from '@mui/material';
import { AutoFixHigh } from '@mui/icons-material';
import { keyframes } from '@mui/material/styles';
import axios from 'axios';
import { authAPI } from '../services/api';

// ✅ API BASE URL CONFIGURATION
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AuthContext = createContext();

// ========== ANIMATIONS ==========
const perfectFloat = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
  50% { transform: translateY(-8px) rotate(2deg) scale(1.02); }
`;

const cosmicPulse = keyframes`
  0%, 100% { 
    box-shadow: 0 0 40px rgba(16, 185, 129, 0.4);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 80px rgba(16, 185, 129, 0.6);
    transform: scale(1.05);
  }
`;

// ========== CUSTOM HOOK ==========
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ========== AUTH PROVIDER ==========
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ CLEAR INVALID TOKENS
  const clearAuth = () => {
    console.log('🧹 Clearing authentication data');
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    localStorage.removeItem('token');
    setUser(null);
  };

  // ✅ VERIFY TOKEN WITH BACKEND
  const verifyToken = async (token) => {
    try {
      console.log('🔍 Verifying token with backend...');
      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success && response.data.user) {
        console.log('✅ Token verified successfully');
        return response.data.user;
      }

      console.warn('⚠️ Token verification failed - invalid response');
      return null;
    } catch (error) {
      console.error('❌ Token verification failed:', error.response?.data?.message || error.message);
      return null;
    }
  };

  // ✅ INITIALIZE AUTH ON MOUNT
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('ff_token');
        const userData = localStorage.getItem('ff_user');
        
        if (token && userData) {
          console.log('🔄 Found stored credentials, verifying...');
          
          // Verify token is still valid
          const verifiedUser = await verifyToken(token);
          
          if (verifiedUser) {
            // Token is valid, use backend data
            const enhancedUser = {
              ...verifiedUser,
              displayUsername: verifiedUser.username || verifiedUser.name || `user_${verifiedUser._id?.slice(-6)}`,
              stats: {
                storiesCount: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                followersCount: 0,
                followingCount: 0,
                ...verifiedUser.stats,
              },
            };
            
            setUser(enhancedUser);
            
            // Update local storage with fresh data
            localStorage.setItem('ff_user', JSON.stringify(enhancedUser));
            console.log('✅ Auth initialized with verified user:', enhancedUser.name);
          } else {
            // Token is invalid, clear everything
            console.warn('⚠️ Token invalid, clearing auth');
            clearAuth();
          }
        } else {
          console.log('ℹ️ No stored credentials found');
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
        clearAuth();
      } finally {
        setTimeout(() => setLoading(false), 1500);
      }
    };

    initAuth();
  }, []);

  // ✅ LOGIN FUNCTION
  const login = async (credentials) => {
    try {
      console.log('🔐 Attempting login to:', `${API_BASE_URL}/auth/login`);
      
      const response = await axios.post(
        `${API_BASE_URL}/auth/login`,
        credentials
      );
      
      if (response.data.success) {
        const { token, user: userData } = response.data;
        
        console.log('✅ Login successful:', userData.username || userData.name);
        
        // Store token and user data
        localStorage.setItem('ff_token', token);
        localStorage.setItem('ff_user', JSON.stringify(userData));
        
        // Set enhanced user state
        const enhancedUser = {
          ...userData,
          displayUsername: userData.username || userData.name || `user_${userData._id?.slice(-6)}`,
          stats: {
            storiesCount: 0,
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            followersCount: 0,
            followingCount: 0,
            ...userData.stats,
          },
        };
        
        setUser(enhancedUser);
        
        return { success: true, user: enhancedUser };
      } else {
        console.error('❌ Login failed:', response.data.message);
        return { 
          success: false, 
          error: response.data.message || 'Login failed' 
        };
      }
    } catch (error) {
      console.error('❌ Login error:', error.response?.data?.message || error.message);
      
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      const errorCode = error.response?.data?.code;
      
      return { 
        success: false, 
        error: errorMessage,
        code: errorCode
      };
    }
  };

  // ✅ REGISTER FUNCTION
  const register = async (userData) => {
    try {
      console.log('📝 Attempting registration to:', `${API_BASE_URL}/auth/register`);
      
      const response = await axios.post(
        `${API_BASE_URL}/auth/register`,
        userData
      );
      
      if (response.data.success) {
        console.log('✅ Registration successful:', userData.username || userData.name);

        // Check if email verification is required
        if (response.data.requiresVerification) {
          return { 
            success: true,
            requiresVerification: true,
            message: response.data.message || 'Registration successful! Please check your email to verify your account.',
          };
        }

        // If no verification required, auto-login
        const { token, user: registeredUser } = response.data;
        
        if (token && registeredUser) {
          localStorage.setItem('ff_token', token);
          localStorage.setItem('ff_user', JSON.stringify(registeredUser));
          
          const enhancedUser = {
            ...registeredUser,
            displayUsername: registeredUser.username || registeredUser.name || `user_${registeredUser._id?.slice(-6)}`,
            stats: {
              storiesCount: 0,
              totalViews: 0,
              totalLikes: 0,
              totalComments: 0,
              followersCount: 0,
              followingCount: 0,
              ...registeredUser.stats,
            },
          };
          
          setUser(enhancedUser);
          
          return { 
            success: true, 
            user: enhancedUser,
            message: 'Registration successful!'
          };
        }

        return { 
          success: true,
          message: response.data.message || 'Registration successful!',
        };
      } else {
        console.error('❌ Registration failed:', response.data.message);
        return { 
          success: false, 
          error: response.data.message || 'Registration failed' 
        };
      }
    } catch (error) {
      console.error('❌ Registration error:', error.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Registration failed. Please try again.', 
      };
    }
  };

  // ✅ SIGNUP ALIAS
  const signup = async (userData) => {
    return await register(userData);
  };

  // ✅ LOGOUT FUNCTION
  //
  // Logout is now a real server-side operation: POST /api/auth/logout increments
  // the account's tokenVersion, which invalidates every token issued for it.
  // Previously this only cleared localStorage, so the token stayed valid for its
  // full two-day lifetime and anyone who had copied it kept access.
  //
  // Because tokens carry no per-session identity, this signs the account out
  // everywhere — a deliberate trade documented in docs/ARCHITECTURE.md.
  //
  // Local state is cleared even if the request fails: the user asked to be
  // signed out of this device, and that must not depend on the network.
  const logout = async () => {
    try {
      await authAPI.logout();
      console.log('👋 Logged out — all sessions revoked');
    } catch (error) {
      console.warn('⚠️ Logout request failed; clearing local session anyway:', error.message);
    } finally {
      clearAuth();
    }
  };

  // ✅ UPDATE USER FUNCTION
  const updateUser = (updatedUser) => {
    const enhanced = {
      ...user,
      ...updatedUser,
      displayUsername: updatedUser.username || updatedUser.name || user?.displayUsername,
      stats: {
        ...user?.stats,
        ...updatedUser.stats,
      },
    };
    
    setUser(enhanced);
    localStorage.setItem('ff_user', JSON.stringify(enhanced));
    console.log('✅ User updated:', enhanced.name);
  };

  // ✅ REFRESH USER DATA
  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('ff_token');
      if (!token) return;

      const verifiedUser = await verifyToken(token);
      if (verifiedUser) {
        updateUser(verifiedUser);
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error('❌ Error refreshing user:', error);
    }
  };

  // ✅ LOADING SCREEN
  if (loading) {
    return (
      <Backdrop
        open
        sx={{ 
          zIndex: 9999, 
          background: 'linear-gradient(135deg, #fafbfc, #f1f5f9)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <Box textAlign="center">
          <Avatar
            sx={{ 
              width: 100, 
              height: 100, 
              background: 'linear-gradient(135deg, #10b981, #34d399)',
              margin: '0 auto 32px',
              animation: `${perfectFloat} 3s ease-in-out infinite, ${cosmicPulse} 4s ease-in-out infinite`,
              boxShadow: '0 20px 60px rgba(16, 185, 129, 0.4)',
            }}
          >
            <AutoFixHigh sx={{ fontSize: '3rem' }} />
          </Avatar>
          
          <Typography
            variant="h2"
            sx={{ 
              fontWeight: 900, 
              mb: 2,
              background: 'linear-gradient(135deg, #10b981, #34d399)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            FailFixes
          </Typography>
          
          <Typography
            variant="h5"
            sx={{ 
              color: 'text.secondary', 
              mb: 4,
              fontWeight: 500,
            }}
          >
            Transforming setbacks into comebacks
          </Typography>
          
          <CircularProgress 
            size={60} 
            thickness={4}
            sx={{ 
              color: '#10b981',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }} 
          />
        </Box>
      </Backdrop>
    );
  }

  const value = {
    user,
    isAuthenticated: !!user,
    loading: false,
    login,
    register,
    signup,
    logout,
    updateUser,
    refreshUser,
    clearAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
