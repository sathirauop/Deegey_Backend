const { supabase } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING',
      });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid token or user not found',
        code: 'TOKEN_INVALID',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      email_confirmed_at: user.email_confirmed_at,
      phone_confirmed_at: user.phone_confirmed_at,
      user_metadata: user.user_metadata,
      profileCompletionStage: user.user_metadata?.profile_completion_stage || 'stage1',
      jwt: token,
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({
      error: 'Token verification failed',
      code: 'TOKEN_EXPIRED',
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        req.user = {
          id: user.id,
          email: user.email,
          phone: user.phone,
          email_confirmed_at: user.email_confirmed_at,
          phone_confirmed_at: user.phone_confirmed_at,
          user_metadata: user.user_metadata,
          profileCompletionStage: user.user_metadata?.profile_completion_stage || 'stage1',
          jwt: token,
        };
      }
    }

    next();
  } catch {
    next();
  }
};

const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  if (!req.user.email_confirmed_at) {
    return res.status(403).json({
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireVerifiedEmail,
};
