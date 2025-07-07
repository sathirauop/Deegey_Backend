const express = require('express');
const {
  updateProfile,
  getProfile,
  getProfileCompletion,
  getPublicProfile,
  submitInitialProfile,
} = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Rate limiter for profile submission
const profileSubmitLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 5 profile submissions per window
  message: 'Too many profile submission attempts. Please try again later.',
});

// Protected profile routes
router.get('/', authenticateToken, getProfile);
router.get('/completion', authenticateToken, getProfileCompletion);

// Initial profile submission (replaces all stage endpoints)
router.post('/submit', authenticateToken, profileSubmitLimiter, submitInitialProfile);

// Ongoing profile updates (after minimal completion)
router.put('/', authenticateToken, updateProfile);

// Public profile route
router.get('/public/:userId', getPublicProfile);

module.exports = router;
