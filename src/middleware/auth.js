const { verifyToken } = require('../utils/jwt');
const { supabase } = require('../config/database');
const { isBlacklisted } = require('../utils/tokenBlacklist');

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

    if (isBlacklisted(token)) {
      return res.status(401).json({
        error: 'Token has been invalidated',
        code: 'TOKEN_BLACKLISTED',
      });
    }

    const decoded = verifyToken(token);

    const { data: user, error } = await supabase
      .from('auth.users')
      .select('id, email, email_confirmed_at')
      .eq('id', decoded.sub)
      .single();

    if (error || !user) {
      return res.status(401).json({
        error: 'Invalid token or user not found',
        code: 'TOKEN_INVALID',
      });
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      ...user,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Token verification failed',
      code: 'TOKEN_EXPIRED',
      message: error.message,
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
      };
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
