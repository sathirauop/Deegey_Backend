const express = require('express');
const {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyPhone,
} = require('../controllers/authController');
const {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  generalLimiter,
} = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerLimiter, register);

router.post('/login', loginLimiter, login);

router.post('/refresh-token', generalLimiter, refreshToken);

router.post('/logout', authenticateToken, logout);

router.post('/forgot-password', passwordResetLimiter, forgotPassword);

router.post('/reset-password', generalLimiter, resetPassword);

router.post('/verify-email', generalLimiter, verifyEmail);

router.post('/verify-phone', generalLimiter, verifyPhone);

router.get('/me', authenticateToken, generalLimiter, (req, res) => {
  const User = require('../models/User');
  const userModel = new User();
  
  res.json({
    user: userModel.sanitizeForClient(req.user),
  });
});

module.exports = router;
