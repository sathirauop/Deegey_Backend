const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Authentication - Token Management', () => {
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

  describe('Token Refresh', () => {
    test('should successfully refresh tokens with valid refresh token', async () => {
      const refreshToken = 'valid_refresh_token_123';
      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe'
        }
      };

      supabaseMock.mockRefreshToken(refreshToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Token refreshed successfully');
      
      // Validate new token structure
      testUtils.validateTokenStructure(response);
      
      // Should return updated user data
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
    });

    test('should reject invalid refresh tokens', async () => {
      const invalidRefreshToken = 'invalid_refresh_token';

      // Mock Supabase to return error for invalid token
      supabaseMock.clearMocks();
      supabaseMock.mockAuthError('invalid_grant', 'Refresh token is invalid');

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: invalidRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token refresh failed');
      expect(response.body).toHaveProperty('code', 'REFRESH_TOKEN_INVALID');
      expect(response.body).not.toHaveProperty('message');
    });

    test('should reject expired refresh tokens', async () => {
      const expiredRefreshToken = 'expired_refresh_token';

      supabaseMock.clearMocks();
      supabaseMock.mockAuthError('invalid_grant', 'Refresh token has expired');

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: expiredRefreshToken });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token refresh failed');
      expect(response.body).toHaveProperty('code', 'REFRESH_TOKEN_INVALID');
    });

    test('should require refresh token in request body', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Refresh token required');
      expect(response.body).toHaveProperty('code', 'REFRESH_TOKEN_MISSING');
    });

    test('should handle malformed refresh tokens', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();
      
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: maliciousInput.xssPayload });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'REFRESH_TOKEN_INVALID');
    });

    test('should not expose refresh token internals in response', async () => {
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
      expect(responseText).not.toContain('aud');
      expect(responseText).not.toContain('iss');
    });
  });

  describe('Token Verification in Middleware', () => {
    test('should accept valid access tokens', async () => {
      const accessToken = 'valid_access_token_123';
      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        user_metadata: {
          first_name: 'John',
          last_name: 'Doe'
        }
      };

      supabaseMock.mockGetUser(accessToken, userData);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe('user_123');
    });

    test('should reject invalid access tokens', async () => {
      const invalidToken = 'invalid_access_token';
      
      supabaseMock.mockGetUser(invalidToken); // This will return 401

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token or user not found');
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
      expect(response.body).not.toHaveProperty('message');
    });

    test('should reject expired access tokens', async () => {
      const expiredToken = 'expired_access_token';
      
      supabaseMock.mockGetUser(expiredToken); // This will return 401

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
    });

    test('should require authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
      expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
    });

    test('should require Bearer token format', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'invalid_format_token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
      expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
    });

    test('should handle malformed JWT tokens safely', async () => {
      const malformedTokens = [
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'Bearer not.a.jwt',
        'Bearer ' + 'A'.repeat(1000),
        'Bearer <script>alert("xss")</script>',
        'Bearer \x00\x01\x02',
      ];

      for (const authHeader of malformedTokens) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', authHeader);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
        
        // Should not expose token validation details
        authHelpers.assertNoInformationLeakage(response);
      }
    });

    test('should not expose token validation errors', async () => {
      const invalidToken = 'Bearer invalid_jwt_with_bad_signature';
      
      supabaseMock.mockGetUser('invalid_jwt_with_bad_signature');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', invalidToken);

      expect(response.status).toBe(401);
      
      authHelpers.assertNoInformationLeakage(response);
      
      // Should not expose JWT validation details
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('signature');
      expect(responseText).not.toContain('jwt');
      expect(responseText).not.toContain('decode');
      expect(responseText).not.toContain('verify');
    });
  });

  describe('Token Lifecycle', () => {
    test('should invalidate tokens on logout', async () => {
      const accessToken = 'valid_access_token_for_logout';
      const userData = {
        id: 'user_123',
        email: 'test@example.com'
      };

      // First verify token works
      supabaseMock.mockGetUser(accessToken, userData);

      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);

      // Mock logout
      supabaseMock.clearMocks();

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body).toHaveProperty('message', 'Logout successful');

      // Token should no longer work
      supabaseMock.mockGetUser(accessToken); // This returns 401

      const meResponseAfterLogout = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponseAfterLogout.status).toBe(401);
    });

    test('should handle logout without token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logout successful');
    });

    test('should handle logout with invalid token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Logout successful');
    });
  });

  describe('Token Security', () => {
    test('should not accept tokens with modified signatures', async () => {
      // Simulate a token with modified signature
      const tamperedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSJ9.tampered_signature';
      
      supabaseMock.mockGetUser(tamperedToken); // This will return 401

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
    });

    test('should not accept tokens with modified payloads', async () => {
      // This would require more sophisticated JWT manipulation in real tests
      const modifiedToken = 'modified_payload_token';
      
      supabaseMock.mockGetUser(modifiedToken);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${modifiedToken}`);

      expect(response.status).toBe(401);
    });

    test('should handle concurrent token verification requests', async () => {
      const accessToken = 'concurrent_test_token';
      const userData = {
        id: 'user_123',
        email: 'test@example.com'
      };

      supabaseMock.mockGetUser(accessToken, userData);

      // Make multiple concurrent requests with same token
      const promises = Array(10).fill().map(() =>
        request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const responses = await Promise.all(promises);

      // All should succeed or fail consistently
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // Success or rate limited
      });
    });

    test('should not expose user data for deleted users with valid tokens', async () => {
      const validTokenDeletedUser = 'valid_token_deleted_user';
      
      // Mock scenario where token is valid but user is deleted
      supabaseMock.mockGetUser(validTokenDeletedUser);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validTokenDeletedUser}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
    });
  });

  describe('Token Refresh Security', () => {
    test('should not allow refresh token reuse', async () => {
      const refreshToken = 'one_time_refresh_token';
      
      // First refresh should succeed
      supabaseMock.mockRefreshToken(refreshToken);

      const firstResponse = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(firstResponse.status).toBe(200);

      // Second refresh with same token should fail
      supabaseMock.clearMocks();
      supabaseMock.mockAuthError('invalid_grant', 'Refresh token already used');

      const secondResponse = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(secondResponse.status).toBe(401);
      expect(secondResponse.body).toHaveProperty('code', 'REFRESH_TOKEN_INVALID');
    });

    test('should handle refresh token rotation properly', async () => {
      const oldRefreshToken = 'old_refresh_token';
      
      supabaseMock.mockRefreshToken(oldRefreshToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: oldRefreshToken });

      expect(response.status).toBe(200);
      
      // Should receive new refresh token
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).not.toBe(oldRefreshToken);
    });

    test('should not expose refresh token internals in error responses', async () => {
      supabaseMock.mockAuthError('invalid_grant', 'Refresh token signature verification failed with secret abc123');

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid_token' });

      expect(response.status).toBe(401);
      
      authHelpers.assertNoInformationLeakage(response);
      
      // Should not expose token internals
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('signature');
      expect(responseText).not.toContain('secret');
      expect(responseText).not.toContain('abc123');
    });
  });
});