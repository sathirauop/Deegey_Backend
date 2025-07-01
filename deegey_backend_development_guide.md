# DeeGey Backend Development Guide - AI-Optimized

**Target:** Express.js + Supabase + Socket.io Backend for Matrimonial Platform  
**AI Context:** Detailed specifications for Claude/Cursor code generation  
**Architecture:** 33 database entities supporting Flutter mobile app

---

## Executive Summary

**MVP Launch Requirements:** 8 core features across 4 development phases
**Technical Stack:** Express.js (API) + Supabase (Database/Auth) + Socket.io (Real-time)
**Critical Path:** Authentication → Profile Management → Matching → Messaging
**Production Dependencies:** Photo storage, push notifications, admin dashboard, security audit

---

## Feature Prioritization (1-15)

### **PHASE 1: FOUNDATION (Features 1-4)**
1. **Authentication System**
2. **Profile Management** 
3. **Photo Management**
4. **Admin Dashboard Core**

### **PHASE 2: CORE (Features 5-8)**
5. **Profile Discovery & Browsing**
6. **Matching System**
7. **Real-time Messaging**
8. **Search & Filtering**

### **PHASE 3: ADVANCED (Features 9-12)**
9. **Notification System**
10. **Profile Verification**
11. **Reporting & Moderation**
12. **Family Features**

### **PHASE 4: GROWTH (Features 13-15)**
13. **Analytics & Insights**
14. **Premium Features**
15. **Customer Support System**

---

## PHASE 1: FOUNDATION

### Feature 1: Authentication System
**Priority:** Critical (Blocks everything)  
**Complexity:** Medium  
**Business Impact:** Essential for user onboarding

#### Database Entities
- User (primary)
- UserActivity (tracking)
- DeviceToken (push notifications)

#### API Endpoints Required
```javascript
// Authentication Routes
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh-token
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/verify-email
POST   /api/auth/resend-verification
GET    /api/auth/me
PUT    /api/auth/update-password
DELETE /api/auth/delete-account
```

#### Technical Implementation
```javascript
// JWT Strategy
- Access Token: 15 minutes expiry
- Refresh Token: 7 days expiry  
- Password: bcrypt hashing (12 rounds)
- Email Verification: UUID tokens with 24h expiry
- Rate Limiting: 5 login attempts per 15 minutes
```

#### Supabase Integration
```sql
-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Auth policies
CREATE POLICY "Users can view own profile" ON users
FOR SELECT USING (auth.uid() = id);
```

#### Flutter Requirements
- Update existing AuthBloc to use new endpoints
- Implement registration flow (currently missing)
- Add email verification screens
- Handle refresh token rotation

#### Third-party Integrations
- **Email Service:** SendGrid or Supabase Email
- **SMS Verification:** Twilio (optional for phone verification)

#### Security Considerations
- HTTPS enforcement
- CORS configuration for mobile app
- Input validation and sanitization
- SQL injection prevention
- Brute force protection

---

### Feature 2: Profile Management
**Priority:** Critical (Core matrimonial functionality)  
**Complexity:** High  
**Business Impact:** Primary user value proposition

#### Database Entities
- Profile (primary)
- Location (reference)
- Religion (reference)
- Caste (reference)
- Education (reference)
- Occupation (reference)

#### API Endpoints Required
```javascript
// Profile Management
GET    /api/profiles/me
PUT    /api/profiles/me
POST   /api/profiles
DELETE /api/profiles/me
GET    /api/profiles/{id}
GET    /api/profiles/completion-score
PUT    /api/profiles/privacy-settings

// Reference Data
GET    /api/reference/locations
GET    /api/reference/religions
GET    /api/reference/castes
GET    /api/reference/educations
GET    /api/reference/occupations
```

#### Complex Business Logic
```javascript
// Profile Completion Score Algorithm
const calculateCompletionScore = (profile) => {
  const weightedFields = {
    basic_info: 30,      // age, gender, location
    family_info: 25,     // family details, background
    education_career: 20, // education, occupation
    preferences: 15,     // partner preferences
    photos: 10          // profile photos
  };
  // Implementation logic for scoring
};

// Cultural Matching Algorithm
const calculateCulturalCompatibility = (profile1, profile2) => {
  // Religion, caste, language compatibility scoring
};
```

#### Data Validation Rules
```javascript
// Server-side validation
const profileValidation = {
  age: { min: 18, max: 80 },
  height: { format: /^\d+'\d+"$/ },
  bio: { maxLength: 500 },
  required_fields: ['age', 'gender', 'religion', 'location']
};
```

#### Flutter Requirements
- Profile creation wizard (multi-step)
- Profile editing with auto-save
- Photo upload integration
- Completion progress indicator
- Cultural data dropdowns

---

### Feature 3: Photo Management
**Priority:** Critical (Visual-first platform)  
**Complexity:** High  
**Business Impact:** Essential for user engagement

#### Database Entities
- ProfilePhoto (primary)
- ProfileVerification (photo verification)

#### API Endpoints Required
```javascript
// Photo Management
POST   /api/photos/upload
GET    /api/photos/profile/{profileId}
PUT    /api/photos/{id}/set-primary
DELETE /api/photos/{id}
POST   /api/photos/{id}/report
GET    /api/photos/presigned-url
```

#### Supabase Storage Integration
```javascript
// Storage bucket configuration
const storageConfig = {
  bucket: 'profile-photos',
  maxFileSize: '5MB',
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  resize: [
    { width: 800, height: 600, suffix: 'large' },
    { width: 400, height: 300, suffix: 'medium' },
    { width: 150, height: 150, suffix: 'thumbnail' }
  ]
};
```

#### Image Processing Pipeline
```javascript
// Sharp.js integration for image processing
const processImage = async (buffer) => {
  // 1. Compress and resize
  // 2. Generate thumbnails
  // 3. Watermark application
  // 4. EXIF data removal
  // 5. CDN upload
};
```

#### Flutter Requirements
- Image picker and cropper
- Multi-photo selection
- Upload progress indicators
- Photo reordering
- Primary photo selection

#### Third-party Integrations
- **CDN:** Supabase Storage with CDN
- **Image Processing:** Sharp.js
- **Moderation:** AWS Rekognition (optional)

---

### Feature 4: Admin Dashboard Core
**Priority:** High (Content moderation essential)  
**Complexity:** Medium  
**Business Impact:** Platform safety and management

#### Database Entities
- User (admin roles)
- AdminAction (audit trail)
- Report (user reports)

#### API Endpoints Required
```javascript
// Admin Management
GET    /api/admin/dashboard-stats
GET    /api/admin/users
PUT    /api/admin/users/{id}/status
GET    /api/admin/reports
PUT    /api/admin/reports/{id}/resolve
GET    /api/admin/verification-queue
PUT    /api/admin/verify-profile/{id}
```

#### Admin Dashboard Features
- User management (suspend/activate)
- Profile verification queue
- Photo moderation
- Report management
- Basic analytics
- System configuration

#### Role-Based Access Control
```javascript
const adminRoles = {
  SUPER_ADMIN: ['all_permissions'],
  MODERATOR: ['verify_profiles', 'handle_reports'],
  SUPPORT: ['view_users', 'handle_support_tickets']
};
```

---

## PHASE 2: CORE

### Feature 5: Profile Discovery & Browsing
**Priority:** Critical (Core user experience)  
**Complexity:** High  
**Business Impact:** Primary app functionality

#### Database Entities
- Profile (primary)
- ProfileView (tracking)
- SearchFilter (saved searches)
- Block (blocked users)

#### API Endpoints Required
```javascript
// Profile Discovery
GET    /api/discover/profiles
GET    /api/discover/new-profiles
GET    /api/discover/recently-active
POST   /api/discover/view-profile
GET    /api/discover/who-viewed-me
POST   /api/discover/save-search
GET    /api/discover/saved-searches
```

#### Complex Query Logic
```javascript
// Discovery Algorithm
const getDiscoveryProfiles = async (userId, filters) => {
  // 1. Apply basic filters (age, location, religion)
  // 2. Exclude blocked users
  // 3. Exclude already matched users
  // 4. Apply compatibility scoring
  // 5. Randomize within score ranges
  // 6. Paginate results
};
```

#### Performance Optimization
```sql
-- Database indexes for fast queries
CREATE INDEX idx_profiles_discovery ON profiles 
(age, country, religion, is_active, last_active);

CREATE INDEX idx_profiles_location ON profiles 
USING GIST (POINT(latitude, longitude));
```

#### Flutter Requirements
- Card-based profile browsing
- Swipe gestures
- Filter interface
- Infinite scroll
- Profile detail views

---

### Feature 6: Matching System
**Priority:** Critical (Core matrimonial feature)  
**Complexity:** High  
**Business Impact:** Platform success metric

#### Database Entities
- Match (primary)
- Notification (match notifications)

#### API Endpoints Required
```javascript
// Matching System
POST   /api/matches/send-interest
GET    /api/matches/received
GET    /api/matches/sent
PUT    /api/matches/{id}/respond
DELETE /api/matches/{id}
GET    /api/matches/mutual
POST   /api/matches/{id}/block
```

#### Matching Logic
```javascript
// Interest System
const sendInterest = async (senderId, receiverId, message) => {
  // 1. Validate users can match
  // 2. Check for existing match
  // 3. Create match record
  // 4. Send notification
  // 5. Check for mutual match
};

// Mutual Match Detection
const checkMutualMatch = async (matchId) => {
  // Check if both users liked each other
  // Update match status to mutual
  // Enable messaging
  // Send mutual match notifications
};
```

#### Real-time Features (Socket.io)
```javascript
// Real-time match notifications
io.to(userId).emit('new_match', {
  type: 'interest_received',
  from: senderProfile,
  message: interestMessage
});

io.to(userId).emit('mutual_match', {
  type: 'mutual_match',
  profile: matchProfile,
  conversationId: newConversationId
});
```

#### Flutter Requirements
- Interest sending interface
- Received interests management
- Mutual matches display
- Match response actions

---

### Feature 7: Real-time Messaging
**Priority:** Critical (Communication between matches)  
**Complexity:** Very High  
**Business Impact:** User engagement and retention

#### Database Entities
- Conversation (primary)
- Message (primary)
- MessageAttachment (file sharing)

#### API Endpoints Required
```javascript
// Messaging System
GET    /api/conversations
GET    /api/conversations/{id}
POST   /api/conversations
GET    /api/conversations/{id}/messages
POST   /api/conversations/{id}/messages
PUT    /api/conversations/{id}/read
DELETE /api/conversations/{id}
POST   /api/conversations/{id}/block
```

#### Socket.io Real-time Implementation
```javascript
// Message Broadcasting
socket.on('send_message', async (data) => {
  // 1. Validate conversation access
  // 2. Save message to database
  // 3. Broadcast to conversation participants
  // 4. Send push notification if offline
  // 5. Update conversation last_message
});

// Typing Indicators
socket.on('typing_start', (conversationId) => {
  socket.to(conversationId).emit('user_typing', {
    userId: socket.userId,
    isTyping: true
  });
});

// Read Receipts
socket.on('message_read', async (messageId) => {
  // Update message read status
  // Broadcast read receipt
});
```

#### Message Features
- Text messages
- Photo sharing
- Emoji reactions
- Message status (sent, delivered, read)
- Typing indicators
- Message search
- Conversation management

#### Flutter Requirements
- Real-time chat interface
- Message bubble UI
- Photo sharing
- Socket.io client integration
- Offline message queuing

#### Third-party Integrations
- **Socket.io:** Real-time communication
- **Push Notifications:** Firebase FCM
- **File Storage:** Supabase Storage

---

### Feature 8: Search & Filtering
**Priority:** High (User discovery)  
**Complexity:** High  
**Business Impact:** User satisfaction

#### Database Entities
- Profile (queried)
- SearchFilter (saved filters)
- Location, Religion, Education, Occupation (reference)

#### API Endpoints Required
```javascript
// Advanced Search
POST   /api/search/profiles
GET    /api/search/suggestions
POST   /api/search/save-filter
GET    /api/search/saved-filters
DELETE /api/search/filters/{id}
GET    /api/search/popular-filters
```

#### Complex Search Logic
```javascript
// Multi-criteria Search
const searchProfiles = async (criteria) => {
  const query = supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true);

  // Age range
  if (criteria.minAge) query.gte('age', criteria.minAge);
  if (criteria.maxAge) query.lte('age', criteria.maxAge);

  // Location proximity
  if (criteria.location && criteria.radius) {
    query.rpc('profiles_within_radius', {
      lat: criteria.location.lat,
      lng: criteria.location.lng,
      radius_km: criteria.radius
    });
  }

  // Multiple religions
  if (criteria.religions?.length) {
    query.in('religion', criteria.religions);
  }

  // Education levels
  if (criteria.educationLevels?.length) {
    query.in('education_level', criteria.educationLevels);
  }

  return query;
};
```

#### Search Performance
```sql
-- Full-text search capability
CREATE INDEX idx_profiles_search ON profiles 
USING GIN (to_tsvector('english', 
  COALESCE(bio, '') || ' ' || 
  COALESCE(occupation, '') || ' ' || 
  COALESCE(education_level, '')
));

-- Geographic search
CREATE INDEX idx_profiles_location ON profiles 
USING GIST (POINT(latitude, longitude));
```

#### Flutter Requirements
- Advanced filter interface
- Search results with filtering
- Saved search management
- Location-based search
- Search suggestions

---

## PHASE 3: ADVANCED

### Feature 9: Notification System
**Priority:** High (User engagement)  
**Complexity:** High  
**Business Impact:** User retention

#### Database Entities
- Notification (primary)
- DeviceToken (push tokens)

#### API Endpoints Required
```javascript
// Notifications
GET    /api/notifications
PUT    /api/notifications/{id}/read
PUT    /api/notifications/read-all
DELETE /api/notifications/{id}
POST   /api/notifications/register-device
PUT    /api/notifications/preferences
```

#### Notification Types & Logic
```javascript
const notificationTypes = {
  NEW_MATCH: {
    title: 'New Interest Received!',
    template: '{senderName} sent you an interest',
    action: 'OPEN_MATCHES'
  },
  MUTUAL_MATCH: {
    title: 'It\'s a Match!',
    template: 'You and {matchName} liked each other',
    action: 'OPEN_CONVERSATION'
  },
  NEW_MESSAGE: {
    title: 'New Message',
    template: '{senderName}: {messagePreview}',
    action: 'OPEN_CHAT'
  },
  PROFILE_VIEW: {
    title: 'Profile View',
    template: '{viewerName} viewed your profile',
    action: 'OPEN_PROFILE'
  }
};
```

#### Push Notification Integration
```javascript
// Firebase FCM integration
const sendPushNotification = async (userId, notification) => {
  const tokens = await getActiveDeviceTokens(userId);
  
  const message = {
    notification: {
      title: notification.title,
      body: notification.message
    },
    data: {
      type: notification.type,
      entityId: notification.related_entity_id
    },
    tokens: tokens
  };

  await admin.messaging().sendMulticast(message);
};
```

#### Real-time In-App Notifications
```javascript
// Socket.io integration
socket.on('new_notification', (notification) => {
  // Broadcast to user's active sessions
  io.to(userId).emit('notification', notification);
});
```

#### Flutter Requirements
- Notification list interface
- Push notification handling
- Badge counts
- Notification preferences
- Deep linking from notifications

---

### Feature 10: Profile Verification
**Priority:** High (Trust and safety)  
**Complexity:** Medium  
**Business Impact:** Platform credibility

#### Database Entities
- ProfileVerification (primary)
- ProfilePhoto (photo verification)
- AdminAction (verification actions)

#### API Endpoints Required
```javascript
// Verification System
POST   /api/verification/submit-profile
POST   /api/verification/submit-photo
GET    /api/verification/status
GET    /api/admin/verification-queue
PUT    /api/admin/verify/{id}
PUT    /api/admin/reject/{id}
```

#### Verification Workflow
```javascript
// Profile Verification Process
const submitProfileVerification = async (profileId, documents) => {
  // 1. Create verification request
  // 2. Upload verification documents
  // 3. Add to admin queue
  // 4. Send confirmation notification
  // 5. Update profile status to 'under_review'
};

// Admin Verification Actions
const verifyProfile = async (verificationId, adminId, decision) => {
  // 1. Update verification status
  // 2. Update profile verification flag
  // 3. Send notification to user
  // 4. Log admin action
  // 5. Award verification badge
};
```

#### Verification Types
- Photo verification (selfie with ID)
- Document verification (passport/license)
- Phone number verification
- Social media verification
- Employment verification

#### Flutter Requirements
- Document upload interface
- Verification status display
- Verification badge UI
- Step-by-step verification guide

---

### Feature 11: Reporting & Moderation
**Priority:** High (Platform safety)  
**Complexity:** Medium  
**Business Impact:** Legal compliance and safety

#### Database Entities
- Report (primary)
- AdminAction (moderation actions)
- Block (user blocking)

#### API Endpoints Required
```javascript
// Reporting System
POST   /api/reports/user
POST   /api/reports/message
POST   /api/reports/photo
GET    /api/admin/reports
PUT    /api/admin/reports/{id}/resolve
POST   /api/moderation/auto-moderate
```

#### Automated Moderation
```javascript
// Content Moderation Pipeline
const moderateContent = async (content, type) => {
  // 1. Profanity filter
  // 2. Spam detection
  // 3. Inappropriate content detection
  // 4. Auto-flag suspicious content
  // 5. Queue for human review if needed
};

// Auto-moderation Rules
const autoModerationRules = {
  profanity: 'filter_and_warn',
  spam: 'auto_remove',
  harassment: 'flag_for_review',
  fake_profile: 'suspend_and_review'
};
```

#### Report Categories
- Inappropriate photos
- Fake profile
- Harassment
- Spam/scam
- Privacy violation
- Other concerns

#### Flutter Requirements
- Report interface
- Block user functionality
- Content reporting
- Safety guidelines

---

### Feature 12: Family Features
**Priority:** Medium (Cultural requirement)  
**Complexity:** High  
**Business Impact:** Differentiation for Sri Lankan market

#### Database Entities
- FamilyMember (primary)
- FamilyInvitation (invitations)
- Testimonial (family testimonials)

#### API Endpoints Required
```javascript
// Family Features
POST   /api/family/invite-member
GET    /api/family/members
PUT    /api/family/member-permissions
POST   /api/family/testimonial
GET    /api/family/invitations
PUT    /api/family/accept-invitation
```

#### Family Invitation System
```javascript
// Family Member Invitation
const inviteFamilyMember = async (profileId, email, relationship, permissions) => {
  // 1. Generate invitation code
  // 2. Create invitation record
  // 3. Send invitation email
  // 4. Set expiration (7 days)
  // 5. Define permissions
};

// Permission Levels
const familyPermissions = {
  VIEW_MATCHES: 'can_view_matches',
  COMMUNICATE: 'can_send_messages',
  MANAGE_PROFILE: 'can_edit_profile',
  RECEIVE_UPDATES: 'get_notifications'
};
```

#### Family Dashboard Features
- View family member activity
- Manage profile on behalf
- Review matches and interests
- Family testimonials
- Coordinated communication

#### Flutter Requirements
- Family invitation interface
- Family member management
- Permission settings
- Family dashboard

---

## PHASE 4: GROWTH

### Feature 13: Analytics & Insights
**Priority:** Medium (Business intelligence)  
**Complexity:** High  
**Business Impact:** Data-driven decisions

#### Database Entities
- UserActivity (tracking)
- ProfileView (engagement)
- Match (success metrics)

#### API Endpoints Required
```javascript
// Analytics
GET    /api/analytics/user-engagement
GET    /api/analytics/match-success
GET    /api/analytics/platform-stats
GET    /api/analytics/user-demographics
GET    /api/admin/dashboard-metrics
```

#### Key Metrics Tracking
```javascript
const analyticsMetrics = {
  user_engagement: [
    'daily_active_users',
    'session_duration',
    'feature_usage',
    'retention_rate'
  ],
  matching_success: [
    'match_rate',
    'response_rate',
    'conversation_rate',
    'success_stories'
  ],
  platform_health: [
    'registration_rate',
    'profile_completion',
    'verification_rate',
    'churn_rate'
  ]
};
```

---

### Feature 14: Premium Features
**Priority:** Medium (Revenue generation)  
**Complexity:** High  
**Business Impact:** Monetization

#### Database Entities
- SubscriptionPlan (premium tiers)
- PaymentTransaction (billing)

#### Premium Feature Set
- Unlimited profile views
- See who viewed your profile
- Advanced search filters
- Priority profile placement
- Read message receipts
- Unlimited messaging

---

### Feature 15: Customer Support System
**Priority:** Low (User experience)  
**Complexity:** Medium  
**Business Impact:** User satisfaction

#### Database Entities
- CustomerSupport (tickets)
- AdminAction (support actions)

---

## Dependencies Map

```
PHASE 1 FOUNDATION
├── Auth System (1) → Blocks all other features
├── Profile Management (2) → Required for Discovery (5), Matching (6)
├── Photo Management (3) → Required for Profile (2), Discovery (5)
└── Admin Dashboard (4) → Required for Verification (10), Reports (11)

PHASE 2 CORE
├── Discovery (5) → Requires Profile (2), Photos (3)
├── Matching (6) → Requires Discovery (5), Notifications (9)
├── Messaging (7) → Requires Matching (6)
└── Search (8) → Requires Profile (2)

PHASE 3 ADVANCED
├── Notifications (9) → Required by Matching (6), Messaging (7)
├── Verification (10) → Requires Admin (4)
├── Reports (11) → Requires Admin (4)
└── Family (12) → Independent

PHASE 4 GROWTH
├── Analytics (13) → Requires all user activity
├── Premium (14) → Requires core features
└── Support (15) → Independent
```

## Risk Assessment

### High Risk Features
1. **Real-time Messaging (7)** - Complex Socket.io implementation
2. **Family Features (12)** - Complex permission system
3. **Photo Management (3)** - Large file handling, CDN integration

### Medium Risk Features
1. **Search & Filtering (8)** - Performance with large datasets  
2. **Profile Discovery (5)** - Complex recommendation algorithms
3. **Matching System (6)** - Business logic complexity

### Low Risk Features
1. **Authentication (1)** - Well-established patterns
2. **Admin Dashboard (4)** - Standard CRUD operations
3. **Customer Support (15)** - Simple ticket system

## MVP Definition

**Minimum Viable Product includes Features 1-8:**
- Authentication System
- Profile Management  
- Photo Management
- Admin Dashboard Core
- Profile Discovery & Browsing
- Matching System
- Real-time Messaging
- Search & Filtering

**Post-MVP Features 9-15** can be added incrementally based on user feedback and business priorities.

## Resource Allocation Recommendations

### Backend Team Structure
- **1 Senior Backend Developer** (Lead, Architecture, Complex features)
- **1 Mid-level Backend Developer** (API development, Integration)
- **1 DevOps Engineer** (Infrastructure, Deployment, Monitoring)

### Development Priorities
1. **Focus on PHASE 1 & 2** for MVP launch
2. **Parallel development** of independent features
3. **Rigorous testing** for real-time features
4. **Performance optimization** for discovery algorithms
5. **Security audit** before production launch

This guide provides AI-friendly, detailed specifications for implementing each feature with clear technical requirements, database relationships, and implementation patterns.