const BaseModel = require('./BaseModel');
const Joi = require('joi');

class Profile extends BaseModel {
  constructor(authenticatedClient = null) {
    super('profiles', authenticatedClient);
  }

  static get validationSchema() {
    return {
      create: Joi.object({
        userId: Joi.string().uuid().required().messages({
          'string.guid': 'Invalid user ID format',
          'any.required': 'User ID is required',
        }),
        maritalStatus: Joi.string()
          .valid('single', 'divorced', 'widowed', 'separated')
          .required()
          .messages({
            'any.only':
              'Marital status must be one of: single, divorced, widowed, separated',
            'any.required': 'Marital status is required',
          }),
        education: Joi.string()
          .valid(
            'high_school',
            'diploma',
            'bachelors',
            'masters',
            'phd',
            'professional',
            'other'
          )
          .required()
          .messages({
            'any.only':
              'Education must be one of: high_school, diploma, bachelors, masters, phd, professional, other',
            'any.required': 'Education is required',
          }),
        occupation: Joi.string().min(2).max(100).required().messages({
          'string.min': 'Occupation must be at least 2 characters',
          'string.max': 'Occupation cannot exceed 100 characters',
          'any.required': 'Occupation is required',
        }),
        height: Joi.number().integer().min(120).max(250).required().messages({
          'number.min': 'Height must be at least 120 cm',
          'number.max': 'Height cannot exceed 250 cm',
          'any.required': 'Height is required',
        }),
        motherTongue: Joi.string()
          .valid('sinhala', 'tamil', 'english', 'other')
          .required()
          .messages({
            'any.only':
              'Mother tongue must be one of: sinhala, tamil, english, other',
            'any.required': 'Mother tongue is required',
          }),
      }),

      update: Joi.object({
        maritalStatus: Joi.string()
          .valid('single', 'divorced', 'widowed', 'separated')
          .optional(),
        education: Joi.string()
          .valid(
            'high_school',
            'diploma',
            'bachelors',
            'masters',
            'phd',
            'professional',
            'other'
          )
          .optional(),
        occupation: Joi.string().min(2).max(100).allow(null, '').optional(),
        height: Joi.number().integer().min(120).max(250).allow(null).optional(),
        weight: Joi.number().integer().min(30).max(200).allow(null).optional(),
        bodyType: Joi.string()
          .valid('slim', 'average', 'athletic', 'heavy')
          .allow(null, '')
          .optional(),
        complexion: Joi.string()
          .valid('fair', 'wheatish', 'dusky', 'dark')
          .allow(null, '')
          .optional(),
        motherTongue: Joi.string()
          .valid('sinhala', 'tamil', 'english', 'other')
          .allow(null, '')
          .optional(),
        knownLanguages: Joi.array().items(Joi.string()).allow(null).optional(),
        employmentType: Joi.string()
          .valid(
            'employed',
            'self_employed',
            'business',
            'student',
            'unemployed'
          )
          .allow(null, '')
          .optional(),
        income: Joi.number().integer().min(0).allow(null).optional(),
        workLocation: Joi.object({
          country: Joi.string().min(2).max(100).allow(null, '').optional(),
          state: Joi.string().min(2).max(100).allow(null, '').optional(),
          city: Joi.string().min(2).max(100).allow(null, '').optional(),
        }).allow(null).optional(),
        caste: Joi.string().max(100).allow(null, '').optional(),
        subCaste: Joi.string().max(100).allow(null, '').optional(),
        familyType: Joi.string().valid('nuclear', 'joint').allow(null, '').optional(),
        familyValues: Joi.string()
          .valid('traditional', 'moderate', 'liberal')
          .allow(null, '')
          .optional(),
        dietaryPreference: Joi.string()
          .valid('vegetarian', 'non_vegetarian', 'vegan', 'jain_vegetarian')
          .allow(null, '')
          .optional(),
        smokingHabits: Joi.string()
          .valid('never', 'occasionally', 'regularly')
          .allow(null, '')
          .optional(),
        drinkingHabits: Joi.string()
          .valid('never', 'socially', 'occasionally', 'regularly')
          .allow(null, '')
          .optional(),
        immigrationStatus: Joi.string()
          .valid(
            'citizen',
            'permanent_resident',
            'work_visa',
            'student_visa',
            'other'
          )
          .allow(null, '')
          .optional(),
        willingToRelocate: Joi.boolean().allow(null).optional(),
        aboutMe: Joi.string().max(1000).allow(null, '').optional(),
        familyDetails: Joi.string().max(1000).allow(null, '').optional(),
        partnerExpectations: Joi.string().max(1000).allow(null, '').optional(),
        profilePhotos: Joi.array().items(Joi.string().uri()).allow(null).optional(),
        primaryPhotoUrl: Joi.string().uri().allow(null, '').optional(),
        hobbies: Joi.array().items(Joi.string()).allow(null).optional(),
        interests: Joi.array().items(Joi.string()).allow(null).optional(),
      }),

    };
  }

  async findByUserId(userId) {
    try {
      return await this.findOne({ user_id: userId });
    } catch (error) {
      console.error('Error finding profile by user ID:', error);
      throw new Error('Failed to find profile');
    }
  }

  async createProfile(profileData) {
    try {
      const validatedData = Profile.validate(profileData, 'create');

      const profileRecord = {
        user_id: validatedData.userId,
        marital_status: validatedData.maritalStatus,
        education: validatedData.education,
        occupation: validatedData.occupation,
        height: validatedData.height,
        mother_tongue: validatedData.motherTongue,
        completion_percentage:
          this.calculateCompletionPercentage(validatedData),
        is_complete: false,
        is_verified: false,
        is_public: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await this.create(profileRecord);
      return this.sanitizeForClient(result);
    } catch (error) {
      console.error('Error creating profile:', error);
      throw new Error('Failed to create profile');
    }
  }

  async updateProfile(userId, updateData) {
    try {
      const validatedData = Profile.validate(updateData, 'update');

      const existingProfile = await this.findByUserId(userId);
      if (!existingProfile) {
        throw new Error('Profile not found');
      }

      const updateRecord = {
        ...this.convertToSnakeCase(validatedData),
        updated_at: new Date().toISOString(),
      };

      updateRecord.completion_percentage = this.calculateCompletionPercentage({
        ...existingProfile,
        ...updateRecord,
      });

      updateRecord.is_complete = updateRecord.completion_percentage >= 80;

      const result = await this.update(existingProfile.id, updateRecord);
      return this.sanitizeForClient(result);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error('Failed to update profile');
    }
  }

  async getProfileCompletion(userId) {
    try {
      const profile = await this.findByUserId(userId);
      if (!profile) {
        return {
          completionPercentage: 0,
          isComplete: false,
          missingFields: this.getRequiredFields(),
        };
      }

      const missingFields = this.getMissingFields(profile);
      const completionPercentage = this.calculateCompletionPercentage(profile);

      return {
        completionPercentage,
        isComplete: completionPercentage >= 80,
        missingFields,
        profile: this.sanitizeForClient(profile),
      };
    } catch (error) {
      console.error('Error getting profile completion:', error);
      throw new Error('Failed to get profile completion');
    }
  }

  calculateCompletionPercentage(profileData) {
    // Stage-based scoring system
    const stageFields = {
      stage1: {
        fields: ['marital_status', 'education', 'occupation', 'height', 'mother_tongue'],
        weight: 25
      },
      stage2: {
        fields: ['about_me', 'family_details', 'work_location', 'immigration_status', 'income', 'body_type', 'weight', 'complexion'],
        weight: 25
      },
      stage3: {
        fields: ['dietary_preference', 'family_values', 'smoking_habits', 'drinking_habits', 'partner_expectations', 'willing_to_relocate', 'hobbies', 'interests'],
        weight: 25
      },
      stage4: {
        fields: ['primary_photo_url', 'profile_photos'],
        weight: 25
      }
    };

    let totalScore = 0;

    // Calculate score for each stage
    Object.values(stageFields).forEach(stage => {
      const completedFields = stage.fields.filter(field => {
        const value = profileData[field];
        return value !== null && value !== undefined && value !== '' && 
               !(Array.isArray(value) && value.length === 0);
      }).length;
      
      const stageScore = (completedFields / stage.fields.length) * stage.weight;
      totalScore += stageScore;
    });

    return Math.min(100, Math.max(0, Math.round(totalScore)));
  }

  getMissingFields(profileData) {
    const stageFields = {
      stage1: {
        fields: ['marital_status', 'education', 'occupation', 'height', 'mother_tongue'],
        importance: 'required',
        stage: 'Stage 1'
      },
      stage2: {
        fields: ['about_me', 'family_details', 'immigration_status', 'income'],
        importance: 'important',
        stage: 'Stage 2'
      },
      stage3: {
        fields: ['dietary_preference', 'family_values', 'partner_expectations'],
        importance: 'optional',
        stage: 'Stage 3'
      },
      stage4: {
        fields: ['primary_photo_url'],
        importance: 'important',
        stage: 'Stage 4'
      }
    };

    const missing = [];

    Object.entries(stageFields).forEach(([_stageName, stageData]) => {
      stageData.fields.forEach((field) => {
        const value = profileData[field];
        const isEmpty = !value || value === '' || (Array.isArray(value) && value.length === 0);
        
        if (isEmpty) {
          missing.push({
            field: this.convertToCamelCase(field),
            importance: stageData.importance,
            stage: stageData.stage,
            displayName: this.getFieldDisplayName(field),
          });
        }
      });
    });

    return missing;
  }

  getRequiredFields() {
    return [
      'maritalStatus',
      'education',
      'occupation',
      'height',
      'motherTongue',
    ];
  }

  getFieldDisplayName(field) {
    const displayNames = {
      marital_status: 'Marital Status',
      education: 'Education',
      occupation: 'Occupation',
      height: 'Height',
      mother_tongue: 'Mother Tongue',
      about_me: 'About Me',
      primary_photo_url: 'Profile Photo',
      dietary_preference: 'Dietary Preference',
      family_type: 'Family Type',
      immigration_status: 'Immigration Status',
    };

    return displayNames[field] || field;
  }

  convertToSnakeCase(obj) {
    const converted = {};
    Object.keys(obj).forEach((key) => {
      const snakeKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`
      );
      converted[snakeKey] = obj[key];
    });
    return converted;
  }

  convertToCamelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  sanitizeForClient(profile) {
    if (!profile) return null;

    return {
      id: profile.id,
      userId: profile.user_id,
      maritalStatus: profile.marital_status,
      education: profile.education,
      occupation: profile.occupation,
      height: profile.height,
      weight: profile.weight,
      bodyType: profile.body_type,
      complexion: profile.complexion,
      motherTongue: profile.mother_tongue,
      knownLanguages: profile.known_languages,
      employmentType: profile.employment_type,
      income: profile.income,
      workLocation: profile.work_location,
      caste: profile.caste,
      subCaste: profile.sub_caste,
      familyType: profile.family_type,
      familyValues: profile.family_values,
      dietaryPreference: profile.dietary_preference,
      smokingHabits: profile.smoking_habits,
      drinkingHabits: profile.drinking_habits,
      immigrationStatus: profile.immigration_status,
      willingToRelocate: profile.willing_to_relocate,
      aboutMe: profile.about_me,
      familyDetails: profile.family_details,
      partnerExpectations: profile.partner_expectations,
      profilePhotos: profile.profile_photos,
      primaryPhotoUrl: profile.primary_photo_url,
      hobbies: profile.hobbies,
      interests: profile.interests,
      completionPercentage: profile.completion_percentage,
      isComplete: profile.is_complete,
      isVerified: profile.is_verified,
      isPublic: profile.is_public,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }

  static validate(data, schema) {
    const validationSchema = Profile.validationSchema[schema];
    if (!validationSchema) {
      throw new Error(`Validation schema '${schema}' not found`);
    }

    const { error, value } = validationSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      const validationError = new Error('Validation failed');
      validationError.isValidation = true;
      validationError.details = details;
      throw validationError;
    }

    return value;
  }
}

module.exports = Profile;
