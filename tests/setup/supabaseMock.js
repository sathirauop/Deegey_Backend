const nock = require('nock');

class SupabaseMock {
  constructor() {
    this.baseUrl = process.env.SUPABASE_URL || 'https://test-project.supabase.co';
    this.mockUsers = new Map();
    this.mockSessions = new Map();
  }

  // Mock successful user registration
  mockSignUp(userData = {}) {
    const mockUser = {
      id: userData.id || `user_${Date.now()}`,
      email: userData.email || 'test@example.com',
      phone: userData.phone || '+1234567890',
      email_confirmed_at: null,
      phone_confirmed_at: null,
      created_at: new Date().toISOString(),
      user_metadata: userData.user_metadata || {}
    };

    const mockSession = {
      access_token: `mock_access_token_${Date.now()}`,
      refresh_token: `mock_refresh_token_${Date.now()}`,
      expires_at: Date.now() + 3600000 // 1 hour
    };

    this.mockUsers.set(mockUser.id, mockUser);
    this.mockSessions.set(mockSession.access_token, { user: mockUser, session: mockSession });

    return nock(this.baseUrl)
      .post('/auth/v1/signup')
      .reply(200, {
        user: mockUser,
        session: mockSession
      });
  }

  // Mock successful login
  mockSignIn(email, userData = {}) {
    const mockUser = this.findUserByEmail(email) || {
      id: userData.id || `user_${Date.now()}`,
      email: email,
      phone: userData.phone || '+1234567890',
      email_confirmed_at: new Date().toISOString(),
      phone_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      user_metadata: userData.user_metadata || {}
    };

    const mockSession = {
      access_token: `mock_access_token_${Date.now()}`,
      refresh_token: `mock_refresh_token_${Date.now()}`,
      expires_at: Date.now() + 3600000
    };

    this.mockUsers.set(mockUser.id, mockUser);
    this.mockSessions.set(mockSession.access_token, { user: mockUser, session: mockSession });

    return nock(this.baseUrl)
      .post('/auth/v1/token', { grant_type: 'password' })
      .reply(200, {
        user: mockUser,
        session: mockSession
      });
  }

  // Mock failed authentication
  mockAuthError(errorCode = 'invalid_credentials', message = 'Invalid login credentials') {
    return nock(this.baseUrl)
      .post(/\/auth\/v1\/(signup|token)/)
      .reply(400, {
        error: errorCode,
        error_description: message
      });
  }

  // Mock user verification
  mockGetUser(token, userData = null) {
    const sessionData = this.mockSessions.get(token);
    
    if (!sessionData && !userData) {
      return nock(this.baseUrl)
        .get('/auth/v1/user')
        .reply(401, {
          error: 'invalid_token',
          error_description: 'Invalid token'
        });
    }

    const user = userData || sessionData.user;
    return nock(this.baseUrl)
      .get('/auth/v1/user')
      .reply(200, { user });
  }

  // Mock token refresh
  mockRefreshToken(refreshToken) {
    const mockSession = {
      access_token: `mock_access_token_refreshed_${Date.now()}`,
      refresh_token: `mock_refresh_token_refreshed_${Date.now()}`,
      expires_at: Date.now() + 3600000
    };

    return nock(this.baseUrl)
      .post('/auth/v1/token', { grant_type: 'refresh_token' })
      .reply(200, {
        session: mockSession
      });
  }

  // Mock OTP verification
  mockVerifyOtp(type = 'email') {
    const mockUser = {
      id: `user_${Date.now()}`,
      email: 'test@example.com',
      phone: '+1234567890',
      email_confirmed_at: type === 'email' ? new Date().toISOString() : null,
      phone_confirmed_at: type === 'sms' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      user_metadata: {}
    };

    const mockSession = {
      access_token: `mock_access_token_${Date.now()}`,
      refresh_token: `mock_refresh_token_${Date.now()}`,
      expires_at: Date.now() + 3600000
    };

    return nock(this.baseUrl)
      .post('/auth/v1/verify')
      .reply(200, {
        user: mockUser,
        session: mockSession
      });
  }

  // Mock password reset
  mockPasswordReset() {
    return nock(this.baseUrl)
      .post('/auth/v1/recover')
      .reply(200, {});
  }

  // Helper methods
  findUserByEmail(email) {
    for (const user of this.mockUsers.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  clearMocks() {
    nock.cleanAll();
    this.mockUsers.clear();
    this.mockSessions.clear();
  }

  // Setup default interceptors
  setupDefaultMocks() {
    // Mock admin endpoints
    nock(this.baseUrl)
      .persist()
      .get('/auth/v1/admin/users')
      .reply(200, { users: Array.from(this.mockUsers.values()) });

    nock(this.baseUrl)
      .persist()
      .post(/\/auth\/v1\/admin\/users\/.*/)
      .reply(200, {});
  }
}

module.exports = SupabaseMock;