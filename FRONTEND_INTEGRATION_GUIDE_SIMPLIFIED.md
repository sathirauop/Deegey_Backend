# Frontend Integration Guide - DeeGey Simplified Profile System

## Overview

This guide documents the simplified profile completion system where the backend provides a single endpoint for profile submission, while the frontend handles stage-based UI flow. This approach provides maximum flexibility for frontend implementation.

## System Architecture

### Key Principles

1. **Single Submission Endpoint**: One endpoint handles all profile data submission
2. **Frontend-Driven Stages**: UI stages are managed entirely by frontend
3. **Flexible Data Submission**: Backend accepts partial or complete profile data
4. **Simple State Tracking**: Only tracks if user has submitted initial profile (`minimalProfileCompletion`)
5. **Dynamic Scoring**: Profile completion percentage calculated based on filled fields

## Authentication Flow

### Registration
```http
POST /api/auth/register
```

**Request:**
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
    "minimalProfileCompletion": false,
    "canAccessDashboard": false
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

### Login
```http
POST /api/auth/login
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "minimalProfileCompletion": true,
    "canAccessDashboard": true
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

## Profile Management

### Submit Initial Profile (NEW - Replaces all stage endpoints)
```http
POST /api/profiles/submit
```

**Purpose**: Submit profile data after registration. Can be called only once per user.

**Request:**
```json
{
  // All fields are optional - submit what user has filled
  "maritalStatus": "single",
  "education": "bachelors",
  "occupation": "Software Engineer",
  "height": 175,
  "motherTongue": "english",
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
  "complexion": "fair",
  "dietaryPreference": "non_vegetarian",
  "familyValues": "moderate",
  "smokingHabits": "never",
  "drinkingHabits": "socially",
  "partnerExpectations": "Looking for someone...",
  "willingToRelocate": true,
  "hobbies": ["reading", "traveling"],
  "interests": ["technology", "music"],
  "primaryPhotoUrl": "https://storage.url/photo.jpg",
  "profilePhotos": ["url1", "url2"],
  
  // Special flag to indicate if user clicked "Skip for now"
  "skipCompletion": false
}
```

**Response:**
```json
{
  "message": "Profile submitted successfully!",
  "profile": { /* all profile data */ },
  "minimalProfileCompletion": true,
  "canAccessDashboard": true,
  "completionScore": 75,
  "encouragement": "Add photos to increase your visibility!",
  "missingFields": [
    {
      "field": "primaryPhotoUrl",
      "importance": "important",
      "stage": "Stage 4",
      "displayName": "Profile Photo"
    }
  ]
}
```

**Error Response (Already Submitted):**
```json
{
  "error": "Initial profile already submitted",
  "code": "ALREADY_SUBMITTED",
  "message": "Use the profile update endpoint to modify your profile"
}
```

### Update Profile (After Initial Submission)
```http
PUT /api/profiles
```

**Purpose**: Update individual profile fields after initial submission

**Request:**
```json
{
  "aboutMe": "Updated bio...",
  "hobbies": ["reading", "swimming", "cooking"],
  "primaryPhotoUrl": "https://new-photo-url.jpg"
}
```

### Get Profile Data
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
    "completionPercentage": 75,
    "isComplete": false,
    // ... all other fields
  }
}
```

### Get Profile Completion Status
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
  "profile": { /* current profile data */ }
}
```

## Frontend Implementation Guide

### 1. Stage Management (Frontend Only)

```typescript
// Frontend stages configuration
const PROFILE_STAGES = {
  stage1: {
    title: "Basic Information",
    fields: ['maritalStatus', 'education', 'occupation', 'height', 'motherTongue'],
    required: true
  },
  stage2: {
    title: "Personal Details",
    fields: ['aboutMe', 'familyDetails', 'workLocation', 'immigrationStatus', 'income', 'bodyType', 'weight', 'complexion'],
    required: true
  },
  stage3: {
    title: "Lifestyle & Preferences", 
    fields: ['dietaryPreference', 'familyValues', 'smokingHabits', 'drinkingHabits', 'partnerExpectations', 'willingToRelocate', 'hobbies', 'interests'],
    required: false,
    showSkipButton: true
  },
  stage4: {
    title: "Photos & Visibility",
    fields: ['primaryPhotoUrl', 'profilePhotos', 'isPublic'],
    required: false,
    showSkipButton: true
  }
};
```

### 2. Navigation Logic

```typescript
interface UserState {
  minimalProfileCompletion: boolean;
  currentStage?: string; // Stored in localStorage/sessionStorage
}

const getInitialRoute = (user: UserState): string => {
  if (user.minimalProfileCompletion) {
    return '/dashboard';
  }
  return '/profile/setup'; // Your stage flow component
};

const ProfileSetupFlow = () => {
  const [currentStage, setCurrentStage] = useState('stage1');
  const [formData, setFormData] = useState({});
  
  const handleNext = () => {
    // Save to local state
    const nextStage = getNextStage(currentStage);
    setCurrentStage(nextStage);
  };
  
  const handleBack = () => {
    const prevStage = getPreviousStage(currentStage);
    setCurrentStage(prevStage);
  };
  
  const handleSubmit = async (skipCompletion = false) => {
    const response = await fetch('/api/profiles/submit', {
      method: 'POST',
      body: JSON.stringify({
        ...formData,
        skipCompletion
      })
    });
    
    if (response.ok) {
      // Navigate to dashboard
      navigate('/dashboard');
    }
  };
  
  const handleSkip = () => {
    handleSubmit(true);
  };
};
```

### 3. Form State Management

```typescript
// Use React Hook Form or similar
const useProfileForm = () => {
  const [allFormData, setAllFormData] = useState({});
  
  const updateStageData = (stage: string, data: any) => {
    setAllFormData(prev => ({
      ...prev,
      ...data
    }));
  };
  
  const getStageData = (stage: string) => {
    const fields = PROFILE_STAGES[stage].fields;
    return fields.reduce((acc, field) => {
      acc[field] = allFormData[field] || '';
      return acc;
    }, {});
  };
  
  const canProceedToNext = (stage: string): boolean => {
    if (!PROFILE_STAGES[stage].required) return true;
    
    const stageData = getStageData(stage);
    const requiredFields = PROFILE_STAGES[stage].fields;
    
    return requiredFields.every(field => {
      const value = stageData[field];
      return value !== null && value !== undefined && value !== '';
    });
  };
  
  return {
    allFormData,
    updateStageData,
    getStageData,
    canProceedToNext
  };
};
```

### 4. Profile Completion Score Calculation

```typescript
// Frontend can calculate estimated score before submission
const calculateEstimatedScore = (formData: any): number => {
  const stageWeights = {
    stage1: 25,
    stage2: 25, 
    stage3: 25,
    stage4: 25
  };
  
  let totalScore = 0;
  
  Object.entries(PROFILE_STAGES).forEach(([stage, config]) => {
    const filledFields = config.fields.filter(field => {
      const value = formData[field];
      return value && value !== '' && 
             !(Array.isArray(value) && value.length === 0);
    });
    
    const stageScore = (filledFields.length / config.fields.length) * stageWeights[stage];
    totalScore += stageScore;
  });
  
  return Math.round(totalScore);
};
```

### 5. Skip Logic Implementation

```typescript
const ProfileStage3 = ({ formData, onNext, onSkip }) => {
  const canSkip = true; // Always true for stage 3
  
  return (
    <div>
      <h2>Lifestyle & Preferences</h2>
      {/* Form fields */}
      
      <div className="actions">
        <button onClick={onBack}>Previous</button>
        <button onClick={onNext}>Continue</button>
        {canSkip && (
          <button onClick={onSkip} className="skip-btn">
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
};
```

## Data Validation

### Field Validation Rules

```typescript
export const VALIDATION_RULES = {
  // Enums
  maritalStatus: ['single', 'divorced', 'widowed', 'separated'],
  education: ['high_school', 'diploma', 'bachelors', 'masters', 'phd', 'professional', 'other'],
  gender: ['male', 'female', 'other'],
  religion: ['buddhist', 'hindu', 'christian', 'muslim', 'catholic', 'other'],
  motherTongue: ['sinhala', 'tamil', 'english', 'other'],
  bodyType: ['slim', 'average', 'athletic', 'heavy'],
  complexion: ['fair', 'wheatish', 'dusky', 'dark'],
  dietaryPreference: ['vegetarian', 'non_vegetarian', 'vegan', 'jain_vegetarian'],
  familyValues: ['traditional', 'moderate', 'liberal'],
  smokingHabits: ['never', 'occasionally', 'regularly'],
  drinkingHabits: ['never', 'socially', 'occasionally', 'regularly'],
  immigrationStatus: ['citizen', 'permanent_resident', 'work_visa', 'student_visa', 'other'],
  
  // Constraints
  height: { min: 120, max: 250 }, // cm
  weight: { min: 30, max: 200 }, // kg
  income: { min: 0 },
  aboutMe: { maxLength: 1000 },
  familyDetails: { maxLength: 1000 },
  partnerExpectations: { maxLength: 1000 },
  occupation: { minLength: 2, maxLength: 100 }
};
```

## Encouragement Messages

```typescript
const getEncouragementMessage = (score: number): string => {
  if (score < 50) return 'Complete your profile to get better matches!';
  if (score < 75) return 'Add photos to increase your visibility!';
  if (score < 90) return 'Complete lifestyle preferences for better matching!';
  return 'Your profile looks great!';
};
```

## Error Handling

```typescript
enum ErrorCodes {
  ALREADY_SUBMITTED = 'ALREADY_SUBMITTED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND'
}

interface ErrorResponse {
  error: string;
  code: string;
  message?: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}
```

## Best Practices

### 1. State Persistence
- Save form progress in localStorage/sessionStorage
- Allow users to continue where they left off
- Clear saved data after successful submission

### 2. Loading States
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);
const [completionScore, setCompletionScore] = useState(null);

const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    const response = await submitProfile(formData);
    setCompletionScore(response.completionScore);
    navigate('/dashboard');
  } finally {
    setIsSubmitting(false);
  }
};
```

### 3. Progressive Enhancement
- Show real-time completion percentage as user fills form
- Highlight missing important fields
- Provide context-aware help text

### 4. Mobile Responsiveness
- Design stages to work well on mobile
- Consider breaking long forms into sub-steps
- Use appropriate input types for mobile

## Dashboard Integration

After profile submission, users access the dashboard where they can:

1. View their completion score
2. See missing fields with importance levels
3. Update individual sections without stage flow
4. Get personalized encouragement messages

```typescript
const ProfileCompletionWidget = () => {
  const { completionScore, missingFields } = useProfileCompletion();
  
  return (
    <Card>
      <h3>Profile Strength: {completionScore}%</h3>
      <ProgressBar value={completionScore} />
      <p>{getEncouragementMessage(completionScore)}</p>
      {missingFields.length > 0 && (
        <Button onClick={() => navigate('/profile/edit')}>
          Complete Profile
        </Button>
      )}
    </Card>
  );
};
```

## Summary

This simplified architecture provides:

1. **Maximum Frontend Flexibility**: Complete control over UI flow
2. **Simple Backend**: One submission endpoint, clear state tracking
3. **Better UX**: Users can navigate between stages freely
4. **Easy Testing**: Frontend stages can be tested independently
5. **Future-Proof**: Easy to add/remove/reorder stages without backend changes

The backend focuses on data validation and storage, while the frontend owns the entire user experience flow.