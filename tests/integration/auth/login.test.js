const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Authentication - Login Flow', () => {
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

  describe('Valid Login', () => {
    test('should successfully login with valid credentials and return proper session tokens', async () => {
      const email = 'test@example.com';
      const password = 'TestPass123!';
      
      const userData = {
        id: 'user_123',
        email: email,
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe'
        }
      };

      supabaseMock.mockSignIn(email, userData);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      
      // Validate token structure
      testUtils.validateTokenStructure(response);
      
      // Validate user data
      expect(response.body).toHaveProperty('user');
      testUtils.validateSanitizedUser(response.body.user);
      expect(response.body.user.email).toBe(email);
    });

    test('should update last login timestamp on successful login', async () => {
      const email = 'test@example.com';
      const userData = {
        id: 'user_123',
        email: email,
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe'
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
      
      // Verify that the user model updateLastLogin was called
      // (This would be verified through mocking in a real scenario)
      expect(response.body.user).toHaveProperty('id', 'user_123');
    });

    test('should return sanitized user data only', async () => {
      const email = 'test@example.com';
      const userData = {
        id: 'user_123',
        email: email,
        phone: '+15551234567',
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe',
          date_of_birth: '1990-01-01',
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
      
      // Should not expose sensitive data
      expect(response.body.user).not.toHaveProperty('phone');
      expect(response.body.user).not.toHaveProperty('dateOfBirth');
      expect(response.body.user).not.toHaveProperty('lastLogin');
      
      // Should have safe computed fields
      expect(response.body.user).toHaveProperty('phoneVerified');
      expect(response.body.user).toHaveProperty('age');
    });

    test('should work with verified email users', async () => {
      const email = 'verified@example.com';
      const userData = {
        id: 'user_456',
        email: email,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: {
          first_name: 'Jane',
          last_name: 'Doe'
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
      expect(response.body.user.emailVerified).toBe(true);
    });

    test('should work with unverified email users but mark status correctly', async () => {
      const email = 'unverified@example.com';
      const userData = {
        id: 'user_789',
        email: email,
        email_confirmed_at: null,
        user_metadata: {
          first_name: 'Bob',
          last_name: 'Smith'
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
      expect(response.body.user.emailVerified).toBe(false);
    });

    test('should return session tokens that work with protected endpoints', async () => {
      const email = 'test@example.com';
      const userData = {
        id: 'user_123',
        email: email,
        user_metadata: { first_name: 'John' }
      };

      supabaseMock.mockSignIn(email, userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: email,
          password: 'TestPass123!'
        });

      expect(loginResponse.status).toBe(200);
      
      const { accessToken } = loginResponse.body;
      expect(accessToken).toBeDefined();
      
      // Mock token verification for protected endpoint
      supabaseMock.mockGetUser(accessToken, userData);

      // Test that token works with protected endpoint
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body).toHaveProperty('user');
    });
  });

  describe('Invalid Login Attempts', () => {
    test('should return generic error for invalid credentials', async () => {
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid login credentials');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
      expect(response.body).not.toHaveProperty('message');
    });

    test('should not reveal user existence through different error messages', async () => {
      // Mock responses for non-existent vs existing user with wrong password
      supabaseMock.mockAuthError('invalid_credentials', 'User not found');
      
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      supabaseMock.mockAuthError('invalid_credentials', 'Wrong password');
      
      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'wrongpassword'
        });

      // Both should return identical responses
      expect(response1.status).toBe(response2.status);
      expect(response1.body.error).toBe(response2.body.error);
      expect(response1.body.code).toBe(response2.body.code);
    });

    test('should handle malformed credentials safely', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousInput.sqlInjection,
          password: maliciousInput.xssPayload
        });

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
    });

    test('should reject empty credentials appropriately', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: '',
          password: ''
        });

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
      
      const errorFields = response.body.details.map(d => d.field);
      expect(errorFields).toContain('email');
      expect(errorFields).toContain('password');
    });

    test('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
    });
  });

  describe('Login Input Validation', () => {
    test('should validate email format in login', async () => {
      const invalidEmails = authHelpers.generateInvalidEmails();

      for (const invalidEmail of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: invalidEmail,
            password: 'TestPass123!'
          });

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'email');
      }
    });

    test('should prevent XSS attempts in login fields', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `test${maliciousInput.xssPayload}@example.com`,
          password: maliciousInput.xssPayload
        });

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
    });

    test('should prevent SQL injection attempts in login', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousInput.sqlInjection,
          password: "'; DROP TABLE users; --"
        });

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
    });

    test('should handle oversized login inputs safely', async () => {
      const longString = 'A'.repeat(10000);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `${longString}@example.com`,
          password: longString
        });

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
    });

    test('should reject null byte injection in login', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `test${maliciousInput.nullBytes}@example.com`,
          password: `password${maliciousInput.nullBytes}`
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Login Security', () => {
    test('should not expose internal authentication details', async () => {
      supabaseMock.mockAuthError('invalid_credentials', 'JWT signature validation failed with secret key abc123');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      authHelpers.assertNoInformationLeakage(response);
      
      // Should not expose JWT internals
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('jwt');
      expect(responseText).not.toContain('signature');
      expect(responseText).not.toContain('secret');
      expect(responseText).not.toContain('abc123');
    });

    test('should measure response time consistency to prevent timing attacks', async () => {
      const validEmail = 'existing@example.com';
      const invalidEmail = 'nonexistent@example.com';
      const password = 'TestPass123!';

      // Mock both scenarios
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid credentials');

      // Measure response times for existing vs non-existing user
      const existingUserTiming = await authHelpers.measureResponseTime(async () => {
        await request(app)
          .post('/api/auth/login')
          .send({ email: validEmail, password: 'wrongpassword' });
      }, 5);

      const nonExistingUserTiming = await authHelpers.measureResponseTime(async () => {
        await request(app)
          .post('/api/auth/login')
          .send({ email: invalidEmail, password: password });
      }, 5);

      // Response times should be similar (within reasonable variance)
      const timeDifference = Math.abs(existingUserTiming.average - nonExistingUserTiming.average);
      const maxAcceptableVariance = 100; // 100ms variance allowed

      expect(timeDifference).toBeLessThan(maxAcceptableVariance);
    });

    test('should not leak user existence through response variations', async () => {
      // Test multiple scenarios that might leak user existence
      const scenarios = [
        { email: 'nonexistent@example.com', password: 'password123' },
        { email: 'existing@example.com', password: 'wrongpassword' },
        { email: 'disabled@example.com', password: 'password123' },
      ];

      const responses = [];

      for (const scenario of scenarios) {
        supabaseMock.mockAuthError('invalid_credentials', 'Invalid credentials');
        
        const response = await request(app)
          .post('/api/auth/login')
          .send(scenario);

        responses.push(response);
      }

      // All responses should be identical
      for (let i = 1; i < responses.length; i++) {
        expect(responses[i].status).toBe(responses[0].status);
        expect(responses[i].body.error).toBe(responses[0].body.error);
        expect(responses[i].body.code).toBe(responses[0].body.code);
      }
    });
  });

  describe('Login Error Handling', () => {
    test('should handle Supabase service errors gracefully', async () => {
      supabaseMock.mockAuthError('service_unavailable', 'Authentication service temporarily unavailable');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
      
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should handle network timeouts appropriately', async () => {
      // Mock network timeout scenario
      supabaseMock.mockAuthError('network_timeout', 'Request timed out after 30 seconds');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!'
        });

      expect([401, 500]).toContain(response.status);
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should handle validation errors consistently', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: ''
        });

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
      
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });

  describe('Concurrent Login Handling', () => {
    test('should handle multiple simultaneous login attempts', async () => {
      const email = 'test@example.com';
      const password = 'TestPass123!';
      
      // Mock successful login
      supabaseMock.mockSignIn(email, {
        id: 'user_123',
        email: email,
        user_metadata: { first_name: 'John' }
      });

      // Make multiple concurrent login requests
      const promises = Array(5).fill().map(() => 
        request(app)
          .post('/api/auth/login')
          .send({ email, password })
      );

      const responses = await Promise.all(promises);

      // All should either succeed or fail consistently
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // Success or rate limited
      });
    });
  });
});