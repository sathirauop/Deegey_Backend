const path = require('path');

// Load test environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env.test') });

// Set test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Suppress console.log during tests to keep output clean
  // but preserve console.error for debugging
  console.log = jest.fn();
});

afterAll(async () => {
  // Cleanup after all tests
  jest.clearAllMocks();
});

// Common test utilities
global.testUtils = {
  // Generate random test data
  randomEmail: () => `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
  randomPhone: () => `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
  randomString: (length = 10) => Math.random().toString(36).substring(2, length + 2),
  
  // Sleep utility for timing tests
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Test data validation
  validateErrorResponse: (response) => {
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('code');
    expect(response.body).not.toHaveProperty('message'); // Should not expose internal messages
  },
  
  // Validate token structure
  validateTokenStructure: (response) => {
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    expect(response.body).toHaveProperty('expiresAt');
    expect(response.body).not.toHaveProperty('session'); // Should not expose full session
  },
  
  // Validate user data sanitization
  validateSanitizedUser: (userData) => {
    expect(userData).toHaveProperty('id');
    expect(userData).toHaveProperty('email');
    expect(userData).toHaveProperty('emailVerified');
    expect(userData).toHaveProperty('phoneVerified');
    expect(userData).not.toHaveProperty('phone'); // Should not expose full phone
    expect(userData).not.toHaveProperty('dateOfBirth'); // Should not expose exact birth date
    expect(userData).not.toHaveProperty('lastLogin'); // Should not expose last login
  }
};