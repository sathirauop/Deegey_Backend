const User = require('../models/User');
const Profile = require('../models/Profile');
const { createAuthenticatedClient } = require('../utils/auth');
const { validatePhotoUrl, sanitizeText } = require('../middleware/security');

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

    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const profileModel = new Profile();
    
    // Validate input data
    const validatedData = Profile.validate(req.body, 'update');
    
    // Sanitize text fields
    if (validatedData.aboutMe) {
      validatedData.aboutMe = sanitizeText(validatedData.aboutMe);
    }
    if (validatedData.familyDetails) {
      validatedData.familyDetails = sanitizeText(validatedData.familyDetails);
    }
    if (validatedData.partnerExpectations) {
      validatedData.partnerExpectations = sanitizeText(validatedData.partnerExpectations);
    }
    if (validatedData.occupation) {
      validatedData.occupation = sanitizeText(validatedData.occupation);
    }
    
    // Validate photo URLs
    try {
      if (validatedData.primaryPhotoUrl) {
        validatePhotoUrl(validatedData.primaryPhotoUrl);
      }
      if (validatedData.profilePhotos && Array.isArray(validatedData.profilePhotos)) {
        validatedData.profilePhotos.forEach(url => validatePhotoUrl(url));
      }
    } catch {
      return res.status(400).json({
        error: 'Invalid photo URL',
        code: 'INVALID_PHOTO_URL',
      });
    }
    
    const updatedProfile = await profileModel.updateProfile(
      req.user.id,
      validatedData
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

    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
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
    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const getProfileCompletion = async (req, res) => {
  try {
    const profileModel = new Profile();
    const completion = await profileModel.getProfileCompletion(req.user.id);

    res.json(completion);
  } catch (error) {
    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
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
    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const submitInitialProfile = async (req, res) => {
  try {
    const { skipCompletion = false, ...profileData } = req.body;
    const userModel = new User();
    
    // Check if user has already completed minimal profile
    const minimalCompletion = await userModel.getMinimalProfileCompletion(req.user.id);
    if (minimalCompletion) {
      return res.status(400).json({
        error: 'Initial profile already submitted',
        code: 'ALREADY_SUBMITTED',
      });
    }

    const authenticatedClient = createAuthenticatedClient(req.user.jwt);
    const profileModel = new Profile(authenticatedClient);

    // Check if profile exists, create if not
    let profile = await profileModel.findByUserId(req.user.id);
    
    if (!profile) {
      // Extract only the required fields for initial creation with validation
      const createData = {
        userId: req.user.id,
        maritalStatus: profileData.maritalStatus || 'single',
        education: profileData.education || 'bachelors',
        occupation: profileData.occupation || 'other',
        height: profileData.height || 170,
        motherTongue: profileData.motherTongue || 'english',
      };
      
      // Validate creation data
      const validatedCreateData = Profile.validate(createData, 'create');
      profile = await profileModel.createProfile(validatedCreateData);
    }

    // Validate all profile data before update
    const validatedData = Profile.validate(profileData, 'update');
    
    // Sanitize text fields
    if (validatedData.aboutMe) {
      validatedData.aboutMe = sanitizeText(validatedData.aboutMe);
    }
    if (validatedData.familyDetails) {
      validatedData.familyDetails = sanitizeText(validatedData.familyDetails);
    }
    if (validatedData.partnerExpectations) {
      validatedData.partnerExpectations = sanitizeText(validatedData.partnerExpectations);
    }
    if (validatedData.occupation) {
      validatedData.occupation = sanitizeText(validatedData.occupation);
    }
    
    // Validate photo URLs
    try {
      if (validatedData.primaryPhotoUrl) {
        validatePhotoUrl(validatedData.primaryPhotoUrl);
      }
      if (validatedData.profilePhotos && Array.isArray(validatedData.profilePhotos)) {
        validatedData.profilePhotos.forEach(url => validatePhotoUrl(url));
      }
    } catch {
      return res.status(400).json({
        error: 'Invalid photo URL',
        code: 'INVALID_PHOTO_URL',
      });
    }
    
    // Update profile with validated data
    const updatedProfile = await profileModel.updateProfile(req.user.id, validatedData);

    // Set minimal profile completion to true
    await userModel.setMinimalProfileCompletion(req.user.id, true);
    
    // Get completion score
    const completion = await profileModel.getProfileCompletion(req.user.id);

    res.json({
      message: skipCompletion 
        ? 'Profile saved. You can complete it later from the dashboard.'
        : 'Profile submitted successfully!',
      profile: updatedProfile,
      minimalProfileCompletion: true,
      canAccessDashboard: true,
      completionScore: completion.completionPercentage,
      encouragement: getCompletionEncouragement(completion.completionPercentage),
      missingFields: completion.missingFields,
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
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

    const userModel = new User();
    
    // Check if user has completed minimal profile - if so, prevent stage access
    const minimalCompletion = await userModel.getMinimalProfileCompletion(req.user.id);
    if (minimalCompletion) {
      return res.status(403).json({
        error: 'Profile stages are no longer accessible after minimal completion',
        code: 'STAGE_ACCESS_DENIED',
        redirectTo: 'dashboard',
      });
    }

    const authenticatedClient = createAuthenticatedClient(req.user.jwt);
    const profileModel = new Profile(authenticatedClient);

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

    // Validate data using the update schema
    const validatedData = Profile.validate(req.body, 'update');

    // Update profile with stage data
    const updatedProfile = await profileModel.updateProfile(
      req.user.id,
      validatedData
    );

    // Update user profile completion stage based on stage completed
    let profileCompletionStage;
    switch (stage) {
    case 'stage-1':
      profileCompletionStage = 'stage2'; // User completed stage 1, can access stage 2
      break;
    case 'stage-2':
      profileCompletionStage = 'stage3'; // User completed stage 2, can access stage 3
      break;
    case 'stage-3':
      profileCompletionStage = 'stage4'; // User completed stage 3, can access stage 4
      break;
    case 'stage-4':
      profileCompletionStage = 'stage4'; // Stay at stage 4 until explicitly completed
      break;
    default:
      profileCompletionStage = 'stage1';
    }

    await userModel.updateProfileCompletionStage(req.user.id, profileCompletionStage);
    
    // Auto-complete minimal profile after Stage 4
    if (stage === 'stage-4') {
      await userModel.setMinimalProfileCompletion(req.user.id, true);
    }
    
    // Keep registration step for backward compatibility
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
      registrationStep = 'profile_stage_4';
      break;
    default:
      registrationStep = 'profile_stage_1';
    }

    await userModel.updateRegistrationStep(req.user.id, registrationStep);

    const currentMinimalCompletion = await userModel.getMinimalProfileCompletion(req.user.id);
    
    res.json({
      message: `Profile ${stage} updated successfully`,
      profile: updatedProfile,
      registrationStep,
      profileCompletionStage,
      minimalProfileCompletion: currentMinimalCompletion,
      nextStage: currentMinimalCompletion ? 'dashboard' : getNextStage(stage, profileCompletionStage),
      canAccessDashboard: currentMinimalCompletion,
    });
  } catch (error) {
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    }

    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
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

    const userModel = new User();
    
    // Check if user has completed minimal profile - if so, prevent stage access
    const minimalCompletion = await userModel.getMinimalProfileCompletion(req.user.id);
    if (minimalCompletion) {
      return res.status(403).json({
        error: 'Profile stages are no longer accessible after minimal completion',
        code: 'STAGE_ACCESS_DENIED',
        redirectTo: 'dashboard',
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
    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const getNextStage = (currentStage, _profileCompletionStage) => {
  const stageMapping = {
    'stage-1': 'stage-2',
    'stage-2': 'stage-3', 
    'stage-3': 'stage-4',
    'stage-4': null // Stay on stage 4 until explicit completion
  };
  
  return stageMapping[currentStage] || null;
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

const completeProfile = async (req, res) => {
  try {
    const profileModel = new Profile();
    const userModel = new User();

    // Get current profile to check completion percentage
    const profile = await profileModel.findByUserId(req.user.id);
    
    if (!profile) {
      return res.status(404).json({
        error: 'Profile not found',
        code: 'PROFILE_NOT_FOUND',
      });
    }

    // Check if profile has sufficient completion (optional check)
    if (profile.completionPercentage < 50) {
      return res.status(400).json({
        error: 'Profile must be at least 50% complete to finish',
        code: 'INSUFFICIENT_COMPLETION',
        completionPercentage: profile.completionPercentage,
      });
    }

    // Update profile completion stage to completed
    await userModel.updateProfileCompletionStage(req.user.id, 'completed');
    await userModel.updateRegistrationStep(req.user.id, 'profile_complete');
    await userModel.setMinimalProfileCompletion(req.user.id, true);

    // Update profile to mark as complete
    await profileModel.updateProfile(req.user.id, {
      isComplete: true,
    });

    res.json({
      message: 'Profile completed successfully',
      profileCompletionStage: 'completed',
      registrationStep: 'profile_complete',
      minimalProfileCompletion: true,
      nextStage: 'dashboard',
      canAccessDashboard: true,
    });
  } catch (error) {
    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const skipProfileCompletion = async (req, res) => {
  try {
    const userModel = new User();
    const profileModel = new Profile();

    // Check if user has already completed minimal profile
    const minimalCompletion = await userModel.getMinimalProfileCompletion(req.user.id);
    if (minimalCompletion) {
      return res.status(400).json({
        error: 'Minimal profile completion already set',
        code: 'ALREADY_COMPLETED',
        redirectTo: 'dashboard',
      });
    }

    // Get current stage - must be at least stage 3 to skip
    const currentStage = await userModel.getProfileCompletionStage(req.user.id);
    const stageNumber = parseInt(currentStage.replace('stage', ''));
    
    if (stageNumber < 3) {
      return res.status(400).json({
        error: 'Must complete at least Stage 2 before skipping',
        code: 'INSUFFICIENT_PROGRESS',
        currentStage,
        requiredStage: 'stage3',
      });
    }

    // Set minimal profile completion to true
    await userModel.setMinimalProfileCompletion(req.user.id, true);
    await userModel.updateRegistrationStep(req.user.id, 'profile_minimal_complete');

    // Get current profile completion for response
    const completion = await profileModel.getProfileCompletion(req.user.id);

    res.json({
      message: 'Profile completion skipped successfully',
      minimalProfileCompletion: true,
      canAccessDashboard: true,
      nextStage: 'dashboard',
      completionScore: completion.completionPercentage,
      encouragement: getCompletionEncouragement(completion.completionPercentage),
    });
  } catch (error) {
    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const getCompletionEncouragement = (score) => {
  if (score < 50) {
    return 'Complete your profile to get better matches!';
  } else if (score < 75) {
    return 'Add photos to increase your visibility!';
  } else if (score < 90) {
    return 'Complete lifestyle preferences for better matching!';
  } else {
    return 'Your profile looks great!';
  }
};

module.exports = {
  createProfile,
  updateProfile,
  getProfile,
  getProfileCompletion,
  getPublicProfile,
  submitInitialProfile,
  updateProfileStage, // Keep temporarily for backward compatibility
  getProfileStage, // Keep temporarily for backward compatibility
  completeProfile, // Keep temporarily for backward compatibility
  skipProfileCompletion, // Keep temporarily for backward compatibility
};
