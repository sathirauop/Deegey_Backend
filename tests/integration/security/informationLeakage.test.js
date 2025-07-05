const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Security - Information Leakage Prevention', () => {
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

  describe('Registration Errors', () => {
    test('should not expose Supabase error details on registration failure', async () => {
      // Mock Supabase to return detailed error
      supabaseMock.mockAuthError('email_already_exists', 'User with this email already exists in auth.users table');

      const userData = authHelpers.generateValidUser();
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Registration failed');
      expect(response.body).toHaveProperty('code');
      expect(response.body).not.toHaveProperty('message');
      
      // Ensure no sensitive information is leaked
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should not expose database connection errors', async () => {
      // Mock database connection error
      supabaseMock.mockAuthError('connection_error', 'Connection to database failed at postgres://user:pass@localhost:5432/db');

      const userData = authHelpers.generateValidUser();
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertNoInformationLeakage(response);
      
      // Should not contain database connection details
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('postgres://');
      expect(responseText).not.toContain('localhost:5432');
      expect(responseText).not.toContain('connection');
    });
  });

  describe('Login Errors', () => {
    test('should not expose internal system info on login failure', async () => {
      supabaseMock.mockAuthError('invalid_credentials', 'JWT token validation failed with error: invalid signature');

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
      
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should not reveal user existence through error messages', async () => {
      // Test with non-existent user
      supabaseMock.mockAuthError('invalid_credentials', 'User not found in database');

      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password'
        });

      // Test with existing user but wrong password
      supabaseMock.mockAuthError('invalid_credentials', 'Password mismatch for user ID 12345');

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'wrongpassword'
        });

      // Both should return identical error responses
      expect(response1.body.error).toBe(response2.body.error);
      expect(response1.body.code).toBe(response2.body.code);
      expect(response1.status).toBe(response2.status);
      
      authHelpers.assertNoInformationLeakage(response1);
      authHelpers.assertNoInformationLeakage(response2);
    });
  });

  describe('Token Refresh Errors', () => {
    test('should not expose session details on refresh failure', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid_token' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token refresh failed');
      expect(response.body).toHaveProperty('code', 'REFRESH_TOKEN_INVALID');
      expect(response.body).not.toHaveProperty('message');
      
      authHelpers.assertNoInformationLeakage(response);
    });
  });

  describe('Verification Errors', () => {
    test('should not expose OTP internal details on email verification failure', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid_otp_token' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email verification failed');
      expect(response.body).toHaveProperty('code', 'VERIFICATION_ERROR');
      expect(response.body).not.toHaveProperty('message');
      
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should not expose OTP internal details on phone verification failure', async () => {
      const response = await request(app)
        .post('/api/auth/verify-phone')
        .send({ token: 'invalid_otp_token' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Phone verification failed');
      expect(response.body).toHaveProperty('code', 'VERIFICATION_ERROR');
      expect(response.body).not.toHaveProperty('message');
      
      authHelpers.assertNoInformationLeakage(response);
    });
  });

  describe('500 Error Handling', () => {
    test('should not expose stack traces in 500 errors', async () => {
      // Mock an internal server error by sending malformed data that causes exception
      const response = await request(app)
        .post('/api/auth/register')
        .send(null); // This should cause an internal error

      if (response.status === 500) {
        expect(response.body).toHaveProperty('error', 'Internal server error');
        expect(response.body).toHaveProperty('code', 'INTERNAL_ERROR');
        expect(response.body).not.toHaveProperty('message');
        expect(response.body).not.toHaveProperty('stack');
        
        authHelpers.assertNoInformationLeakage(response);
      }
    });
  });

  describe('Password Reset Information Leakage', () => {
    test('should not reveal email existence through password reset', async () => {
      supabaseMock.mockPasswordReset();

      // Test with non-existent email
      const response1 = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      // Test with existing email
      const response2 = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'existing@example.com' });

      // Both should return the same success message
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.message).toBe(response2.body.message);
      expect(response1.body.message).toContain('If the email exists');
      
      authHelpers.assertNoInformationLeakage(response1);
      authHelpers.assertNoInformationLeakage(response2);
    });

    test('should handle password reset errors without information disclosure', async () => {
      // Mock password reset failure
      supabaseMock.mockAuthError('rate_limit_exceeded', 'Too many password reset attempts from IP 192.168.1.1');

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      // Should still return success to prevent enumeration
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('If the email exists');
      
      authHelpers.assertNoInformationLeakage(response);
    });
  });

  describe('Authentication Middleware Errors', () => {
    test('should not expose token validation details', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_jwt_token_with_invalid_signature');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token or user not found');
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
      expect(response.body).not.toHaveProperty('message');
      
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should not expose user lookup failures', async () => {
      // Mock user not found scenario
      supabaseMock.mockGetUser('valid_token_but_user_deleted');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid_token_but_user_deleted');

      expect(response.status).toBe(401);
      authHelpers.assertNoInformationLeakage(response);
    });
  });
});