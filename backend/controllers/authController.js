const User = require('../models/User');

// ========== REGISTER ==========
// @desc    Register user (signup)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    console.log('📝 Signup attempt:', { 
      name, 
      email, 
      username: username || 'NOT_PROVIDED' 
    });

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      console.log('❌ Email already registered:', email);
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if username already exists (only if provided)
    if (username && username.trim()) {
      const existingUsername = await User.findOne({ 
        username: username.trim().toLowerCase() 
      });
      if (existingUsername) {
        console.log('❌ Username already taken:', username);
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
    }

    // Build user data
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      isVerified: true,
      allowAnonymous: false
    };

    // Add username only if provided and not empty
    if (username && username.trim()) {
      userData.username = username.trim().toLowerCase();
    }

    // Create and save user
    const user = new User(userData);
    await user.save();

    console.log('✅ User created:', {
      id: user._id,
      email: user.email,
      username: user.username || 'NO_USERNAME'
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now log in.'
    });

  } catch (error) {
    console.error('❌ SIGNUP ERROR:', error.message);

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `User with this ${field} already exists`
      });
    }

    // Handle validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || 'Validation error'
      });
    }

    // General server error
    res.status(500).json({
      success: false,
      message: 'Server error during signup. Please try again.',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message
      })
    });
  }
};

// Alias for backward compatibility
exports.signup = exports.register;

// ========== LOGIN ==========
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    console.log('🔐 Login attempt:', identifier);

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ]
    }).select('+password');

    if (!user) {
      console.log('❌ User not found:', identifier);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      console.log('❌ Account deactivated:', user.username || user.email);
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Invalid password for:', user.username || user.email);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = user.generateAuthToken();

    // Update login stats
    await User.findByIdAndUpdate(
      user._id,
      {
        $set: { lastLogin: new Date() },
        $inc: { loginCount: 1 }
      },
      { runValidators: false }
    );

    // Prepare user data
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username || null,
      bio: user.bio || '',
      location: user.location || '',
      website: user.website || '',
      avatar: user.avatar || '',
      stats: user.stats,
      isVerified: user.isVerified,
      role: user.role,
      lastLogin: new Date(),
      createdAt: user.createdAt
    };

    console.log('✅ Login successful:', user.username || user.email);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.error('❌ LOGIN ERROR:', error.message);

    res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.',
      ...(process.env.NODE_ENV === 'development' && {
        error: error.message
      })
    });
  }
};

// ========== GET CURRENT USER ==========
// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      username: user.username || null,
      bio: user.bio || '',
      location: user.location || '',
      website: user.website || '',
      avatar: user.avatar || '',
      stats: user.stats,
      isVerified: user.isVerified,
      role: user.role,
      preferences: user.preferences,
      createdAt: user.createdAt
    };

    res.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('❌ GET ME ERROR:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Error fetching user data'
    });
  }
};
