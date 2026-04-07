const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ✅ MAIN AUTH MIDDLEWARE (REQUIRED)
const protect = async (req, res, next) => {
  console.log('\n🔐 AUTH MIDDLEWARE');
  
  try {
    const authHeader = req.header('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No Authorization header found');
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided. Please login.',
        code: 'NO_TOKEN'
      });
    }

    // Extract token
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token || token === 'null' || token === 'undefined') {
      console.error('❌ Invalid token in Authorization header');
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token format. Please login again.',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    console.log('✅ Token found, length:', token.length);
    console.log('🔑 JWT_SECRET configured:', !!process.env.JWT_SECRET);

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified, user ID:', decoded.id);
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', jwtError.message);
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid token. Please login again.',
          code: 'INVALID_TOKEN',
          hint: 'Token signature is invalid. You may need to login again.'
        });
      }
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expired. Please login again.',
          code: 'TOKEN_EXPIRED'
        });
      }

      throw jwtError;
    }

    // Find user
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.error('❌ User not found for token:', decoded.id);
      return res.status(401).json({ 
        success: false, 
        message: 'User account not found. Please login again.',
        code: 'USER_NOT_FOUND'
      });
    }

    console.log('✅ User authenticated:', {
      id: user._id.toString(),
      name: user.name,
      username: user.username
    });

    req.user = user;
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({ 
      success: false, 
      message: 'Authentication error. Please try again.',
      code: 'AUTH_ERROR'
    });
  }
};

// ✅ OPTIONAL AUTH MIDDLEWARE (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  console.log('\n🔓 OPTIONAL AUTH MIDDLEWARE');
  
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      console.log('No auth header - proceeding without authentication');
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token || token === 'null' || token === 'undefined') {
      console.log('No valid token - proceeding without authentication');
      return next();
    }

    // Try to verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (user) {
      console.log('✅ Optional auth successful:', user.name);
      req.user = user;
    } else {
      console.log('⚠️ Token valid but user not found');
    }

    next();
  } catch (error) {
    console.log('⚠️ Optional auth failed - proceeding without auth:', error.message);
    // Don't fail, just proceed without user
    next();
  }
};

// ✅ Export both names for compatibility
module.exports = { 
  auth: protect,
  protect,
  optionalAuth 
};
