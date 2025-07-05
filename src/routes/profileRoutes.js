const express = require('express');
const {
  createProfile,
  updateProfile,
  getProfile,
  getProfileCompletion,
  getPublicProfile,
  updateProfileStage,
  getProfileStage,
} = require('../controllers/profileController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Protected profile routes
router.post('/', authenticateToken, createProfile);
router.put('/', authenticateToken, updateProfile);
router.get('/', authenticateToken, getProfile);
router.get('/completion', authenticateToken, getProfileCompletion);

// Profile stage routes
router.get('/stages/:stage', authenticateToken, getProfileStage);
router.put('/stages/:stage', authenticateToken, updateProfileStage);

// Public profile route
router.get('/public/:userId', getPublicProfile);

module.exports = router;
