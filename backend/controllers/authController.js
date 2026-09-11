const User = require('../models/User');

// ========== REGISTER ==========
// @desc    Register user (signup)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, username, password } = req.body;

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
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

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now log in.'
    });

  } catch (error) {
    // Duplicate key / validation are expected client errors with a 400 contract
    // this API has always returned — kept here rather than delegated so the
    // status and message stay stable.
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `User with this ${field} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || 'Validation error'
      });
    }

    // Anything unexpected goes to the centralized handler, which logs the detail
    // server-side and returns a generic message.
    return next(error);
  }
};

// Alias for backward compatibility
exports.signup = exports.register;

// ========== LOGIN ==========
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;


    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Failed-credential events are worth keeping for abuse detection.
      // Log the account identifier only — never the submitted password.
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Failed login for account:', user.username || user.email);
      }
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


    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    return next(error);
  }
};

// ========== GET CURRENT USER ==========
// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
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
    return next(error);
  }
};

// ========== LOGOUT ==========
// @desc    Sign out. Increments tokenVersion, which revokes EVERY token issued
//          for this account (see the note below).
// @route   POST /api/auth/logout
// @access  Private
//
// WHY THIS REVOKES ALL SESSIONS, DELIBERATELY:
// FailFixes issues stateless access tokens that carry no per-session identity
// (no `jti`, no server-side session record). There is therefore no way to
// invalidate one device's token without invalidating the others. The two honest
// options were:
//
//   (a) make logout client-side only — the token stays valid until it expires,
//       so "log out" would not actually end the session; or
//   (b) bump tokenVersion, ending every session for the account.
//
// (b) is chosen because a logout that does not revoke is a security control in
// name only, and because "sign out everywhere" is the safer default for the
// case that actually matters — a user logging out because they think their
// account is compromised. The trade-off (other devices are signed out too) is
// stated in the response message and in the README.
exports.logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { tokenVersion: 1 } },
      { runValidators: false }
    );

    return res.json({
      success: true,
      message: 'Signed out. All sessions for this account have been ended.',
    });
  } catch (error) {
    return next(error);
  }
};

// ========== CHANGE PASSWORD ==========
// @desc    Change the current user's password and revoke all other sessions
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // `password` is select:false, so it must be requested explicitly.
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found. Please login again.',
        code: 'USER_NOT_FOUND',
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      if (process.env.NODE_ENV !== 'test') {
        // Identifier only — never the submitted password.
        console.warn('Failed password change for account:', user.username || user.email);
      }
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Assigning triggers the bcrypt pre-save hook in models/User.js. Writing via
    // findByIdAndUpdate would BYPASS that hook and store the password in
    // cleartext, which is exactly the bug utils/allowedUpdates.js exists to stop.
    user.password = newPassword;

    // A password change must end sessions that may have been established with
    // the old credentials.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Issue a replacement token so the device performing the change stays signed
    // in; every other outstanding token is now invalid.
    const token = user.generateAuthToken();

    return res.json({
      success: true,
      message: 'Password updated. All other sessions have been signed out.',
      token,
    });
  } catch (error) {
    return next(error);
  }
};
