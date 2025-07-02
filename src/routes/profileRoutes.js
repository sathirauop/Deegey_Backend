const express = require('express');
const {
  createProfile,
  updateProfile,
  getProfile,
  getProfileCompletion,
  getPublicProfile,
} = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Protected profile routes
router.post('/', authenticateToken, createProfile);
router.put('/', authenticateToken, updateProfile);
router.get('/', authenticateToken, getProfile);
router.get('/completion', authenticateToken, getProfileCompletion);

// Public profile route
router.get('/public/:userId', getPublicProfile);

module.exports = router;
