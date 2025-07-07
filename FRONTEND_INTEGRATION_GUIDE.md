# Frontend Integration Guide - DeeGey Backend API

## Overview

This document provides comprehensive guidance for frontend developers integrating with the DeeGey matrimonial platform backend. The backend implements a two-phase profile completion system with JWT authentication and real-time features.

## Authentication & User Management

### Authentication Endpoints

#### Registration
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "religion": "buddhist",
  "country": "Sri Lanka",
  "livingCountry": "USA",
  "state": "California",
  "city": "Los Angeles"
}
```

**Response:**
```json
{
  "message": "Registration successful. Please verify your email and phone number.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "age": 33,
    "gender": "male",
    "registrationStep": "basic",
    "profileCompletionStage": "stage1",
    "minimalProfileCompletion": false,
    "canAccessDashboard": false
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "expiresAt": 1234567890
}
```

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "profileCompletionStage": "stage2",
    "minimalProfileCompletion": true,
    "canAccessDashboard": true
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "expiresAt": 1234567890
}
```

#### Other Auth Endpoints
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/verify-phone` - Verify phone with token

## Profile Completion System

### Two-Phase Architecture

The backend implements a sophisticated two-phase profile completion system:

#### **Phase 1: Initial Registration Flow**
- **Purpose**: Onboarding new users through structured stages
- **Active When**: `minimalProfileCompletion: false`
- **Stages**: Stage 1 → Stage 2 → Stage 3 → Stage 4
- **Exit Points**: 
  - Early exit after Stage 2 (skip button on Stage 3 page)
  - Auto-complete after Stage 4
  - Manual skip from Stage 3 or Stage 4 pages

#### **Phase 2: Ongoing Profile Enhancement**
- **Purpose**: Continuous profile improvement and completion scoring
- **Active When**: `minimalProfileCompletion: true`
- **Features**: 
  - Dynamic completion scoring (0-100%)
  - Contextual improvement suggestions
  - Individual field editing (not stage-based)
  - Never returns to stage flow

### Profile Stage Endpoints

#### Get Profile Stage Data
```http
GET /api/profiles/stages/stage-1
GET /api/profiles/stages/stage-2
GET /api/profiles/stages/stage-3
GET /api/profiles/stages/stage-4
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "stage": "stage-1",
  "data": {
    "maritalStatus": "single",
    "education": "bachelors",
    "occupation": "software_engineer",
    "height": 175,
    "motherTongue": "english"
  },
  "completion": {
    "completionPercentage": 45,
    "isComplete": false,
    "missingFields": []
  },
  "nextStage": "stage-2"
}
```

**Error Response (After Minimal Completion):**
```json
{
  "error": "Profile stages are no longer accessible after minimal completion",
  "code": "STAGE_ACCESS_DENIED",
  "redirectTo": "dashboard"
}
```

#### Update Profile Stage
```http
PUT /api/profiles/stages/stage-1
```

**Request Body (Stage 1):**
```json
{
  "maritalStatus": "single",
  "education": "bachelors",
  "occupation": "Software Engineer",
  "height": 175,
  "motherTongue": "english"
}
```

**Request Body (Stage 2):**
```json
{
  "aboutMe": "I am a software engineer...",
  "familyDetails": "Nuclear family...",
  "workLocation": {
    "country": "USA",
    "state": "California",
    "city": "San Francisco"
  },
  "immigrationStatus": "permanent_resident",
  "income": 120000,
  "bodyType": "athletic",
  "weight": 70,
  "complexion": "fair"
}
```

**Request Body (Stage 3):**
```json
{
  "dietaryPreference": "non_vegetarian",
  "familyValues": "moderate",
  "smokingHabits": "never",
  "drinkingHabits": "socially",
  "partnerExpectations": "Looking for someone...",
  "willingToRelocate": true,
  "hobbies": ["reading", "traveling"],
  "interests": ["technology", "music"]
}
```

**Request Body (Stage 4):**
```json
{
  "primaryPhotoUrl": "https://storage.url/photo.jpg",
  "profilePhotos": ["https://storage.url/photo1.jpg", "https://storage.url/photo2.jpg"],
  "isPublic": true
}
```

**Response:**
```json
{
  "message": "Profile stage-1 updated successfully",
  "profile": { /* updated profile data */ },
  "registrationStep": "profile_stage_1",
  "profileCompletionStage": "stage2",
  "minimalProfileCompletion": false,
  "nextStage": "stage-2",
  "canAccessDashboard": false
}
```

**Response (After Stage 4 Auto-Completion):**
```json
{
  "message": "Profile stage-4 updated successfully",
  "profile": { /* updated profile data */ },
  "minimalProfileCompletion": true,
  "nextStage": "dashboard",
  "canAccessDashboard": true
}
```

### Profile Completion Management

#### Skip Profile Completion
```http
POST /api/profiles/skip
```

**Requirements:**
- Must be at least at Stage 3 (completed Stage 2)
- `minimalProfileCompletion` must be `false`

**Response:**
```json
{
  "message": "Profile completion skipped successfully",
  "minimalProfileCompletion": true,
  "canAccessDashboard": true,
  "nextStage": "dashboard",
  "completionScore": 45,
  "encouragement": "Complete your profile to get better matches!"
}
```

**Error Response (Insufficient Progress):**
```json
{
  "error": "Must complete at least Stage 2 before skipping",
  "code": "INSUFFICIENT_PROGRESS",
  "currentStage": "stage1",
  "requiredStage": "stage3"
}
```

#### Complete Profile (Full Completion)
```http
POST /api/profiles/complete
```

**Response:**
```json
{
  "message": "Profile completed successfully",
  "profileCompletionStage": "completed",
  "minimalProfileCompletion": true,
  "nextStage": "dashboard",
  "canAccessDashboard": true
}
```

### Profile Data Management

#### Get User Profile
```http
GET /api/profiles
```

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "userId": "uuid",
    "maritalStatus": "single",
    "education": "bachelors",
    "occupation": "Software Engineer",
    "height": 175,
    "completionPercentage": 75,
    "isComplete": false,
    "isVerified": false,
    "isPublic": true
    // ... all profile fields
  }
}
```

#### Get Profile Completion Status
```http
GET /api/profiles/completion
```

**Response:**
```json
{
  "completionPercentage": 75,
  "isComplete": false,
  "missingFields": [
    {
      "field": "primaryPhotoUrl",
      "importance": "important",
      "stage": "Stage 4",
      "displayName": "Profile Photo"
    }
  ],
  "profile": { /* profile data */ }
}
```

#### Update Profile (Individual Fields)
```http
PUT /api/profiles
```

**Use Case**: For ongoing profile editing after minimal completion

**Request Body:**
```json
{
  "aboutMe": "Updated description...",
  "hobbies": ["reading", "swimming", "cooking"]
}
```

## Frontend Navigation Logic

### Route Guards Implementation

```typescript
// Example route guard logic
const shouldShowStageFlow = (user: User): boolean => {
  return !user.minimalProfileCompletion;
};

const canAccessDashboard = (user: User): boolean => {
  return user.minimalProfileCompletion;
};

const getNextRoute = (user: User): string => {
  if (user.minimalProfileCompletion) {
    return '/dashboard';
  }
  
  // Map profile completion stage to next stage
  const stageMap = {
    'stage1': '/profile/stages/stage-1',
    'stage2': '/profile/stages/stage-2',
    'stage3': '/profile/stages/stage-3',
    'stage4': '/profile/stages/stage-4'
  };
  
  return stageMap[user.profileCompletionStage] || '/profile/stages/stage-1';
};
```

### Stage Flow UI Components

#### Stage Navigation
```typescript
interface StageNavigation {
  currentStage: 'stage-1' | 'stage-2' | 'stage-3' | 'stage-4';
  canAccessStage: (stage: string) => boolean;
  isCompleted: (stage: string) => boolean;
  showSkipButton: boolean; // Show on stage-3 and stage-4 pages
}

// Show skip button logic
const showSkipButton = (currentStage: string, profileCompletionStage: string): boolean => {
  const currentNum = parseInt(currentStage.replace('stage-', ''));
  const completedNum = parseInt(profileCompletionStage.replace('stage', ''));
  
  // Show skip button if user is on stage 3+ and has completed at least stage 2
  return currentNum >= 3 && completedNum >= 2;
};
```

#### Completion Encouragement System
```typescript
const getCompletionEncouragement = (score: number): string => {
  if (score < 50) return 'Complete your profile to get better matches!';
  if (score < 75) return 'Add photos to increase your visibility!';
  if (score < 90) return 'Complete lifestyle preferences for better matching!';
  return 'Your profile looks great!';
};

const getCompletionColor = (score: number): string => {
  if (score < 50) return 'red';
  if (score < 75) return 'orange';
  if (score < 90) return 'blue';
  return 'green';
};
```

## Data Validation

### Validation Enums and Constraints

```typescript
// Use these for form validation and dropdowns
export const ValidationRules = {
  maritalStatus: ['single', 'divorced', 'widowed', 'separated'],
  education: ['high_school', 'diploma', 'bachelors', 'masters', 'phd', 'professional', 'other'],
  religion: ['buddhist', 'hindu', 'christian', 'muslim', 'catholic', 'other'],
  motherTongue: ['sinhala', 'tamil', 'english', 'other'],
  bodyType: ['slim', 'average', 'athletic', 'heavy'],
  complexion: ['fair', 'wheatish', 'dusky', 'dark'],
  dietaryPreference: ['vegetarian', 'non_vegetarian', 'vegan', 'jain_vegetarian'],
  familyValues: ['traditional', 'moderate', 'liberal'],
  smokingHabits: ['never', 'occasionally', 'regularly'],
  drinkingHabits: ['never', 'socially', 'occasionally', 'regularly'],
  immigrationStatus: ['citizen', 'permanent_resident', 'work_visa', 'student_visa', 'other'],
  employmentType: ['employed', 'self_employed', 'business', 'student', 'unemployed'],
  familyType: ['nuclear', 'joint']
};

export const ValidationConstraints = {
  height: { min: 120, max: 250 }, // cm
  weight: { min: 30, max: 200 }, // kg
  age: { min: 18, max: 80 },
  aboutMe: { maxLength: 1000 },
  familyDetails: { maxLength: 1000 },
  partnerExpectations: { maxLength: 1000 },
  firstName: { minLength: 2, maxLength: 50 },
  lastName: { minLength: 2, maxLength: 50 },
  occupation: { minLength: 2, maxLength: 100 }
};
```

## Error Handling

### Common Error Codes

```typescript
export enum ErrorCodes {
  // Authentication
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  
  // Profile Completion
  STAGE_ACCESS_DENIED = 'STAGE_ACCESS_DENIED',
  MINIMAL_PROFILE_REQUIRED = 'MINIMAL_PROFILE_REQUIRED',
  INSUFFICIENT_PROGRESS = 'INSUFFICIENT_PROGRESS',
  ALREADY_COMPLETED = 'ALREADY_COMPLETED',
  
  // Validation
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_STAGE = 'INVALID_STAGE',
  
  // Resources
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND'
}
```

### Error Response Format
```typescript
interface ErrorResponse {
  error: string;
  code: ErrorCodes;
  details?: Array<{
    field: string;
    message: string;
  }>;
  redirectTo?: string;
  message?: string;
}
```

## State Management Recommendations

### Redux/Zustand Store Structure

```typescript
interface AppState {
  auth: {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
  };
  
  profile: {
    data: Profile | null;
    completionPercentage: number;
    missingFields: MissingField[];
    isLoading: boolean;
  };
  
  profileFlow: {
    currentStage: string;
    isInStageFlow: boolean;
    canAccessDashboard: boolean;
    showSkipButton: boolean;
  };
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  profileCompletionStage: string;
  minimalProfileCompletion: boolean;
  canAccessDashboard: boolean;
  registrationStep: string;
}
```

### API Client Setup

```typescript
// Axios interceptor for auth
axios.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Attempt token refresh
      const refreshToken = store.getState().auth.refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh-token', {
            refreshToken
          });
          store.dispatch(updateTokens(response.data));
          // Retry original request
          return axios(error.config);
        } catch (refreshError) {
          store.dispatch(logout());
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

## Real-time Features (Future)

The backend is prepared for Socket.io integration:

```typescript
// Socket.io client setup (when implemented)
const socket = io(process.env.REACT_APP_BACKEND_URL, {
  auth: {
    token: accessToken
  }
});

// Event listeners
socket.on('profile_view', (data) => {
  // Handle profile view notification
});

socket.on('new_match', (data) => {
  // Handle new match notification
});
```

## File Upload (Photos)

When implementing photo uploads:

```typescript
// File upload to Stage 4
const uploadPhoto = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('photo', file);
  
  const response = await axios.post('/api/profiles/photos', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data.photoUrl;
};
```

## Performance Considerations

1. **Lazy Loading**: Load stage components only when needed
2. **Form State**: Use react-hook-form for optimal form performance
3. **Caching**: Cache profile data and completion status
4. **Optimistic Updates**: Update UI immediately, sync with backend
5. **Error Boundaries**: Implement error boundaries for profile stages

## Security Best Practices

1. **Token Storage**: Store tokens securely (httpOnly cookies preferred)
2. **Input Validation**: Always validate on frontend AND backend
3. **Sensitive Data**: Never log or expose sensitive profile information
4. **HTTPS**: Always use HTTPS in production
5. **CORS**: Backend configured for specific origins only

## Testing Strategies

1. **Unit Tests**: Test individual profile stage components
2. **Integration Tests**: Test complete profile flow end-to-end
3. **Error Scenarios**: Test all error codes and edge cases
4. **Navigation Tests**: Test route guards and navigation logic
5. **Form Validation**: Test all validation rules and error messages

---

This guide provides comprehensive information for frontend development. The backend implements a robust, flexible system that supports various user flows while maintaining security and data integrity.