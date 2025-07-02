const User = require('../models/User');
const { generateTokenPair, verifyToken } = require('../utils/jwt');
const { supabase } = require('../config/database');
const { addToBlacklist } = require('../utils/tokenBlacklist');

const register = async (req, res) => {
  try {
    console.log(req.body);

    const userData = User.validate(req.body, 'register');
    const userModel = new User();
    console.log(userData);

    // Check for existing email
    const existingUser = await userModel.findByEmail(userData.email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists',
        code: 'EMAIL_EXISTS',
      });
    }
    console.log("ghghfh" + existingUser);

    // Check for existing phone
    const existingPhone = await userModel.findByPhone(userData.phone);
    if (existingPhone) {
      return res.status(409).json({
        error: 'User with this phone number already exists',
        code: 'PHONE_EXISTS',
      });
    }

    const newUser = await userModel.createWithSupabase(userData);

    const tokens = generateTokenPair({
      sub: newUser.id,
      email: newUser.email,
    });

    res.status(201).json({
      message:
        'Registration successful. Please verify your email and phone number.',
      user: userModel.sanitizeForClient(newUser),
      registrationStep: 'basic',
      nextSteps: [
        'Verify email address',
        'Verify phone number',
        'Complete profile information',
      ],
      ...tokens,
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const loginData = User.validate(req.body, 'login');

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

    if (authError) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const userModel = new User();
    await userModel.updateLastLogin(authData.user.id);

    const tokens = generateTokenPair({
      sub: authData.user.id,
      email: authData.user.email,
    });

    res.json({
      message: 'Login successful',
      user: userModel.sanitizeForClient(authData.user),
      ...tokens,
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_MISSING',
      });
    }

    const decoded = verifyToken(refreshToken);

    const userModel = new User();
    const user = await userModel.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const tokens = generateTokenPair({
      sub: user.id,
      email: user.email,
    });

    res.json({
      message: 'Token refreshed successfully',
      ...tokens,
    });
  } catch (error) {
    res.status(401).json({
      error: 'Token refresh failed',
      message: error.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      addToBlacklist(token);
    }

    await supabase.auth.signOut();

    res.json({
      message: 'Logout successful',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed',
      message: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const emailData = User.validate(req.body, 'forgotPassword');

    const { error } = await supabase.auth.resetPasswordForEmail(
      emailData.email,
      {
        redirectTo: `${process.env.WEB_APP_URL}/reset-password`,
      }
    );

    if (error) {
      return res.status(400).json({
        error: 'Password reset failed',
        message: error.message,
      });
    }

    res.json({
      message: 'Password reset email sent successfully',
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const resetData = User.validate(req.body, 'resetPassword');

    const { error } = await supabase.auth.verifyOtp({
      token_hash: resetData.token,
      type: 'recovery',
    });

    if (error) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: resetData.password,
    });

    if (updateError) {
      return res.status(400).json({
        error: 'Password update failed',
        message: updateError.message,
      });
    }

    res.json({
      message: 'Password reset successful',
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token required',
        code: 'TOKEN_MISSING',
      });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email',
    });

    if (error) {
      return res.status(400).json({
        error: 'Email verification failed',
        message: error.message,
      });
    }

    const userModel = new User();

    // Update registration step if both email and phone are verified
    const currentUser = data.user;
    if (currentUser.phone_confirmed_at) {
      await userModel.updateRegistrationStep(currentUser.id, 'verified');
    }

    const sanitizedUser = userModel.sanitizeForClient(data.user);

    res.json({
      message: 'Email verified successfully',
      user: sanitizedUser,
      registrationStep: currentUser.phone_confirmed_at ? 'verified' : 'basic',
      nextSteps: currentUser.phone_confirmed_at
        ? ['Complete profile information']
        : ['Verify phone number', 'Complete profile information'],
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const verifyPhone = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token required',
        code: 'TOKEN_MISSING',
      });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'sms',
    });

    if (error) {
      return res.status(400).json({
        error: 'Phone verification failed',
        message: error.message,
      });
    }

    const userModel = new User();

    // Update registration step if both email and phone are verified
    const currentUser = data.user;
    if (currentUser.email_confirmed_at) {
      await userModel.updateRegistrationStep(currentUser.id, 'verified');
    }

    const sanitizedUser = userModel.sanitizeForClient(data.user);

    res.json({
      message: 'Phone verified successfully',
      user: sanitizedUser,
      registrationStep: currentUser.email_confirmed_at ? 'verified' : 'basic',
      nextSteps: currentUser.email_confirmed_at
        ? ['Complete profile information']
        : ['Verify email address', 'Complete profile information'],
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyPhone,
};
