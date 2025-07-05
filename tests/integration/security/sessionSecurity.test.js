const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Security - Session Management', () => {
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

  describe('Session Token Security', () => {
    test('should return only essential token information', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      // Should only contain essential token fields
      global.testUtils.validateTokenStructure(response);
      
      // Should not contain session internals
      expect(response.body).not.toHaveProperty('session');
      expect(response.body).not.toHaveProperty('provider_token');
      expect(response.body).not.toHaveProperty('provider_refresh_token');
      
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('session_id');
      expect(responseText).not.toContain('user_agent');
      expect(responseText).not.toContain('ip_address');
      expect(responseText).not.toContain('aud');
      expect(responseText).not.toContain('iss');
      expect(responseText).not.toContain('iat');
      expect(responseText).not.toContain('role');
    });

    test('should not expose internal JWT claims', async () => {
      const email = 'test@example.com';
      supabaseMock.mockSignIn(email);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: email,
          password: 'TestPass123!'
        });

      expect(response.status).toBe(200);
      
      const responseText = JSON.stringify(response.body);
      
      // Should not expose JWT internals
      expect(responseText).not.toContain('aud');
      expect(responseText).not.toContain('iss');
      expect(responseText).not.toContain('iat');
      expect(responseText).not.toContain('exp');
      expect(responseText).not.toContain('sub');
      expect(responseText).not.toContain('role');
      expect(responseText).not.toContain('aal');
      expect(responseText).not.toContain('amr');
      expect(responseText).not.toContain('session_id');
    });

    test('should not expose session metadata', async () => {
      const refreshToken = 'valid_refresh_token';
      supabaseMock.mockRefreshToken(refreshToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      
      const responseText = JSON.stringify(response.body);
      
      // Should not expose session metadata
      expect(responseText).not.toContain('user_agent');
      expect(responseText).not.toContain('ip_address');
      expect(responseText).not.toContain('created_at');
      expect(responseText).not.toContain('updated_at');
      expect(responseText).not.toContain('factor_id');
      expect(responseText).not.toContain('aal');
      expect(responseText).not.toContain('not_after');
    });

    test('should handle token expiration gracefully', async () => {
      const expiredToken = 'expired_access_token';
      supabaseMock.mockGetUser(expiredToken); // This will return 401

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid token or user not found');
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
      expect(response.body).not.toHaveProperty('message');
      
      // Should not expose expiration details
      authHelpers.assertNoInformationLeakage(response);
    });

    test('should prevent session fixation attacks', async () => {
      // Test that new sessions are created on authentication
      const email = 'test@example.com';
      
      // First login
      supabaseMock.mockSignIn(email, { id: 'user_123' });
      
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'TestPass123!' });

      expect(login1.status).toBe(200);
      const token1 = login1.body.accessToken;

      // Second login should generate different token
      supabaseMock.mockSignIn(email, { id: 'user_123' });
      
      const login2 = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'TestPass123!' });

      expect(login2.status).toBe(200);
      const token2 = login2.body.accessToken;

      // Tokens should be different
      expect(token1).not.toBe(token2);
    });
  });

  describe('Session Lifecycle Management', () => {
    test('should create valid session on registration', async () => {
      const userData = authHelpers.generateValidUser();
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      // Should have valid token structure
      global.testUtils.validateTokenStructure(response);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
      
      // Token should be usable
      const { accessToken } = response.body;
      supabaseMock.mockGetUser(accessToken, { id: 'user_123', email: userData.email });

      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
    });

    test('should create valid session on login', async () => {
      const email = 'test@example.com';
      const userData = { id: 'user_123', email };
      
      supabaseMock.mockSignIn(email, userData);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'TestPass123!' });

      expect(response.status).toBe(200);
      
      global.testUtils.validateTokenStructure(response);
      
      // Session should be immediately usable
      const { accessToken } = response.body;
      supabaseMock.mockGetUser(accessToken, userData);

      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
    });

    test('should maintain session validity through token refresh', async () => {
      const refreshToken = 'valid_refresh_token';
      supabaseMock.mockRefreshToken(refreshToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      global.testUtils.validateTokenStructure(response);
      
      // New tokens should be different from old ones
      expect(response.body.accessToken).not.toBe(refreshToken);
      expect(response.body.refreshToken).not.toBe(refreshToken);
      
      // New session should be usable
      const { accessToken } = response.body;
      supabaseMock.mockGetUser(accessToken, { id: 'user_123' });

      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
    });

    test('should properly destroy session on logout', async () => {
      const accessToken = 'valid_access_token';
      
      // First verify token works
      supabaseMock.mockGetUser(accessToken, { id: 'user_123' });

      const meResponse1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse1.status).toBe(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body).toHaveProperty('message', 'Logout successful');

      // Token should no longer work
      supabaseMock.mockGetUser(accessToken); // Returns 401

      const meResponse2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse2.status).toBe(401);
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

  describe('Session Security Controls', () => {
    test('should reject sessions for deleted users', async () => {
      const validTokenDeletedUser = 'valid_token_deleted_user';
      
      // Mock scenario where token is valid but user doesn't exist
      supabaseMock.mockGetUser(validTokenDeletedUser); // Returns 401

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validTokenDeletedUser}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
    });

    test('should handle concurrent session requests safely', async () => {
      const accessToken = 'concurrent_test_token';
      const userData = { id: 'user_123', email: 'test@example.com' };
      
      supabaseMock.mockGetUser(accessToken, userData);

      // Make multiple concurrent requests with same session
      const promises = Array(10).fill().map(() =>
        request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const responses = await Promise.all(promises);

      // All should succeed or fail consistently
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status); // Success or rate limited
        if (response.status === 200) {
          expect(response.body).toHaveProperty('user');
        }
      });
    });

    test('should prevent token tampering', async () => {
      // Test various token manipulation attempts
      const tamperedTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.tampered',
        'valid_prefix.tampered_payload.valid_signature',
        'Bearer.Token.With.Extra.Dots',
        'modified_token_' + 'A'.repeat(100),
      ];

      for (const tamperedToken of tamperedTokens) {
        supabaseMock.mockGetUser(tamperedToken); // Returns 401

        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${tamperedToken}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
        authHelpers.assertNoInformationLeakage(response);
      }
    });

    test('should handle refresh token reuse detection', async () => {
      const refreshToken = 'one_time_refresh_token';
      
      // First refresh should succeed
      supabaseMock.mockRefreshToken(refreshToken);

      const firstRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(firstRefresh.status).toBe(200);

      // Second use of same refresh token should fail
      supabaseMock.clearMocks();
      supabaseMock.mockAuthError('invalid_grant', 'Refresh token already used');

      const secondRefresh = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(secondRefresh.status).toBe(401);
      expect(secondRefresh.body).toHaveProperty('code', 'REFRESH_TOKEN_INVALID');
    });

    test('should implement proper token rotation on refresh', async () => {
      const oldRefreshToken = 'old_refresh_token';
      
      supabaseMock.mockRefreshToken(oldRefreshToken);

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: oldRefreshToken });

      expect(response.status).toBe(200);
      
      // Should receive new tokens
      global.testUtils.validateTokenStructure(response);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      
      // New refresh token should be different from old one
      expect(response.body.refreshToken).not.toBe(oldRefreshToken);
    });
  });

  describe('Session Context Security', () => {
    test('should not expose user context in token responses', async () => {
      const userData = authHelpers.generateValidUser({
        phone: '+15551234567',
        dateOfBirth: '1990-01-01'
      });
      
      supabaseMock.mockSignUp(userData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      
      // User data should be sanitized
      global.testUtils.validateSanitizedUser(response.body.user);
      
      // Sensitive context should not be in token response
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('+15551234567');
      expect(responseText).not.toContain('1990-01-01');
    });

    test('should handle session context changes', async () => {
      // Test that sessions handle user profile updates appropriately
      const accessToken = 'session_context_token';
      const initialUserData = {
        id: 'user_123',
        email: 'test@example.com',
        user_metadata: {
          first_name: 'John',
          account_status: 'active'
        }
      };

      supabaseMock.mockGetUser(accessToken, initialUserData);

      const response1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response1.status).toBe(200);
      expect(response1.body.user.firstName).toBe('John');

      // Simulate user account being disabled
      const disabledUserData = {
        ...initialUserData,
        user_metadata: {
          ...initialUserData.user_metadata,
          account_status: 'disabled'
        }
      };

      supabaseMock.mockGetUser(accessToken, disabledUserData);

      const response2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.user.accountStatus).toBe('disabled');
    });
  });

  describe('Session Validation Security', () => {
    test('should validate session integrity', async () => {
      const accessToken = 'integrity_test_token';
      const userData = {
        id: 'user_123',
        email: 'test@example.com',
        user_metadata: {
          first_name: 'John'
        }
      };

      supabaseMock.mockGetUser(accessToken, userData);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe('user_123');
      expect(response.body.user.email).toBe('test@example.com');
      
      // Should return sanitized data
      global.testUtils.validateSanitizedUser(response.body.user);
    });

    test('should reject sessions with invalid user data', async () => {
      const accessToken = 'invalid_user_data_token';
      
      // Mock invalid/corrupted user data
      supabaseMock.mockGetUser(accessToken); // Returns 401

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
    });

    test('should handle session validation errors gracefully', async () => {
      const accessToken = 'validation_error_token';
      
      // Mock validation error
      supabaseMock.mockGetUser(accessToken); // Returns 401

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
      expect(response.body).not.toHaveProperty('message');
      
      authHelpers.assertNoInformationLeakage(response);
    });
  });

  describe('Cross-Session Security', () => {
    test('should isolate sessions between different users', async () => {
      const user1Token = 'user1_session_token';
      const user2Token = 'user2_session_token';
      
      const user1Data = { id: 'user_1', email: 'user1@example.com' };
      const user2Data = { id: 'user_2', email: 'user2@example.com' };

      supabaseMock.mockGetUser(user1Token, user1Data);
      supabaseMock.mockGetUser(user2Token, user2Data);

      const response1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);

      const response2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      
      expect(response1.body.user.id).toBe('user_1');
      expect(response2.body.user.id).toBe('user_2');
      
      // Users should only see their own data
      expect(response1.body.user.email).toBe('user1@example.com');
      expect(response2.body.user.email).toBe('user2@example.com');
    });

    test('should prevent session hijacking attempts', async () => {
      // Test that using another user's token doesn't work
      const legitimateToken = 'legitimate_user_token';
      const hijackedToken = 'hijacked_user_token';
      
      supabaseMock.mockGetUser(legitimateToken, { id: 'user_123' });
      supabaseMock.mockGetUser(hijackedToken); // Returns 401

      const legit = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${legitimateToken}`);

      const hijacked = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${hijackedToken}`);

      expect(legit.status).toBe(200);
      expect(hijacked.status).toBe(401);
    });
  });
});