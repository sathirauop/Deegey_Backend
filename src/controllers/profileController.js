const User = require('../models/User');
const Profile = require('../models/Profile');

const createProfile = async (req, res) => {
  try {
    const profileData = { ...req.body, userId: req.user.id };
    const profileModel = new Profile();

    // Check if profile already exists
    const existingProfile = await profileModel.findByUserId(req.user.id);
    if (existingProfile) {
      return res.status(409).json({
        error: 'Profile already exists for this user',
        code: 'PROFILE_EXISTS',
      });
    }

    const newProfile = await profileModel.createProfile(profileData);

    // Update user registration step
    const userModel = new User();
    await userModel.updateRegistrationStep(req.user.id, 'profile_complete');

    res.status(201).json({
      message: 'Profile created successfully',
      profile: newProfile,
      registrationStep: 'profile_complete',
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const profileModel = new Profile();
    const updatedProfile = await profileModel.updateProfile(
      req.user.id,
      req.body
    );

    res.json({
      message: 'Profile updated successfully',
      profile: updatedProfile,
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    if (error.message.includes('Profile not found')) {
      return res.status(404).json({
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const profileModel = new Profile();
    const profile = await profileModel.findByUserId(req.user.id);

    if (!profile) {
      return res.status(404).json({
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND',
        message: 'Please complete your profile first',
      });
    }

    res.json({
      profile: profileModel.sanitizeForClient(profile),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const getProfileCompletion = async (req, res) => {
  try {
    const profileModel = new Profile();
    const completion = await profileModel.getProfileCompletion(req.user.id);

    res.json(completion);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const profileModel = new Profile();

    const profile = await profileModel.findByUserId(userId);

    if (!profile || !profile.is_public) {
      return res.status(404).json({
        error: 'Profile not found or not public',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    // Get basic user info
    const userModel = new User();
    const { data: userData } =
      await userModel.adminDb.auth.admin.getUserById(userId);

    if (!userData) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    const sanitizedUser = userModel.sanitizeForClient(userData.user);
    const sanitizedProfile = profileModel.sanitizeForClient(profile);

    // Remove sensitive information for public view
    delete sanitizedUser.email;
    delete sanitizedUser.phone;
    delete sanitizedProfile.income;

    res.json({
      user: sanitizedUser,
      profile: sanitizedProfile,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

module.exports = {
  createProfile,
  updateProfile,
  getProfile,
  getProfileCompletion,
  getPublicProfile,
};
