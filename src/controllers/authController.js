const User = require('../models/User');
const { supabase } = require('../config/database');

const register = async (req, res) => {
  try {
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

    // Check for existing phone
    const existingPhone = await userModel.findByPhone(userData.phone);
    if (existingPhone) {
      return res.status(409).json({
        error: 'User with this phone number already exists',
        code: 'PHONE_EXISTS',
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      phone: userData.phone,
      options: {
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          date_of_birth: userData.dateOfBirth,
          gender: userData.gender,
          religion: userData.religion,
          country: userData.country,
          living_country: userData.livingCountry,
          state: userData.state,
          city: userData.city,
          account_status: 'active',
        },
      },
    });

    if (error) {
      // Don't expose detailed Supabase error messages to prevent information leakage
      return res.status(400).json({
        error: 'Registration failed',
        code: error.code || 'REGISTRATION_ERROR',
      });
    }

    const sanitizedUser = userModel.sanitizeForClient(data.user);

    res.status(201).json({
      message:
        'Registration successful. Please verify your email and phone number.',
      user: sanitizedUser,
      minimalProfileCompletion: false,
      canAccessDashboard: false,
      nextSteps: [
        'Verify email address',
        'Verify phone number',
        'Complete profile information',
      ],
      // Only return session tokens, not full session object for security
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      expiresAt: data.session?.expires_at,
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    console.error('Internal server error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const login = async (req, res) => {
  try {
    const loginData = User.validate(req.body, 'login');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginData.email,
      password: loginData.password,
    });

    if (error) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const userModel = new User();
    await userModel.updateLastLogin(data.user.id);

    const sanitizedUser = userModel.sanitizeForClient(data.user);
    
    res.json({
      message: 'Login successful',
      user: sanitizedUser,
      minimalProfileCompletion: sanitizedUser.minimalProfileCompletion,
      canAccessDashboard: sanitizedUser.minimalProfileCompletion,
      // Only return session tokens, not full session object for security
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      expiresAt: data.session?.expires_at,
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    console.error('Internal server error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'REFRESH_TOKEN_MISSING',
      });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error) {
      return res.status(401).json({
        error: 'Token refresh failed',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const userModel = new User();

    res.json({
      message: 'Token refreshed successfully',
      user: userModel.sanitizeForClient(data.user),
      // Only return session tokens, not full session object for security
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      expiresAt: data.session?.expires_at,
    });
  } catch (refreshError) {
    console.error('Token refresh error:', refreshError.message);
    res.status(401).json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR',
    });
  }
};

const logout = async (req, res) => {
  try {
    // Get JWT token from the authenticated request
    const jwtToken = req.user?.jwt;
    
    if (jwtToken) {
      // Create authenticated client and sign out
      const { createClient } = require('@supabase/supabase-js');
      const authenticatedClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${jwtToken}`
            }
          }
        }
      );
      
      const { error } = await authenticatedClient.auth.signOut();
      if (error) {
        console.error('Error signing out user:', error.message);
        return res.status(400).json({
          error: 'Logout failed',
          code: 'LOGOUT_ERROR',
        });
      }
    }

    res.json({
      message: 'Logout successful',
    });
  } catch (logoutError) {
    console.error('Logout error:', logoutError.message);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
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
      // Always return success to prevent email enumeration
      return res.json({
        message: 'If the email exists, a password reset link has been sent',
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

    console.error('Internal server error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
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
        code: 'PASSWORD_UPDATE_ERROR',
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

    console.error('Internal server error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token, type = 'email' } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token required',
        code: 'TOKEN_MISSING',
      });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type,
    });

    if (error) {
      return res.status(400).json({
        error: 'Email verification failed',
        code: 'VERIFICATION_ERROR',
      });
    }

    const userModel = new User();
    const currentUser = data.user;
    const sanitizedUser = userModel.sanitizeForClient(data.user);

    res.json({
      message: 'Email verified successfully',
      user: sanitizedUser,
      // Only return session tokens, not full session object for security
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      expiresAt: data.session?.expires_at,
      emailVerified: true,
      phoneVerified: !!currentUser.phone_confirmed_at,
      nextSteps: currentUser.phone_confirmed_at
        ? ['Complete your profile']
        : ['Verify phone number', 'Complete your profile'],
    });
  } catch (error) {
    console.error('Internal server error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const verifyPhone = async (req, res) => {
  try {
    const { token, type = 'sms' } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token required',
        code: 'TOKEN_MISSING',
      });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type,
    });

    if (error) {
      return res.status(400).json({
        error: 'Phone verification failed',
        code: 'VERIFICATION_ERROR',
      });
    }

    const userModel = new User();
    const currentUser = data.user;
    const sanitizedUser = userModel.sanitizeForClient(data.user);

    res.json({
      message: 'Phone verified successfully',
      user: sanitizedUser,
      // Only return session tokens, not full session object for security
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
      expiresAt: data.session?.expires_at,
      phoneVerified: true,
      emailVerified: !!currentUser.email_confirmed_at,
      nextSteps: currentUser.email_confirmed_at
        ? ['Complete your profile']
        : ['Verify email address', 'Complete your profile'],
    });
  } catch (error) {
    console.error('Internal server error:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
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
