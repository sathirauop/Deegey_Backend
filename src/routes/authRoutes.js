const express = require('express');
const {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
} = require('../controllers/authController');
const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  refreshTokenValidation,
  verifyEmailValidation,
} = require('../middleware/validation');
const {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
} = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerLimiter, registerValidation, register);

router.post('/login', loginLimiter, loginValidation, login);

router.post('/refresh-token', refreshTokenValidation, refreshToken);

router.post('/logout', authenticateToken, logout);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  forgotPasswordValidation,
  forgotPassword
);

router.post('/reset-password', resetPasswordValidation, resetPassword);

router.post('/verify-email', verifyEmailValidation, verifyEmail);

router.get('/me', authenticateToken, (req, res) => {
  res.json({
    user: req.user,
  });
});

module.exports = router;
