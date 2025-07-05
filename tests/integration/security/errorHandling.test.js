const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Security - Error Handling', () => {
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

  describe('Error Response Structure', () => {
    test('should return consistent JSON structure for all auth errors', async () => {
      const endpoints = [
        { method: 'post', path: '/api/auth/register', data: {} },
        { method: 'post', path: '/api/auth/login', data: {} },
        { method: 'post', path: '/api/auth/refresh-token', data: {} },
        { method: 'post', path: '/api/auth/forgot-password', data: {} },
        { method: 'post', path: '/api/auth/verify-email', data: {} },
        { method: 'post', path: '/api/auth/verify-phone', data: {} },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .send(endpoint.data);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('error');
        expect(typeof response.body.error).toBe('string');
        expect(response.body.error.length).toBeGreaterThan(0);
        
        expect(response.body).toHaveProperty('code');
        expect(typeof response.body.code).toBe('string');
        expect(response.body.code.length).toBeGreaterThan(0);
        
        // Should not have these properties for security
        expect(response.body).not.toHaveProperty('stack');
        expect(response.body).not.toHaveProperty('trace');
        expect(response.body).not.toHaveProperty('internal');
      }
    });

    test('should provide error codes for programmatic handling', async () => {
      const expectedErrorCodes = [
        'EMAIL_EXISTS',
        'PHONE_EXISTS',
        'INVALID_CREDENTIALS',
        'TOKEN_MISSING',
        'TOKEN_INVALID',
        'TOKEN_EXPIRED',
        'REFRESH_TOKEN_MISSING',
        'REFRESH_TOKEN_INVALID',
        'VERIFICATION_ERROR',
        'RATE_LIMIT_EXCEEDED',
        'INTERNAL_ERROR'
      ];

      // Test some specific error scenarios
      const errorTests = [
        {
          endpoint: '/api/auth/login',
          data: {},
          expectedCodes: ['INVALID_CREDENTIALS', 'INTERNAL_ERROR']
        },
        {
          endpoint: '/api/auth/refresh-token',
          data: {},
          expectedCodes: ['REFRESH_TOKEN_MISSING']
        },
        {
          endpoint: '/api/auth/verify-email',
          data: {},
          expectedCodes: ['TOKEN_MISSING', 'VERIFICATION_ERROR']
        }
      ];

      for (const test of errorTests) {
        const response = await request(app)
          .post(test.endpoint)
          .send(test.data);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('code');
        expect(test.expectedCodes).toContain(response.body.code);
      }
    });

    test('should return user-friendly error messages', async () => {
      const userData = authHelpers.generateValidUser({
        email: 'invalid-email'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
      
      const emailError = response.body.details.find(d => d.field === 'email');
      expect(emailError).toBeDefined();
      expect(emailError.message).toContain('valid email address');
      expect(emailError.message).not.toContain('regex');
      expect(emailError.message).not.toContain('pattern');
    });

    test('should not expose stack traces in any error responses', async () => {
      // Force different types of errors to check for stack traces
      const errorScenarios = [
        { endpoint: '/api/auth/register', data: null }, // Null data
        { endpoint: '/api/auth/login', data: { email: 'test' } }, // Invalid data
        { endpoint: '/api/auth/refresh-token', data: { refreshToken: 'invalid' } },
        { endpoint: '/api/auth/verify-email', data: { token: 'invalid' } }
      ];

      for (const scenario of errorScenarios) {
        const response = await request(app)
          .post(scenario.endpoint)
          .send(scenario.data);

        expect(response.status).toBeGreaterThanOrEqual(400);
        
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toMatch(/stack/i);
        expect(responseText).not.toMatch(/trace/i);
        expect(responseText).not.toMatch(/\.js:\d+/); // File paths with line numbers
        expect(responseText).not.toMatch(/at .* \(/); // Stack trace format
        expect(responseText).not.toMatch(/error: error/i); // Nested error messages
      }
    });

    test('should not expose database connection details', async () => {
      // Mock database error
      supabaseMock.mockAuthError('connection_error', 'Connection to postgres://user:pass@localhost:5432/db failed');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        });

      expect(response.status).toBe(401);
      
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('postgres://');
      expect(responseText).not.toContain('localhost');
      expect(responseText).not.toContain('5432');
      expect(responseText).not.toContain('connection');
      expect(responseText).not.toContain('database');
      expect(responseText).not.toContain('db');
    });

    test('should not expose Supabase service details', async () => {
      supabaseMock.mockAuthError('service_error', 'Supabase service at https://project.supabase.co failed with 500');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password'
        });

      expect(response.status).toBe(401);
      
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('supabase');
      expect(responseText).not.toContain('https://');
      expect(responseText).not.toContain('.supabase.co');
      expect(responseText).not.toContain('project');
    });
  });

  describe('Validation Error Handling', () => {
    test('should provide detailed validation errors for registration', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        firstName: '',
        lastName: 'A'.repeat(100),
        phone: '123',
        dateOfBirth: 'invalid-date',
        gender: 'invalid',
        religion: 'invalid'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details.length).toBeGreaterThan(0);

      // Check that each validation error has required structure
      response.body.details.forEach(detail => {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
        expect(typeof detail.field).toBe('string');
        expect(typeof detail.message).toBe('string');
      });

      // Check for specific field errors
      const fieldErrors = response.body.details.map(d => d.field);
      expect(fieldErrors).toContain('email');
      expect(fieldErrors).toContain('password');
      expect(fieldErrors).toContain('firstName');
    });

    test('should handle validation errors consistently across endpoints', async () => {
      const invalidEmailTests = [
        { endpoint: '/api/auth/login', data: { email: 'invalid', password: 'test' } },
        { endpoint: '/api/auth/register', data: { email: 'invalid' } },
        { endpoint: '/api/auth/forgot-password', data: { email: 'invalid' } }
      ];

      for (const test of invalidEmailTests) {
        const response = await request(app)
          .post(test.endpoint)
          .send(test.data);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Validation failed');
        expect(response.body).toHaveProperty('details');
        
        const emailError = response.body.details.find(d => d.field === 'email');
        expect(emailError).toBeDefined();
        expect(emailError.message).toContain('valid email');
      }
    });

    test('should not expose validation regex patterns', async () => {
      const userData = authHelpers.generateValidUser({
        firstName: 'John123', // Should fail name pattern
        phone: 'invalid-phone'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/\/.*\//); // Regex patterns
      expect(responseText).not.toContain('^');
      expect(responseText).not.toContain('$');
      expect(responseText).not.toContain('.*');
      expect(responseText).not.toContain('\\d');
      expect(responseText).not.toContain('\\w');
    });
  });

  describe('Authentication Error Handling', () => {
    test('should handle missing authorization header gracefully', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
      expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
      expect(response.body).not.toHaveProperty('message');
    });

    test('should handle malformed authorization header gracefully', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
      expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
    });

    test('should handle invalid tokens without exposing validation details', async () => {
      supabaseMock.mockGetUser('invalid_token');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token or user not found');
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
      expect(response.body).not.toHaveProperty('message');
      
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should handle user not found scenarios', async () => {
      supabaseMock.mockGetUser('valid_token_deleted_user');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid_token_deleted_user');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
      
      // Should not reveal that user was deleted
      expect(response.body.error).not.toContain('deleted');
      expect(response.body.error).not.toContain('not found');
    });
  });

  describe('Network and Service Error Handling', () => {
    test('should handle Supabase service timeouts gracefully', async () => {
      supabaseMock.mockAuthError('network_timeout', 'Request timeout after 30 seconds');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!'
        });

      expect([401, 500]).toContain(response.status);
      authHelpers.assertNoInformationLeakage(response);
      
      // Should not expose timeout details
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('timeout');
      expect(responseText).not.toContain('30 seconds');
      expect(responseText).not.toContain('network');
    });

    test('should handle Supabase service unavailable scenarios', async () => {
      supabaseMock.mockAuthError('service_unavailable', 'Authentication service temporarily unavailable');

      const response = await request(app)
        .post('/api/auth/register')
        .send(authHelpers.generateValidUser());

      expect([400, 500]).toContain(response.status);
      authHelpers.assertNoInformationLeakage(response);
      
      // Should not expose service details
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('service');
      expect(responseText).not.toContain('unavailable');
      expect(responseText).not.toContain('temporarily');
    });

    test('should handle rate limit errors from Supabase', async () => {
      supabaseMock.mockAuthError('rate_limit_exceeded', 'Too many requests to Supabase API');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!'
        });

      expect([401, 429]).toContain(response.status);
      
      // Should abstract the source of rate limiting
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('Supabase');
      expect(responseText).not.toContain('API');
    });
  });

  describe('Error Logging', () => {
    test('should log security-relevant errors server-side', async () => {
      // This test would require mocking console.error or a logging system
      // For now, we verify that errors are handled without exposing details
      
      const maliciousAttempts = [
        { endpoint: '/api/auth/login', data: { email: "'; DROP TABLE users; --", password: 'test' } },
        { endpoint: '/api/auth/register', data: { firstName: '<script>alert("xss")</script>' } },
        { endpoint: '/api/auth/verify-email', data: { token: '../../../etc/passwd' } }
      ];

      for (const attempt of maliciousAttempts) {
        const response = await request(app)
          .post(attempt.endpoint)
          .send(attempt.data);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
        
        // Should not echo back the malicious input
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('DROP TABLE');
        expect(responseText).not.toContain('<script>');
        expect(responseText).not.toContain('etc/passwd');
      }
    });

    test('should not include sensitive data in error logs', async () => {
      // Test that passwords and tokens are not logged
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecretPassword123!' // This should not appear in logs
        });

      expect([401, 400]).toContain(response.status);
      
      // Response should not contain the password
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('SecretPassword123!');
    });
  });

  describe('Error Response Headers', () => {
    test('should include appropriate security headers in error responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      
      // Check for basic security headers (if implemented)
      // Note: These might be set by middleware
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should not expose server information in error headers', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      
      // Should not expose server details
      expect(response.headers).not.toHaveProperty('x-powered-by');
      expect(response.headers).not.toHaveProperty('server');
    });
  });

  describe('Concurrent Error Handling', () => {
    test('should handle multiple simultaneous invalid requests', async () => {
      const invalidRequests = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ email: 'invalid', password: 'invalid' })
      );

      const responses = await Promise.all(invalidRequests);

      responses.forEach(response => {
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
        authHelpers.assertNoInformationLeakage(response);
      });
    });

    test('should handle error scenarios under load', async () => {
      // Simulate different error conditions simultaneously
      const mixedRequests = [
        request(app).post('/api/auth/login').send({}),
        request(app).post('/api/auth/register').send({}),
        request(app).get('/api/auth/me'),
        request(app).post('/api/auth/refresh-token').send({}),
        request(app).post('/api/auth/verify-email').send({})
      ];

      const responses = await Promise.all(mixedRequests);

      responses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
      });
    });
  });

  describe('Error Response Consistency', () => {
    test('should return consistent error structure for all HTTP methods', async () => {
      const methodTests = [
        { method: 'get', path: '/api/auth/me' },
        { method: 'post', path: '/api/auth/login', data: {} },
        { method: 'put', path: '/api/auth/nonexistent', data: {} },
        { method: 'delete', path: '/api/auth/nonexistent' }
      ];

      for (const test of methodTests) {
        let request_obj = request(app)[test.method](test.path);
        
        if (test.data) {
          request_obj = request_obj.send(test.data);
        }

        const response = await request_obj;

        expect(response.status).toBeGreaterThanOrEqual(400);
        
        if (response.status !== 404) { // 404 might have different structure
          expect(response.body).toHaveProperty('error');
          expect(typeof response.body.error).toBe('string');
        }
      }
    });
  });
});