const { supabase, supabaseAdmin } = require('../config/database');
const { generateTokenPair, verifyToken } = require('../utils/jwt');
const { validationResult } = require('express-validator');

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { email, password, firstName, lastName } = req.body;

    const { data: existingUser } = await supabase
      .from('auth.users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email already exists',
        code: 'EMAIL_EXISTS',
      });
    }

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

    if (authError) {
      return res.status(400).json({
        error: 'Registration failed',
        message: authError.message,
      });
    }

    const tokens = generateTokenPair({
      sub: authUser.user.id,
      email: authUser.user.email,
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        firstName,
        lastName,
        emailVerified: false,
      },
      ...tokens,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { email, password } = req.body;

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const tokens = generateTokenPair({
      sub: authData.user.id,
      email: authData.user.email,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        emailVerified: !!authData.user.email_confirmed_at,
      },
      ...tokens,
    });
  } catch (error) {
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

    const { data: user, error } = await supabase
      .from('auth.users')
      .select('id, email')
      .eq('id', decoded.sub)
      .single();

    if (error || !user) {
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { email } = req.body;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.WEB_APP_URL}/reset-password`,
    });

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
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { token, password } = req.body;

    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });

    if (error) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
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
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

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

    res.json({
      message: 'Email verified successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        emailVerified: true,
      },
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
};
