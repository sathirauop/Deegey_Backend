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
} = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerLimiter, register);

router.post('/login', loginLimiter, login);

router.post('/refresh-token', refreshToken);

router.post('/logout', authenticateToken, logout);

router.post('/forgot-password', passwordResetLimiter, forgotPassword);

router.post('/reset-password', resetPassword);

router.post('/verify-email', verifyEmail);

router.post('/verify-phone', verifyPhone);

router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: req.user,
  });
});

module.exports = router;
