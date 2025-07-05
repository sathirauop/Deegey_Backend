const BaseModel = require('./BaseModel');
const Joi = require('joi');

class User extends BaseModel {
  constructor() {
    super('auth.users');
  }

  async findById(id) {
    try {
      const { data, error } = await this.adminDb.auth.admin.getUserById(id);
      if (error) throw error;
      return data.user;
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  static get validationSchema() {
    return {
      register: Joi.object({
        email: Joi.string().email().required().messages({
          'string.email': 'Please provide a valid email address',
          'any.required': 'Email is required',
        }),
        password: Joi.string()
          .min(8)
          .pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
          )
          .required()
          .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base':
              'Password must contain uppercase, lowercase, number and special character',
            'any.required': 'Password is required',
          }),
        firstName: Joi.string()
          .trim()
          .min(2)
          .max(50)
          .pattern(/^[a-zA-Z\s]+$/)
          .required()
          .messages({
            'string.min': 'First name must be at least 2 characters',
            'string.max': 'First name cannot exceed 50 characters',
            'string.pattern.base':
              'First name can only contain letters and spaces',
            'any.required': 'First name is required',
          }),
        lastName: Joi.string()
          .trim()
          .min(2)
          .max(50)
          .pattern(/^[a-zA-Z\s]+$/)
          .required()
          .messages({
            'string.min': 'Last name must be at least 2 characters',
            'string.max': 'Last name cannot exceed 50 characters',
            'string.pattern.base':
              'Last name can only contain letters and spaces',
            'any.required': 'Last name is required',
          }),
        phone: Joi.string()
          .pattern(/^\+?[1-9]\d{1,14}$/)
          .required()
          .messages({
            'string.pattern.base': 'Please provide a valid phone number',
            'any.required': 'Phone number is required',
          }),
        dateOfBirth: Joi.date()
          .max('now')
          .min('1950-01-01')
          .required()
          .messages({
            'date.max': 'Date of birth cannot be in the future',
            'date.min': 'Date of birth must be after 1950',
            'any.required': 'Date of birth is required',
          }),
        gender: Joi.string()
          .valid('male', 'female', 'other')
          .required()
          .messages({
            'any.only': 'Gender must be male, female, or other',
            'any.required': 'Gender is required',
          }),
        religion: Joi.string()
          .valid(
            'buddhist',
            'hindu',
            'christian',
            'muslim',
            'catholic',
            'other'
          )
          .required()
          .messages({
            'any.only':
              'Religion must be one of: Buddhist, Hindu, Christian, Muslim, Catholic, Other',
            'any.required': 'Religion is required',
          }),
        country: Joi.string().min(2).max(100).required().messages({
          'string.min': 'Country must be at least 2 characters',
          'string.max': 'Country cannot exceed 100 characters',
          'any.required': 'Country is required',
        }),
        livingCountry: Joi.string().min(2).max(100).required().messages({
          'string.min': 'Living country must be at least 2 characters',
          'string.max': 'Living country cannot exceed 100 characters',
          'any.required': 'Living country is required',
        }),
        state: Joi.string().min(2).max(100).optional().messages({
          'string.min': 'State must be at least 2 characters',
          'string.max': 'State cannot exceed 100 characters',
        }),
        city: Joi.string().min(2).max(100).required().messages({
          'string.min': 'City must be at least 2 characters',
          'string.max': 'City cannot exceed 100 characters',
          'any.required': 'City is required',
        }),
      }),

      login: Joi.object({
        email: Joi.string().email().required().messages({
          'string.email': 'Please provide a valid email address',
          'any.required': 'Email is required',
        }),
        password: Joi.string().required().messages({
          'any.required': 'Password is required',
        }),
      }),

      forgotPassword: Joi.object({
        email: Joi.string().email().required().messages({
          'string.email': 'Please provide a valid email address',
          'any.required': 'Email is required',
        }),
      }),

      resetPassword: Joi.object({
        token: Joi.string().required().messages({
          'any.required': 'Reset token is required',
        }),
        password: Joi.string()
          .min(8)
          .pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
          )
          .required()
          .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base':
              'Password must contain uppercase, lowercase, number and special character',
            'any.required': 'Password is required',
          }),
      }),
    };
  }

  async findByEmail(email) {
    try {
      const { data, error } = await this.adminDb.auth.admin.listUsers();
      if (error) throw error;

      const user = data.users.find(u => u.email === email);
      return user || null;
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  async findByPhone(phone) {
    try {
      const { data, error } = await this.adminDb.auth.admin.listUsers();
      if (error) throw error;

      const user = data.users.find(
        (u) => u.user_metadata?.phone === phone || u.phone === phone
      );
      return user || null;
    } catch (error) {
      throw new Error(`Error finding user by phone: ${error.message}`);
    }
  }

  async createWithSupabase(userData) {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        dateOfBirth,
        gender,
        religion,
        country,
        livingCountry,
        state,
        city,
      } = userData;

      const { data: authUser, error: authError } =
        await this.adminDb.auth.admin.createUser({
          email,
          password,
          phone,
          email_confirm: false,
          phone_confirm: false,
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            date_of_birth: dateOfBirth,
            gender,
            religion,
            country,
            living_country: livingCountry,
            state,
            city,
            registration_step: 'basic',
            account_status: 'active',
          },
        });

      if (authError) {
        throw authError;
      }

      return {
        id: authUser.user.id,
        email: authUser.user.email,
        phone: authUser.user.phone,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        religion,
        country,
        livingCountry,
        state,
        city,
        emailVerified: false,
        phoneVerified: false,
        registrationStep: 'basic',
        accountStatus: 'active',
        createdAt: authUser.user.created_at,
      };
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  async updateRegistrationStep(userId, step) {
    try {
      const { error } = await this.adminDb.auth.admin.updateUserById(userId, {
        user_metadata: {
          registration_step: step,
        },
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Error updating registration step: ${error.message}`);
    }
  }

  async updateLastLogin(userId) {
    try {
      const { data: currentUser, error: getUserError } = await this.adminDb.auth.admin.getUserById(userId);
      
      if (getUserError) {
        throw getUserError;
      }

      const { error } = await this.adminDb.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...currentUser.user.user_metadata,
          last_login: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Error updating last login: ${error.message}`);
    }
  }

  async verifyEmail(userId) {
    try {
      const { error } = await this.adminDb.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Error verifying email: ${error.message}`);
    }
  }

  async verifyPhone(userId) {
    try {
      const { error } = await this.adminDb.auth.admin.updateUserById(userId, {
        phone_confirm: true,
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Error verifying phone: ${error.message}`);
    }
  }

  async updatePassword(userId, newPassword) {
    try {
      const { error } = await this.adminDb.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }

  async deleteUser(userId) {
    try {
      const { error } = await this.adminDb.auth.admin.deleteUser(userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  async getUserStats() {
    try {
      const { data, error } = await this.adminDb.auth.admin.listUsers();
      if (error) throw error;

      const totalUsers = data.users.length;
      const verifiedUsers = data.users.filter(
        (u) => u.email_confirmed_at
      ).length;
      const activeUsers = data.users.filter(
        (u) => u.user_metadata?.account_status === 'active'
      ).length;

      return {
        total: totalUsers,
        verified: verifiedUsers,
        unverified: totalUsers - verifiedUsers,
        active: activeUsers,
      };
    } catch (error) {
      throw new Error(`Error getting user stats: ${error.message}`);
    }
  }

  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  sanitizeForClient(user) {
    if (!user) return null;

    const metadata = user.user_metadata || {};

    // Only include safe, non-sensitive user data
    return {
      id: user.id,
      email: user.email,
      // Don't expose full phone number - only verification status
      phoneVerified: !!user.phone_confirmed_at,
      emailVerified: !!user.email_confirmed_at,
      firstName: metadata.first_name,
      lastName: metadata.last_name,
      // Don't expose exact date of birth - only age
      age: metadata.date_of_birth
        ? this.calculateAge(metadata.date_of_birth)
        : null,
      gender: metadata.gender,
      religion: metadata.religion,
      country: metadata.country,
      livingCountry: metadata.living_country,
      state: metadata.state,
      city: metadata.city,
      registrationStep: metadata.registration_step || 'basic',
      accountStatus: metadata.account_status || 'active',
      createdAt: user.created_at,
      // Don't expose exact last login time for privacy
    };
  }

  static validate(data, schema) {
    const validationSchema = User.validationSchema[schema];
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

module.exports = User;
