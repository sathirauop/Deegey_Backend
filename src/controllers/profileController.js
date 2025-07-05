const User = require('../models/User');
const Profile = require('../models/Profile');
const { createAuthenticatedClient } = require('../utils/auth');

const createProfile = async (req, res) => {
  try {
    const profileData = { ...req.body, userId: req.user.id };
    const authenticatedClient = createAuthenticatedClient(req.user.jwt);
    const profileModel = new Profile(authenticatedClient);

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

const updateProfileStage = async (req, res) => {
  try {
    const { stage } = req.params;
    const validStages = ['stage-1', 'stage-2', 'stage-3', 'stage-4'];
    
    if (!validStages.includes(stage)) {
      return res.status(400).json({
        error: 'Invalid stage',
        code: 'INVALID_STAGE',
      });
    }

    const authenticatedClient = createAuthenticatedClient(req.user.jwt);
    const profileModel = new Profile(authenticatedClient);
    const userModel = new User();

    // Check if profile exists, create if not
    let profile = await profileModel.findByUserId(req.user.id);
    if (!profile) {
      // Create basic profile if it doesn't exist
      profile = await profileModel.createProfile({
        userId: req.user.id,
        maritalStatus: 'single',
        education: 'bachelors',
        occupation: 'other',
        height: 170,
        motherTongue: 'english',
      });
    }

    // Validate stage-specific data
    let validatedData;
    switch (stage) {
      case 'stage-1':
        validatedData = Profile.validate(req.body, 'stage1');
        break;
      case 'stage-2':
        validatedData = Profile.validate(req.body, 'stage2');
        break;
      case 'stage-3':
        validatedData = Profile.validate(req.body, 'stage3');
        break;
      case 'stage-4':
        validatedData = Profile.validate(req.body, 'stage4');
        break;
    }

    // Update profile with stage data
    const updatedProfile = await profileModel.updateProfile(
      req.user.id,
      validatedData
    );

    // Update user registration step based on stage completed
    let registrationStep;
    switch (stage) {
      case 'stage-1':
        registrationStep = 'profile_stage_1';
        break;
      case 'stage-2':
        registrationStep = 'profile_stage_2';
        break;
      case 'stage-3':
        registrationStep = 'profile_stage_3';
        break;
      case 'stage-4':
        // Only mark as complete if completion percentage is high enough
        registrationStep = updatedProfile.completionPercentage >= 80 ? 'profile_complete' : 'profile_stage_4';
        break;
      default:
        registrationStep = 'profile_stage_1';
    }

    await userModel.updateRegistrationStep(req.user.id, registrationStep);

    res.json({
      message: `Profile ${stage} updated successfully`,
      profile: updatedProfile,
      registrationStep,
      nextStage: getNextStage(stage, updatedProfile.completionPercentage),
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

const getProfileStage = async (req, res) => {
  try {
    const { stage } = req.params;
    const validStages = ['stage-1', 'stage-2', 'stage-3', 'stage-4'];
    
    if (!validStages.includes(stage)) {
      return res.status(400).json({
        error: 'Invalid stage',
        code: 'INVALID_STAGE',
      });
    }

    const profileModel = new Profile();
    const profile = await profileModel.findByUserId(req.user.id);

    if (!profile) {
      return res.status(404).json({
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND',
        message: 'Please start profile completion first',
      });
    }

    const stageData = getStageData(profile, stage);
    const completion = await profileModel.getProfileCompletion(req.user.id);

    res.json({
      stage,
      data: stageData,
      completion,
      nextStage: getNextStage(stage, completion.completionPercentage),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const getNextStage = (currentStage, completionPercentage) => {
  const stages = ['stage-1', 'stage-2', 'stage-3', 'stage-4'];
  const currentIndex = stages.indexOf(currentStage);
  
  // Always progress to next sequential stage, regardless of completion percentage
  // Only return 'profile_complete' when we've completed the final stage
  if (currentIndex < stages.length - 1) {
    return stages[currentIndex + 1];
  }
  
  // Only after stage-4, check if profile is complete
  if (currentStage === 'stage-4' && completionPercentage >= 80) {
    return 'profile_complete';
  }
  
  return null;
};

const getStageData = (profile, stage) => {
  const baseData = {
    id: profile.id,
    userId: profile.userId,
    completionPercentage: profile.completionPercentage,
    isComplete: profile.isComplete,
  };

  switch (stage) {
    case 'stage-1':
      return {
        ...baseData,
        maritalStatus: profile.maritalStatus,
        education: profile.education,
        occupation: profile.occupation,
        height: profile.height,
        motherTongue: profile.motherTongue,
      };
    case 'stage-2':
      return {
        ...baseData,
        aboutMe: profile.aboutMe,
        familyDetails: profile.familyDetails,
        workLocation: profile.workLocation,
        immigrationStatus: profile.immigrationStatus,
        income: profile.income,
        bodyType: profile.bodyType,
        weight: profile.weight,
        complexion: profile.complexion,
      };
    case 'stage-3':
      return {
        ...baseData,
        dietaryPreference: profile.dietaryPreference,
        familyValues: profile.familyValues,
        smokingHabits: profile.smokingHabits,
        drinkingHabits: profile.drinkingHabits,
        partnerExpectations: profile.partnerExpectations,
        willingToRelocate: profile.willingToRelocate,
        hobbies: profile.hobbies,
        interests: profile.interests,
      };
    case 'stage-4':
      return {
        ...baseData,
        primaryPhotoUrl: profile.primaryPhotoUrl,
        profilePhotos: profile.profilePhotos,
        isPublic: profile.isPublic,
        isVerified: profile.isVerified,
      };
    default:
      return baseData;
  }
};

module.exports = {
  createProfile,
  updateProfile,
  getProfile,
  getProfileCompletion,
  getPublicProfile,
  updateProfileStage,
  getProfileStage,
};
