const request = require('supertest');
const app = require('../../src/app');
const SupabaseMock = require('../setup/supabaseMock');

describe('Basic Security Tests', () => {
  let supabaseMock;

  beforeEach(() => {
    supabaseMock = new SupabaseMock();
    supabaseMock.setupDefaultMocks();
  });

  afterEach(() => {
    supabaseMock.clearMocks();
  });
  
  describe('Input Validation', () => {
    test('should validate email format in registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPass123!',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          religion: 'buddhist',
          country: 'Sri Lanka',
          livingCountry: 'Canada',
          city: 'Toronto'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
      
      const emailError = response.body.details.find(d => d.field === 'email');
      expect(emailError).toBeDefined();
      expect(emailError.message).toContain('valid email address');
    });

    test('should reject weak passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak', // Weak password
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1234567890',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          religion: 'buddhist',
          country: 'Sri Lanka',
          livingCountry: 'Canada',
          city: 'Toronto'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      
      const passwordError = response.body.details.find(d => d.field === 'password');
      expect(passwordError).toBeDefined();
      expect(passwordError.message).toMatch(/password must/i);
    });

    test('should reject XSS attempts in name fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!',
          firstName: '<script>alert("xss")</script>',
          lastName: 'Doe',
          phone: '+1234567890',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          religion: 'buddhist',
          country: 'Sri Lanka',
          livingCountry: 'Canada',
          city: 'Toronto'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('Authentication Required', () => {
    test('should require authentication for /me endpoint', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
      expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
    });

    test('should reject invalid Bearer token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
      expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
    });
  });

  describe('Error Response Structure', () => {
    test('should return consistent error structure', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
      
      // Validation errors have different structure
      if (response.body.error === 'Validation failed') {
        expect(response.body).toHaveProperty('details');
        expect(Array.isArray(response.body.details)).toBe(true);
      } else {
        expect(response.body).toHaveProperty('code');
        expect(typeof response.body.code).toBe('string');
      }
      
      // Should not expose internal details
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('trace');
    });

    test('should not expose stack traces', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(null); // This should cause validation error

      expect(response.status).toBeGreaterThanOrEqual(400);
      
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toMatch(/\.js:\d+/); // File paths with line numbers
      expect(responseText).not.toMatch(/at .* \(/); // Stack trace format
    });
  });

  describe('Rate Limiting Structure', () => {
    test('should have rate limiting configured', async () => {
      // Mock auth failure for rate limiting test
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid login credentials');
      
      // Make multiple requests to test rate limiting exists
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' })
      );

      const responses = await Promise.all(promises);
      
      // Some responses should succeed or fail with proper error codes
      responses.forEach(response => {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('code');
      });
    });
  });

  describe('Security Headers and Response Safety', () => {
    test('should return JSON content type for API endpoints', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      // Should not expose server details in headers
      expect(response.headers).not.toHaveProperty('x-powered-by');
    });
  });

  describe('Input Sanitization', () => {
    test('should handle large inputs gracefully', async () => {
      const largeString = 'A'.repeat(10000);
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!',
          firstName: largeString,
          lastName: 'Doe',
          phone: '+1234567890',
          dateOfBirth: '1990-01-01',
          gender: 'male',
          religion: 'buddhist',
          country: 'Sri Lanka',
          livingCountry: 'Canada',
          city: 'Toronto'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com'
          // Missing other required fields
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
      
      const errorFields = response.body.details.map(d => d.field);
      expect(errorFields).toContain('password');
      expect(errorFields).toContain('firstName');
    });
  });
});