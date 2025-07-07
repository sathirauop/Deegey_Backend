const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Authentication - Registration Flow', () => {
  let supabaseMock;
  let authHelpers;

  beforeEach(() => {
    supabaseMock = new SupabaseMock();
    authHelpers = new AuthHelpers(app);
    supabaseMock.setupDefaultMocks();
  });

  afterEach(() => {
    supabaseMock.clearMocks();
  });

  describe('Valid Registration', () => {
    test('should successfully register with valid data and return correct token structure', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Registration successful');
      
      // Validate token structure
      testUtils.validateTokenStructure(response);
      
      // Validate user data
      expect(response.body).toHaveProperty('user');
      testUtils.validateSanitizedUser(response.body.user);
      
      // Check registration flow fields
      expect(response.body).toHaveProperty('registrationStep', 'basic');
      expect(response.body).toHaveProperty('profileCompletionStage', 'stage1');
      expect(response.body).toHaveProperty('nextSteps');
      expect(Array.isArray(response.body.nextSteps)).toBe(true);
      expect(response.body.nextSteps).toContain('Verify email address');
      expect(response.body.nextSteps).toContain('Verify phone number');
    });

    test('should create user in Supabase with correct metadata', async () => {
      const userData = authHelpers.generateValidUser({
        firstName: 'John',
        lastName: 'Doe',
        gender: 'male',
        religion: 'buddhist',
        country: 'Sri Lanka'
      });

      // Capture the Supabase request
      const supabaseSignUpMock = supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      // Verify the request was made to Supabase with correct data
      expect(supabaseSignUpMock.isDone()).toBe(true);
      
      // Verify user metadata in response
      expect(response.body.user.firstName).toBe('John');
      expect(response.body.user.lastName).toBe('Doe');
      expect(response.body.user.gender).toBe('male');
      expect(response.body.user.religion).toBe('buddhist');
      expect(response.body.user.country).toBe('Sri Lanka');
    });

    test('should trigger email verification after registration', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.user.emailVerified).toBe(false);
      expect(response.body.nextSteps).toContain('Verify email address');
    });

    test('should trigger phone verification after registration', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.user.phoneVerified).toBe(false);
      expect(response.body.nextSteps).toContain('Verify phone number');
    });

    test('should return only safe user data in response', async () => {
      const userData = authHelpers.generateValidUser({
        phone: '+15551234567',
        dateOfBirth: '1990-05-15'
      });
      
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      // Should not expose sensitive data
      expect(response.body.user).not.toHaveProperty('phone');
      expect(response.body.user).not.toHaveProperty('dateOfBirth');
      expect(response.body.user).not.toHaveProperty('password');
      
      // Should have safe computed fields
      expect(response.body.user).toHaveProperty('phoneVerified');
      expect(response.body.user).toHaveProperty('age');
    });

    test('should return valid tokens that work with protected endpoints', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      
      const { accessToken } = registerResponse.body;
      expect(accessToken).toBeDefined();
      
      // Mock the token verification for /me endpoint
      supabaseMock.mockGetUser(accessToken, {
        id: 'user_123',
        email: userData.email,
        user_metadata: userData
      });

      // Test that token works with protected endpoint
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body).toHaveProperty('user');
    });
  });

  describe('Duplicate Registration Prevention', () => {
    test('should fail registration with existing email appropriately', async () => {
      const userData = authHelpers.generateValidUser({
        email: 'existing@example.com'
      });

      // Mock existing user check
      supabaseMock.mockAuthError('user_already_exists', 'User already registered');

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User with this email already exists');
      expect(response.body).toHaveProperty('code', 'EMAIL_EXISTS');
      
      // Should not expose internal details
      expect(response.body).not.toHaveProperty('message');
    });

    test('should fail registration with existing phone appropriately', async () => {
      const userData = authHelpers.generateValidUser({
        phone: '+15551234567'
      });

      supabaseMock.mockAuthError('phone_already_exists', 'Phone already registered');

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User with this phone number already exists');
      expect(response.body).toHaveProperty('code', 'PHONE_EXISTS');
    });

    test('should check for existing email before creating user', async () => {
      const userData = authHelpers.generateValidUser({
        email: 'existing@example.com'
      });

      // Mock the user lookup to return existing user
      supabaseMock.mockSignUp({
        ...userData,
        id: 'existing_user_123'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Should prevent duplicate registration
      expect([409, 400]).toContain(response.status);
    });

    test('should check for existing phone before creating user', async () => {
      const userData = authHelpers.generateValidUser({
        phone: '+15551234567'
      });

      supabaseMock.mockSignUp({
        ...userData,
        id: 'existing_user_456'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect([409, 400]).toContain(response.status);
    });
  });

  describe('Registration Validation', () => {
    test('should validate all required fields are present', async () => {
      const incompleteData = {
        email: 'test@example.com',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
      
      // Should have validation errors for missing fields
      const errorFields = response.body.details.map(d => d.field);
      expect(errorFields).toContain('password');
      expect(errorFields).toContain('firstName');
      expect(errorFields).toContain('lastName');
    });

    test('should validate email format', async () => {
      const userData = authHelpers.generateValidUser({
        email: 'invalid-email-format'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response, 'email');
    });

    test('should validate password complexity requirements', async () => {
      const weakPasswords = authHelpers.generateWeakPasswords();

      for (const weakPassword of weakPasswords) {
        const userData = authHelpers.generateValidUser({
          password: weakPassword
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'password');
      }
    });

    test('should validate phone number format', async () => {
      const invalidPhones = authHelpers.generateInvalidPhones();

      for (const invalidPhone of invalidPhones) {
        const userData = authHelpers.generateValidUser({
          phone: invalidPhone
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'phone');
      }
    });

    test('should validate name fields for XSS attempts', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();
      
      const userData = authHelpers.generateValidUser({
        firstName: maliciousInput.xssPayload,
        lastName: maliciousInput.sqlInjection
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
    });

    test('should validate enum fields (gender, religion)', async () => {
      const userData = authHelpers.generateValidUser({
        gender: 'invalid_gender',
        religion: 'invalid_religion'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
      
      const errorFields = response.body.details.map(d => d.field);
      expect(errorFields).toContain('gender');
      expect(errorFields).toContain('religion');
    });

    test('should validate date format for dateOfBirth', async () => {
      const userData = authHelpers.generateValidUser({
        dateOfBirth: 'invalid-date'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response, 'dateOfBirth');
    });

    test('should reject future dates for dateOfBirth', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const userData = authHelpers.generateValidUser({
        dateOfBirth: futureDate.toISOString().split('T')[0]
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response, 'dateOfBirth');
    });

    test('should reject very old dates for dateOfBirth', async () => {
      const userData = authHelpers.generateValidUser({
        dateOfBirth: '1900-01-01'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response, 'dateOfBirth');
    });
  });

  describe('Registration Security', () => {
    test('should sanitize input to prevent XSS', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();
      
      const userData = authHelpers.generateValidUser({
        firstName: 'John<script>alert("xss")</script>',
        city: maliciousInput.xssPayload
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Should either reject malicious input or sanitize it
      if (response.status === 201) {
        expect(response.body.user.firstName).not.toContain('<script>');
        expect(response.body.user.city).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });

    test('should prevent SQL injection attempts', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();
      
      const userData = authHelpers.generateValidUser({
        email: maliciousInput.sqlInjection,
        firstName: "'; DROP TABLE users; --"
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Should reject SQL injection attempts
      expect(response.status).toBe(400);
    });

    test('should handle oversized input gracefully', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();
      
      const userData = authHelpers.generateValidUser({
        firstName: maliciousInput.longString,
        city: 'A'.repeat(10000)
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
    });

    test('should reject null byte injection attempts', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();
      
      const userData = authHelpers.generateValidUser({
        firstName: `John${maliciousInput.nullBytes}Doe`,
        email: `test${maliciousInput.nullBytes}@example.com`
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
    });
  });

  describe('Registration Error Handling', () => {
    test('should handle Supabase service errors gracefully', async () => {
      const userData = authHelpers.generateValidUser();
      
      // Mock Supabase service error
      supabaseMock.mockAuthError('service_unavailable', 'Supabase service temporarily unavailable');

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Registration failed');
      expect(response.body).toHaveProperty('code');
      expect(response.body).not.toHaveProperty('message');
      
      // Should not expose service details
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should handle network timeouts appropriately', async () => {
      const userData = authHelpers.generateValidUser();
      
      // This would require more sophisticated mocking
      // For now, verify that errors are handled consistently
      supabaseMock.mockAuthError('network_error', 'Request timeout');

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect([400, 500]).toContain(response.status);
      authHelpers.assertNoInformationLeakage(response);
    });
  });
});