const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Security - Input Validation', () => {
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

  describe('Registration Input Validation', () => {
    test('should reject invalid email formats', async () => {
      const invalidEmails = authHelpers.generateInvalidEmails();

      for (const invalidEmail of invalidEmails) {
        const userData = authHelpers.generateValidUser({
          email: invalidEmail
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'email');
        
        // Verify specific error message
        const emailError = response.body.details.find(d => d.field === 'email');
        expect(emailError).toBeDefined();
        expect(emailError.message).toContain('valid email address');
      }
    });

    test('should reject weak passwords', async () => {
      const weakPasswords = authHelpers.generateWeakPasswords();

      for (const weakPassword of weakPasswords) {
        const userData = authHelpers.generateValidUser({
          password: weakPassword
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'password');
        
        // Verify password complexity requirements are enforced
        const passwordError = response.body.details.find(d => d.field === 'password');
        expect(passwordError).toBeDefined();
        expect(passwordError.message).toMatch(/password must/i);
      }
    });

    test('should enforce password complexity requirements', async () => {
      const passwordTests = [
        { password: 'password', expectedError: /uppercase/ },
        { password: 'PASSWORD', expectedError: /lowercase/ },
        { password: 'Password', expectedError: /number/ },
        { password: 'Password1', expectedError: /special character/ },
        { password: 'Pass1!', expectedError: /8 characters/ },
      ];

      for (const test of passwordTests) {
        const userData = authHelpers.generateValidUser({
          password: test.password
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'password');
        
        const passwordError = response.body.details.find(d => d.field === 'password');
        expect(passwordError.message).toMatch(test.expectedError);
      }
    });

    test('should validate phone number formats', async () => {
      const invalidPhones = authHelpers.generateInvalidPhones();

      for (const invalidPhone of invalidPhones) {
        const userData = authHelpers.generateValidUser({
          phone: invalidPhone
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'phone');
      }
    });

    test('should prevent XSS in name fields', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<svg onload="alert(1)">',
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      for (const xssPayload of xssPayloads) {
        const userData = authHelpers.generateValidUser({
          firstName: xssPayload,
          lastName: xssPayload
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response);
        
        // Should reject or sanitize XSS attempts
        const firstNameError = response.body.details.find(d => d.field === 'firstName');
        const lastNameError = response.body.details.find(d => d.field === 'lastName');
        
        expect(firstNameError || lastNameError).toBeDefined();
      }
    });

    test('should prevent SQL injection in all fields', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker'); --",
        "' UNION SELECT * FROM users --",
        "'; UPDATE users SET admin=true WHERE id=1; --"
      ];

      for (const sqlPayload of sqlInjectionPayloads) {
        const userData = authHelpers.generateValidUser({
          email: `test${sqlPayload}@example.com`,
          firstName: sqlPayload,
          city: sqlPayload
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response);
      }
    });

    test('should reject oversized input fields', async () => {
      const longString = 'A'.repeat(10000);
      
      const userData = authHelpers.generateValidUser({
        firstName: longString,
        lastName: longString,
        city: longString,
        email: `${'x'.repeat(100)}@${'domain'.repeat(50)}.com`
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
      
      // Check that specific field length errors are provided
      const errors = response.body.details;
      const fieldErrors = errors.filter(e => 
        e.field === 'firstName' || 
        e.field === 'lastName' || 
        e.field === 'city'
      );
      
      expect(fieldErrors.length).toBeGreaterThan(0);
    });

    test('should validate required fields are present', async () => {
      const incompleteData = {
        email: 'test@example.com'
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
      
      const requiredFields = ['password', 'firstName', 'lastName', 'phone', 'dateOfBirth', 'gender', 'religion', 'country', 'livingCountry', 'city'];
      const errorFields = response.body.details.map(d => d.field);
      
      requiredFields.forEach(field => {
        expect(errorFields).toContain(field);
      });
    });

    test('should validate enum values for gender and religion', async () => {
      const invalidEnumTests = [
        { field: 'gender', values: ['invalid', 'unknown', 'attack', '<script>'] },
        { field: 'religion', values: ['invalid', 'unknown', 'attack', '<script>'] }
      ];

      for (const test of invalidEnumTests) {
        for (const invalidValue of test.values) {
          const userData = authHelpers.generateValidUser({
            [test.field]: invalidValue
          });

          const response = await request(app)
            .post('/api/auth/register')
            .send(userData);

          expect(response.status).toBe(400);
          authHelpers.assertValidationError(response, test.field);
        }
      }
    });

    test('should validate date formats for dateOfBirth', async () => {
      const invalidDates = [
        'invalid-date',
        '2024-13-01', // Invalid month
        '2024-02-30', // Invalid day
        '31/12/1990', // Wrong format
        '1990/12/31', // Wrong format
        'December 31, 1990', // Text format
        '2024-01-01T10:00:00Z', // With time
        ''
      ];

      for (const invalidDate of invalidDates) {
        const userData = authHelpers.generateValidUser({
          dateOfBirth: invalidDate
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'dateOfBirth');
      }
    });

    test('should reject future dates for dateOfBirth', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const userData = authHelpers.generateValidUser({
        dateOfBirth: futureDate.toISOString().split('T')[0]
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response, 'dateOfBirth');
      
      const dateError = response.body.details.find(d => d.field === 'dateOfBirth');
      expect(dateError.message).toContain('future');
    });

    test('should reject very old dates for dateOfBirth', async () => {
      const userData = authHelpers.generateValidUser({
        dateOfBirth: '1900-01-01'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response, 'dateOfBirth');
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

    test('should require password in login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // Missing password
        });

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response, 'password');
    });

    test('should prevent XSS in login fields', async () => {
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

    test('should prevent SQL injection in login', async () => {
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

    test('should handle oversized login inputs', async () => {
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
  });

  describe('Token Input Validation', () => {
    test('should handle malformed authorization headers', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Invalid token_format',
        'Basic dGVzdDp0ZXN0', // Wrong auth type
        '',
        'Bearer ' + 'A'.repeat(10000), // Oversized token
        'Bearer <script>alert("xss")</script>'
      ];

      for (const authHeader of malformedHeaders) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', authHeader);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
      }
    });

    test('should reject tokens with special characters', async () => {
      const maliciousTokens = [
        'Bearer token\x00with\x01null\x02bytes',
        'Bearer token\n\r\twith\nwhitespace',
        'Bearer token"with"quotes',
        'Bearer token;with;semicolons',
        'Bearer token<with>brackets'
      ];

      for (const authHeader of maliciousTokens) {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', authHeader);

        expect(response.status).toBe(401);
        expect([
          'TOKEN_MISSING',
          'TOKEN_INVALID',
          'TOKEN_EXPIRED'
        ]).toContain(response.body.code);
      }
    });
  });

  describe('Verification Token Validation', () => {
    test('should validate email verification tokens', async () => {
      const invalidTokens = [
        '',
        ' ',
        'invalid_token_format',
        '<script>alert("xss")</script>',
        "'; DROP TABLE tokens; --",
        'A'.repeat(10000), // Oversized
        '\x00\x01\x02' // Null bytes
      ];

      for (const invalidToken of invalidTokens) {
        const response = await request(app)
          .post('/api/auth/verify-email')
          .send({ token: invalidToken });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should validate phone verification tokens', async () => {
      const invalidTokens = [
        '',
        ' ',
        'invalid_token_format',
        '<script>alert("xss")</script>',
        "'; DROP TABLE tokens; --",
        'A'.repeat(10000)
      ];

      for (const invalidToken of invalidTokens) {
        const response = await request(app)
          .post('/api/auth/verify-phone')
          .send({ token: invalidToken });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should validate verification token types', async () => {
      const invalidTypes = [
        'invalid_type',
        '<script>',
        '"; DROP TABLE',
        123, // Wrong data type
        null,
        {},
        []
      ];

      for (const invalidType of invalidTypes) {
        const response = await request(app)
          .post('/api/auth/verify-email')
          .send({ 
            token: 'valid_token_format',
            type: invalidType 
          });

        // Should either use default type or reject
        expect([200, 400]).toContain(response.status);
      }
    });
  });

  describe('Password Reset Validation', () => {
    test('should validate email format in forgot password', async () => {
      const invalidEmails = authHelpers.generateInvalidEmails();

      for (const invalidEmail of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: invalidEmail });

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response, 'email');
      }
    });

    test('should validate reset password token and new password', async () => {
      const invalidData = [
        { token: '', password: 'ValidPass123!' },
        { token: 'valid_token', password: '' },
        { token: 'valid_token', password: 'weak' },
        { token: '<script>', password: 'ValidPass123!' },
        { token: 'valid_token', password: '<script>alert(1)</script>' }
      ];

      for (const data of invalidData) {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .send(data);

        expect(response.status).toBe(400);
        authHelpers.assertValidationError(response);
      }
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize HTML entities in input', async () => {
      const htmlEntities = '&lt;script&gt;alert(1)&lt;/script&gt;';
      
      const userData = authHelpers.generateValidUser({
        firstName: htmlEntities,
        city: htmlEntities
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Should either reject or properly sanitize
      if (response.status === 201) {
        expect(response.body.user.firstName).not.toContain('<script>');
        expect(response.body.user.city).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });

    test('should handle Unicode and special characters properly', async () => {
      const unicodeTests = [
        { name: 'José María', expected: 'José María' }, // Valid accent
        { name: 'محمد', expected: 'محمد' }, // Arabic
        { name: '中文', expected: '中文' }, // Chinese
        { name: 'Ñoño', expected: 'Ñoño' }, // Spanish characters
      ];

      for (const test of unicodeTests) {
        const userData = authHelpers.generateValidUser({
          firstName: test.name
        });

        supabaseMock.mockSignUp(userData);

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        if (response.status === 201) {
          expect(response.body.user.firstName).toBe(test.expected);
        }
        // Note: Some Unicode might be rejected by validation, which is also acceptable
      }
    });

    test('should reject null byte injection', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();
      
      const userData = authHelpers.generateValidUser({
        firstName: `John${maliciousInput.nullBytes}Doe`,
        email: `test${maliciousInput.nullBytes}@example.com`
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      authHelpers.assertValidationError(response);
    });

    test('should handle overlong UTF-8 sequences', async () => {
      const maliciousInput = authHelpers.generateMaliciousInput();
      
      const userData = authHelpers.generateValidUser({
        firstName: `John${maliciousInput.unicodeOverlong}Doe`
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Should either reject or properly handle the input
      expect([201, 400]).toContain(response.status);
    });
  });

  describe('Content-Type Validation', () => {
    test('should require JSON content type for POST requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('email=test@example.com&password=test');

      expect(response.status).toBe(400);
    });

    test('should handle missing content type gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPass123!'
        });

      // Should work with default JSON content type
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Request Size Limits', () => {
    test('should reject oversized request bodies', async () => {
      const largeData = {
        email: 'test@example.com',
        password: 'TestPass123!',
        firstName: 'A'.repeat(100000), // Very large field
        lastName: 'Doe'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largeData);

      expect([400, 413]).toContain(response.status); // 413 = Payload Too Large
    });
  });
});