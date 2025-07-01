const errorHandler = (err, req, res, _next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.details || err.message,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'TOKEN_INVALID',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
  }

  if (err.code === 'SUPABASE_AUTH_ERROR') {
    return res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
      message: err.message,
    });
  }

  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: err.retryAfter,
    });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      error: err.message || 'Client error',
      code: err.code || 'CLIENT_ERROR',
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong',
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
  });
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
