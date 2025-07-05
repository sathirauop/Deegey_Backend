const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Security - Rate Limiting', () => {
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

  describe('Login Rate Limiting', () => {
    test('should rate limit after 5 failed login attempts within 15 minutes', async () => {
      const email = 'test@example.com';
      const wrongPassword = 'wrongpassword';

      // Mock failed authentication for all attempts
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid login credentials');

      const responses = await authHelpers.simulateRateLimit(
        '/api/auth/login',
        { email, password: wrongPassword },
        6, // 6 attempts (5 allowed + 1 to trigger rate limit)
        200 // 200ms delay between attempts
      );

      // First 5 attempts should return 401 (invalid credentials)
      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(401);
        expect(responses[i].body.error).toBe('Invalid credentials');
      }

      // 6th attempt should be rate limited
      expect(responses[5].status).toBe(429);
      authHelpers.assertRateLimitResponse(responses[5]);
      expect(responses[5].body.retryAfter).toBe('15 minutes');
    });

    test('should apply rate limit per IP + email combination', async () => {
      // First email should get rate limited
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid login credentials');

      const responses1 = await authHelpers.simulateRateLimit(
        '/api/auth/login',
        { email: 'user1@example.com', password: 'wrong' },
        6
      );

      expect(responses1[5].status).toBe(429);

      // Different email from same IP should not be rate limited initially
      const response2 = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user2@example.com', password: 'wrong' });

      expect(response2.status).toBe(401); // Should get auth error, not rate limit
      expect(response2.body.error).toBe('Invalid credentials');
    });

    test('should reset counter on successful login', async () => {
      const email = 'test@example.com';
      const correctPassword = 'TestPass123!';
      const wrongPassword = 'wrongpassword';

      // First 4 failed attempts
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid login credentials');
      
      for (let i = 0; i < 4; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email, password: wrongPassword });
        
        expect(response.status).toBe(401);
        await testUtils.sleep(100);
      }

      // Successful login should reset counter
      supabaseMock.mockSignIn(email);
      
      const successResponse = await request(app)
        .post('/api/auth/login')
        .send({ email, password: correctPassword });
      
      expect(successResponse.status).toBe(200);

      // Should be able to make more attempts after successful login
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid login credentials');
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password: wrongPassword });
      
      expect(response.status).toBe(401); // Should not be rate limited
    });

    test('should include proper rate limit headers', async () => {
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid login credentials');

      const responses = await authHelpers.simulateRateLimit(
        '/api/auth/login',
        { email: 'test@example.com', password: 'wrong' },
        6
      );

      const rateLimitedResponse = responses[5];
      expect(rateLimitedResponse.status).toBe(429);
      
      // Check for rate limit headers
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-limit');
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-remaining');
      expect(rateLimitedResponse.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Registration Rate Limiting', () => {
    test('should rate limit after 30 registration attempts per hour per IP', async () => {
      supabaseMock.mockSignUp();

      const responses = [];
      
      // Make 31 registration attempts
      for (let i = 0; i < 31; i++) {
        const userData = authHelpers.generateValidUser({
          email: `test${i}@example.com`
        });
        
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);
        
        responses.push(response);
        
        if (i < 29) {
          expect(response.status).toBe(201);
        }
      }

      // 31st attempt should be rate limited
      expect(responses[30].status).toBe(429);
      authHelpers.assertRateLimitResponse(responses[30]);
      expect(responses[30].body.retryAfter).toBe('1 hour');
    }, 60000); // Increase timeout for this test

    test('should persist rate limit for full hour window', async () => {
      // This test would require time manipulation or long waiting
      // For now, we'll test that the rate limit structure is correct
      
      supabaseMock.mockSignUp();

      // Make enough requests to trigger rate limit
      const responses = [];
      for (let i = 0; i < 31; i++) {
        const userData = authHelpers.generateValidUser({
          email: `test${i}@example.com`
        });
        
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);
        
        responses.push(response);
      }

      expect(responses[30].status).toBe(429);
      
      // Immediate retry should also be rate limited
      const retryResponse = await request(app)
        .post('/api/auth/register')
        .send(authHelpers.generateValidUser());
      
      expect(retryResponse.status).toBe(429);
    }, 60000);
  });

  describe('Password Reset Rate Limiting', () => {
    test('should rate limit after 3 password reset attempts per hour per IP+email', async () => {
      const email = 'test@example.com';
      supabaseMock.mockPasswordReset();

      const responses = await authHelpers.simulateRateLimit(
        '/api/auth/forgot-password',
        { email },
        4, // 4 attempts (3 allowed + 1 to trigger rate limit)
        200
      );

      // First 3 attempts should succeed
      for (let i = 0; i < 3; i++) {
        expect(responses[i].status).toBe(200);
      }

      // 4th attempt should be rate limited
      expect(responses[3].status).toBe(429);
      authHelpers.assertRateLimitResponse(responses[3]);
      expect(responses[3].body.retryAfter).toBe('1 hour');
    });

    test('should apply rate limit per IP + email combination for password reset', async () => {
      supabaseMock.mockPasswordReset();

      // Rate limit first email
      const responses1 = await authHelpers.simulateRateLimit(
        '/api/auth/forgot-password',
        { email: 'user1@example.com' },
        4
      );

      expect(responses1[3].status).toBe(429);

      // Different email should not be rate limited
      const response2 = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'user2@example.com' });

      expect(response2.status).toBe(200);
    });
  });

  describe('General Endpoint Rate Limiting', () => {
    test('should rate limit verification endpoints after 100 requests per 15 minutes', async () => {
      supabaseMock.mockVerifyOtp('email');

      const responses = [];
      
      // Make 101 requests to trigger rate limit
      for (let i = 0; i < 101; i++) {
        const response = await request(app)
          .post('/api/auth/verify-email')
          .send({ token: `token_${i}` });
        
        responses.push(response);
        
        if (i < 99) {
          expect([200, 400]).toContain(response.status); // Either success or validation error
        }
      }

      // 101st request should be rate limited
      expect(responses[100].status).toBe(429);
      authHelpers.assertRateLimitResponse(responses[100]);
      expect(responses[100].body.retryAfter).toBe('15 minutes');
    }, 60000);

    test('should rate limit token refresh endpoint', async () => {
      supabaseMock.mockRefreshToken('valid_refresh');

      const responses = [];
      
      // Make 101 requests
      for (let i = 0; i < 101; i++) {
        const response = await request(app)
          .post('/api/auth/refresh-token')
          .send({ refreshToken: 'valid_refresh' });
        
        responses.push(response);
      }

      // Last request should be rate limited
      expect(responses[100].status).toBe(429);
    }, 60000);

    test('should rate limit /me endpoint', async () => {
      const token = 'valid_token';
      supabaseMock.mockGetUser(token, { id: 'user_123' });

      const responses = [];
      
      // Make 101 requests
      for (let i = 0; i < 101; i++) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);
        
        responses.push(response);
      }

      // Last request should be rate limited
      expect(responses[100].status).toBe(429);
    }, 60000);
  });

  describe('Rate Limit Response Format', () => {
    test('should return consistent rate limit error format', async () => {
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid credentials');

      // Trigger rate limit
      const responses = await authHelpers.simulateRateLimit(
        '/api/auth/login',
        { email: 'test@example.com', password: 'wrong' },
        6
      );

      const rateLimitResponse = responses[5];
      
      expect(rateLimitResponse.status).toBe(429);
      expect(rateLimitResponse.body).toHaveProperty('error');
      expect(rateLimitResponse.body.error).toMatch(/too many/i);
      expect(rateLimitResponse.body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(rateLimitResponse.body).toHaveProperty('retryAfter');
      expect(typeof rateLimitResponse.body.retryAfter).toBe('string');
    });

    test('should not expose internal rate limiting details', async () => {
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid credentials');

      const responses = await authHelpers.simulateRateLimit(
        '/api/auth/login',
        { email: 'test@example.com', password: 'wrong' },
        6
      );

      const rateLimitResponse = responses[5];
      const responseText = JSON.stringify(rateLimitResponse.body);
      
      // Should not expose implementation details
      expect(responseText).not.toContain('redis');
      expect(responseText).not.toContain('memory');
      expect(responseText).not.toContain('store');
      expect(responseText).not.toContain('bucket');
      expect(responseText).not.toContain('algorithm');
    });
  });

  describe('Rate Limit Bypass Attempts', () => {
    test('should not be bypassable with different user agents', async () => {
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid credentials');

      const email = 'test@example.com';
      const password = 'wrong';

      // Make 5 requests with different user agents
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('User-Agent', `TestAgent${i}`)
          .send({ email, password });
      }

      // 6th request with different user agent should still be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'DifferentAgent')
        .send({ email, password });

      expect(response.status).toBe(429);
    });

    test('should not be bypassable with different headers', async () => {
      supabaseMock.mockAuthError('invalid_credentials', 'Invalid credentials');

      const email = 'test@example.com';
      const password = 'wrong';

      // Make 5 requests with different headers
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('X-Custom-Header', `value${i}`)
          .send({ email, password });
      }

      // 6th request should still be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .set('X-Different-Header', 'bypass-attempt')
        .send({ email, password });

      expect(response.status).toBe(429);
    });
  });
});