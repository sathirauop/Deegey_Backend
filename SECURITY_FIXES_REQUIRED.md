# Security Vulnerabilities and Required Fixes

## 🚨 Critical Security Issues Found

### 1. **SQL Injection Risk - No Input Validation on Profile Submission**

**Issue**: The `submitInitialProfile` endpoint passes raw `req.body` directly to database operations without validation.

**Location**: `src/controllers/profileController.js:200`
```javascript
// VULNERABLE CODE
const updatedProfile = await profileModel.updateProfile(req.user.id, req.body);
```

**Fix Required**:
```javascript
// SECURE CODE
const validatedData = Profile.validate(req.body, 'update');
const updatedProfile = await profileModel.updateProfile(req.user.id, validatedData);
```

### 2. **Sensitive Information Exposure**

**Issue**: Error messages expose internal details that could help attackers.

**Locations**: Multiple files showing database errors and internal state.

**Fix Required**:
```javascript
// Instead of:
throw new Error(`Error finding user by ID: ${error.message}`);

// Use:
console.error('Database error:', error); // Log internally
throw new Error('An error occurred'); // Generic message to client
```

### 3. **Missing Rate Limiting on Critical Endpoints**

**Issue**: No rate limiting on profile submission endpoint - vulnerable to spam/abuse.

**Fix Required**:
```javascript
// Add to profileRoutes.js
const { createRateLimiter } = require('../middleware/rateLimiter');

const profileSubmitLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 profile submissions per window
  message: 'Too many profile submission attempts'
});

router.post('/submit', authenticateToken, profileSubmitLimiter, submitInitialProfile);
```

### 4. **JWT Token in Request Object**

**Issue**: Storing JWT in `req.user.jwt` could lead to token exposure.

**Location**: `src/controllers/profileController.js:179`
```javascript
const authenticatedClient = createAuthenticatedClient(req.user.jwt);
```

**Fix Required**: Don't store JWT in req.user. Instead, pass it securely through headers.

### 5. **No CSRF Protection**

**Issue**: API endpoints don't have CSRF protection for state-changing operations.

**Fix Required**: Implement CSRF tokens or use SameSite cookies.

### 6. **Missing Input Sanitization**

**Issue**: User inputs aren't sanitized before storage, vulnerable to XSS.

**Fix Required**:
```javascript
const DOMPurify = require('isomorphic-dompurify');

// Sanitize text inputs
const sanitizedAboutMe = DOMPurify.sanitize(req.body.aboutMe);
const sanitizedExpectations = DOMPurify.sanitize(req.body.partnerExpectations);
```

### 7. **Phone Number Exposure**

**Issue**: Full phone numbers might be exposed in responses.

**Current Code**: `sanitizeForClient` only shows verification status, which is good.

**Recommendation**: Ensure phone numbers are never included in any API response.

### 8. **Missing Security Headers**

**Fix Required**: Add security middleware to app.js:
```javascript
const helmet = require('helmet');
app.use(helmet());

// Additional headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

### 9. **Income Field Security**

**Issue**: Income is sensitive data that shouldn't be exposed publicly.

**Good**: Already removed from public profile view.

**Additional Fix**: Encrypt income data at rest.

### 10. **File Upload Vulnerabilities**

**Issue**: No validation for photo URLs could lead to SSRF attacks.

**Fix Required**:
```javascript
const validUrl = require('valid-url');

const validatePhotoUrl = (url) => {
  if (!validUrl.isUri(url)) {
    throw new Error('Invalid URL');
  }
  
  // Whitelist allowed domains
  const allowedDomains = ['storage.supabase.co', 'your-cdn.com'];
  const urlObj = new URL(url);
  
  if (!allowedDomains.includes(urlObj.hostname)) {
    throw new Error('URL domain not allowed');
  }
  
  return true;
};
```

## Immediate Actions Required

1. **Add Input Validation** to `submitInitialProfile` endpoint
2. **Implement Rate Limiting** on all profile endpoints
3. **Sanitize All Text Inputs** before storage
4. **Add Security Headers** using Helmet
5. **Validate Photo URLs** to prevent SSRF
6. **Generic Error Messages** for production
7. **Add CSRF Protection** for state-changing operations
8. **Review and Update** authentication flow to not expose JWT

## Code Updates Needed

### Update Profile Controller

```javascript
const submitInitialProfile = async (req, res) => {
  try {
    const { skipCompletion = false, ...profileData } = req.body;
    
    // Validate all input data
    const validatedData = Profile.validate(profileData, 'update');
    
    // Sanitize text fields
    if (validatedData.aboutMe) {
      validatedData.aboutMe = DOMPurify.sanitize(validatedData.aboutMe);
    }
    if (validatedData.partnerExpectations) {
      validatedData.partnerExpectations = DOMPurify.sanitize(validatedData.partnerExpectations);
    }
    if (validatedData.familyDetails) {
      validatedData.familyDetails = DOMPurify.sanitize(validatedData.familyDetails);
    }
    
    // Validate photo URLs
    if (validatedData.primaryPhotoUrl) {
      validatePhotoUrl(validatedData.primaryPhotoUrl);
    }
    if (validatedData.profilePhotos) {
      validatedData.profilePhotos.forEach(validatePhotoUrl);
    }
    
    // ... rest of the logic with validatedData instead of req.body
  } catch (error) {
    // Generic error response
    if (error.isValidation) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR'
      });
    }
    
    console.error('Profile submission error:', error);
    res.status(500).json({
      error: 'Failed to submit profile',
      code: 'SUBMISSION_ERROR'
    });
  }
};
```

### Environment Variables Check

Ensure these are set and not exposed:
- JWT_SECRET
- DATABASE_URL
- SUPABASE_ANON_KEY (should be public)
- SUPABASE_SERVICE_KEY (must be private)

## Testing Recommendations

1. **Penetration Testing**: Test for SQL injection, XSS, CSRF
2. **Rate Limit Testing**: Verify limits work correctly
3. **Authentication Testing**: Ensure tokens expire properly
4. **Input Fuzzing**: Test with malformed inputs
5. **Authorization Testing**: Verify users can only access their own data