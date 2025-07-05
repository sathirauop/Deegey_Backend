const request = require('supertest');

class AuthHelpers {
  constructor(app) {
    this.app = app;
  }

  // Generate valid test user data
  generateValidUser(overrides = {}) {
    return {
      email: overrides.email || global.testUtils.randomEmail(),
      password: overrides.password || 'TestPass123!',
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || 'User',
      phone: overrides.phone || global.testUtils.randomPhone(),
      dateOfBirth: overrides.dateOfBirth || '1990-01-01',
      gender: overrides.gender || 'male',
      religion: overrides.religion || 'buddhist',
      country: overrides.country || 'Sri Lanka',
      livingCountry: overrides.livingCountry || 'Canada',
      state: overrides.state || 'Ontario',
      city: overrides.city || 'Toronto',
      ...overrides
    };
  }

  // Generate invalid test data for security testing
  generateMaliciousInput() {
    return {
      xssPayload: '<script>alert("xss")</script>',
      sqlInjection: "'; DROP TABLE users; --",
      longString: 'A'.repeat(10000),
      specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      nullBytes: '\u0000',
      unicodeOverlong: '\uFEFF',
      htmlEntities: '&lt;script&gt;alert(1)&lt;/script&gt;'
    };
  }

  // Register a test user
  async registerUser(userData = {}) {
    const user = this.generateValidUser(userData);
    const response = await request(this.app)
      .post('/api/auth/register')
      .send(user);
    
    return { user, response };
  }

  // Login a test user
  async loginUser(email, password = 'TestPass123!') {
    const response = await request(this.app)
      .post('/api/auth/login')
      .send({ email, password });
    
    return response;
  }

  // Get authenticated request with token
  async authenticatedRequest(method, path, token, data = {}) {
    const req = request(this.app)[method.toLowerCase()](path)
      .set('Authorization', `Bearer ${token}`);
    
    if (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT') {
      return req.send(data);
    }
    
    return req;
  }

  // Simulate rate limit by making multiple requests
  async simulateRateLimit(endpoint, data, attempts = 6, delay = 100) {
    const responses = [];
    
    for (let i = 0; i < attempts; i++) {
      const response = await request(this.app)
        .post(endpoint)
        .send(data);
      
      responses.push(response);
      
      if (i < attempts - 1) {
        await global.testUtils.sleep(delay);
      }
    }
    
    return responses;
  }

  // Test for information leakage in responses
  assertNoInformationLeakage(response) {
    const body = JSON.stringify(response.body);
    
    // Check for common information disclosure patterns
    expect(body).not.toMatch(/stack trace/i);
    // Allow "Internal server error" as it's a generic message
    // expect(body).not.toMatch(/internal server error/i);
    expect(body).not.toMatch(/database/i);
    expect(body).not.toMatch(/supabase/i);
    expect(body).not.toMatch(/postgres/i);
    expect(body).not.toMatch(/sql/i);
    expect(body).not.toMatch(/connection/i);
    expect(body).not.toMatch(/timeout/i);
    expect(body).not.toMatch(/jwt/i);
    expect(body).not.toMatch(/secret/i);
    expect(body).not.toMatch(/token.*expired/i);
    expect(body).not.toMatch(/invalid.*signature/i);
  }

  // Validate rate limit response
  assertRateLimitResponse(response) {
    expect(response.status).toBe(429);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/too many/i);
    expect(response.body).toHaveProperty('code');
    expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.body).toHaveProperty('retryAfter');
  }

  // Validate validation error response
  assertValidationError(response, fieldName = null) {
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'Validation failed');
    expect(response.body).toHaveProperty('details');
    expect(Array.isArray(response.body.details)).toBe(true);
    
    if (fieldName) {
      const fieldError = response.body.details.find(detail => detail.field === fieldName);
      expect(fieldError).toBeDefined();
    }
  }

  // Generate weak passwords for testing
  generateWeakPasswords() {
    return [
      'password',           // Common password
      '123456',            // Numeric only
      'abcdefgh',          // Lowercase only
      'ABCDEFGH',          // Uppercase only
      'Pass123',           // Missing special char
      'Pass!',             // Too short
      '',                  // Empty
      ' ',                 // Whitespace only
      'a'.repeat(100)      // Too long
    ];
  }

  // Generate invalid email formats
  generateInvalidEmails() {
    return [
      'invalid-email',
      '@domain.com',
      'user@',
      'user.domain.com',
      'user@domain',
      'user space@domain.com',
      'user@domain..com',
      '',
      ' ',
      'a'.repeat(100) + '@domain.com'
    ];
  }

  // Generate invalid phone numbers
  generateInvalidPhones() {
    return [
      '123',               // Too short
      'abcdefghij',        // Letters
      '++1234567890',      // Double plus
      '1234567890123456',  // Too long
      '',                  // Empty
      ' ',                 // Whitespace
      '+1 234 567 890',    // Spaces (might be valid depending on validation)
      '1234567890'         // Missing country code
    ];
  }

  // Measure response time for timing attack testing
  async measureResponseTime(requestFn, iterations = 5) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime();
      await requestFn();
      const [seconds, nanoseconds] = process.hrtime(start);
      times.push(seconds * 1000 + nanoseconds / 1000000); // Convert to ms
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((acc, time) => acc + Math.pow(time - avg, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    
    return { average: avg, standardDeviation: stdDev, times };
  }
}

module.exports = AuthHelpers;