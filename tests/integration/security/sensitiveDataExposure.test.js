const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Security - Sensitive Data Protection', () => {
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

  describe('User Registration Response', () => {
    test('should not contain full phone numbers in response', async () => {
      const userData = authHelpers.generateValidUser({
        phone: '+15551234567'
      });

      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      
      testUtils.validateSanitizedUser(response.body.user);
      
      // Should not expose full phone number
      expect(response.body.user).not.toHaveProperty('phone');
      expect(JSON.stringify(response.body)).not.toContain('+15551234567');
      
      // Should only have verification status
      expect(response.body.user).toHaveProperty('phoneVerified');
      expect(typeof response.body.user.phoneVerified).toBe('boolean');
    });

    test('should not contain exact birth dates in response', async () => {
      const userData = authHelpers.generateValidUser({
        dateOfBirth: '1990-05-15'
      });

      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.user).not.toHaveProperty('dateOfBirth');
      expect(JSON.stringify(response.body)).not.toContain('1990-05-15');
      
      // Should only have calculated age
      expect(response.body.user).toHaveProperty('age');
      expect(typeof response.body.user.age).toBe('number');
      expect(response.body.user.age).toBeGreaterThan(0);
    });

    test('should not contain raw session objects', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      // Should not have full session object
      expect(response.body).not.toHaveProperty('session');
      
      // Should only have essential token fields
      testUtils.validateTokenStructure(response);
      
      // Should not contain session metadata
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('session_id');
      expect(responseText).not.toContain('user_agent');
      expect(responseText).not.toContain('ip_address');
    });

    test('should not contain internal metadata', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      const responseText = JSON.stringify(response.body);
      
      // Should not contain internal Supabase metadata
      expect(responseText).not.toContain('aud');
      expect(responseText).not.toContain('role');
      expect(responseText).not.toContain('aal');
      expect(responseText).not.toContain('amr');
      expect(responseText).not.toContain('session_id');
      expect(responseText).not.toContain('is_anonymous');
      
      // Should not contain database internal fields
      expect(responseText).not.toContain('raw_user_meta_data');
      expect(responseText).not.toContain('raw_app_meta_data');
      expect(responseText).not.toContain('instance_id');
      expect(responseText).not.toContain('updated_at');
    });

    test('should not expose last login times', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.user).not.toHaveProperty('lastLogin');
      expect(response.body.user).not.toHaveProperty('last_login');
      expect(JSON.stringify(response.body)).not.toContain('last_login');
    });
  });

  describe('User Login Response', () => {
    test('should sanitize user data in login response', async () => {
      const email = 'test@example.com';
      const userData = {
        phone: '+15551234567',
        user_metadata: {
          date_of_birth: '1990-05-15',
          last_login: '2024-01-01T10:00:00Z'
        }
      };

      supabaseMock.mockSignIn(email, userData);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: email,
          password: 'TestPass123!'
        });

      expect(response.status).toBe(200);
      testUtils.validateSanitizedUser(response.body.user);
      testUtils.validateTokenStructure(response);
      
      // Should not expose sensitive data
      expect(response.body.user).not.toHaveProperty('phone');
      expect(response.body.user).not.toHaveProperty('dateOfBirth');
      expect(response.body.user).not.toHaveProperty('lastLogin');
    });
  });

  describe('User Profile Endpoint', () => {
    test('/me endpoint should return sanitized user data only', async () => {
      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        phone: '+15551234567',
        user_metadata: {
          date_of_birth: '1990-05-15',
          last_login: '2024-01-01T10:00:00Z',
          first_name: 'Test',
          last_name: 'User'
        }
      };

      const token = 'valid_token_123';
      supabaseMock.mockGetUser(token, userData);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      
      testUtils.validateSanitizedUser(response.body.user);
      
      // Should not expose sensitive fields
      expect(response.body.user).not.toHaveProperty('phone');
      expect(response.body.user).not.toHaveProperty('dateOfBirth');
      expect(response.body.user).not.toHaveProperty('lastLogin');
    });
  });

  describe('Error Responses Data Exposure', () => {
    test('should not contain user enumeration data in error responses', async () => {
      // Test registration with existing email
      const userData = authHelpers.generateValidUser({
        email: 'existing@example.com'
      });

      supabaseMock.mockAuthError('email_already_exists', 'User with email existing@example.com already exists in database table auth.users');

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      
      const responseText = JSON.stringify(response.body);
      // Should not expose the actual email in error
      expect(responseText).not.toContain('existing@example.com');
      expect(responseText).not.toContain('auth.users');
      expect(responseText).not.toContain('database table');
    });

    test('should not expose user IDs in error responses', async () => {
      supabaseMock.mockAuthError('user_not_found', 'User with ID abc123-def456-ghi789 not found in users table');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('abc123-def456-ghi789');
      expect(responseText).not.toContain('users table');
    });
  });

  describe('Token Refresh Response', () => {
    test('should not expose session internals in refresh response', async () => {
      const refreshToken = 'valid_refresh_token';
      supabaseMock.mockRefreshToken(refreshToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      
      // Should only contain essential token data
      testUtils.validateTokenStructure(response);
      
      // Should not contain session internals
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('session_id');
      expect(responseText).not.toContain('provider_token');
      expect(responseText).not.toContain('provider_refresh_token');
    });
  });

  describe('Verification Response Data', () => {
    test('email verification should not expose verification internals', async () => {
      supabaseMock.mockVerifyOtp('email');

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'valid_otp_token' });

      expect(response.status).toBe(200);
      
      testUtils.validateSanitizedUser(response.body.user);
      testUtils.validateTokenStructure(response);
      
      // Should not expose OTP internals
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('otp_hash');
      expect(responseText).not.toContain('confirmation_token');
      expect(responseText).not.toContain('recovery_token');
    });

    test('phone verification should not expose verification internals', async () => {
      supabaseMock.mockVerifyOtp('sms');

      const response = await request(app)
        .post('/api/auth/verify-phone')
        .send({ token: 'valid_sms_token' });

      expect(response.status).toBe(200);
      
      testUtils.validateSanitizedUser(response.body.user);
      testUtils.validateTokenStructure(response);
      
      // Should not expose SMS internals
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('sms_otp');
      expect(responseText).not.toContain('phone_confirmation_token');
      expect(responseText).not.toContain('sms_provider');
    });
  });

  describe('Admin Endpoint Security', () => {
    test('admin endpoints should not be accessible to regular users', async () => {
      const token = 'regular_user_token';
      supabaseMock.mockGetUser(token, { id: 'user_123', role: 'authenticated' });

      // Try to access a potential admin endpoint
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);

      // Should return 404 (endpoint not found) or 403 (forbidden)
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Pagination and Bulk Data', () => {
    test('should not expose bulk user data without proper authorization', async () => {
      const token = 'regular_user_token';
      supabaseMock.mockGetUser(token, { id: 'user_123' });

      // Try to access bulk user data
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      // Should either not exist or be properly protected
      if (response.status === 200) {
        // If endpoint exists, it should not return other users' data
        expect(response.body).not.toHaveProperty('users');
        expect(Array.isArray(response.body)).toBe(false);
      } else {
        expect([403, 404]).toContain(response.status);
      }
    });
  });
});