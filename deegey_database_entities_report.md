# DeeGey Platform - Database Entities Report

**Date:** July 1, 2025  
**Project:** DeeGey Matrimonial Platform - Database Design  
**Version:** MVP Entity Specification  
**Target:** Express.js + Supabase PostgreSQL Backend

---

## Executive Summary

This report defines 28 core database entities required for DeeGey's matrimonial platform MVP. Entity fields are based on existing Flutter mobile app implementation where available, with additional MVP-essential fields defined for new entities. The design supports real-time messaging, advanced matching, family involvement, and platform administration.

**Database Count:** 28 core tables + 5 junction tables = 33 total tables for MVP

---

## Core User Entities

### 1. User (Based on existing UserEntity)
**Purpose:** Basic authentication and account management
**Fields:**
- id (UUID, Primary Key)
- email (String, Unique, Required)
- password_hash (String, Required)
- display_name (String, Required)
- avatar_url (String, Nullable)
- is_verified (Boolean, Default: false)
- is_email_verified (Boolean, Default: false)
- last_login (Timestamp, Nullable)
- role (Enum: 'user', 'admin', 'moderator', Default: 'user')
- account_status (Enum: 'active', 'suspended', 'deactivated', Default: 'active')
- created_at (Timestamp, Required)
- updated_at (Timestamp, Required)

### 2. Profile (Based on existing MemberProfileEntity)
**Purpose:** Detailed matrimonial profile information
**Fields:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to User, Unique)
- display_name (String, Required)
- profile_image (String, Nullable)
- profile_images (JSON Array, Default: [])
- age (Integer, Nullable)
- date_of_birth (Date, Nullable)
- gender (String, Nullable)
- height (String, Nullable)
- weight (String, Nullable)
- body_type (String, Nullable)
- complexion (String, Nullable)
- country (String, Nullable)
- state (String, Nullable)
- city (String, Nullable)
- address (String, Nullable)
- latitude (Decimal, Nullable)
- longitude (Decimal, Nullable)
- religion (String, Nullable)
- caste (String, Nullable)
- sub_caste (String, Nullable)
- mother_tongue (String, Nullable)
- languages (JSON Array, Default: [])
- ethnicity (String, Nullable)
- education_level (String, Nullable)
- field_of_study (String, Nullable)
- occupation (String, Nullable)
- company (String, Nullable)
- income (String, Nullable)
- income_range (String, Nullable)
- family_type (String, Nullable)
- family_status (String, Nullable)
- father_occupation (String, Nullable)
- mother_occupation (String, Nullable)
- siblings (Integer, Nullable)
- brothers_married (Integer, Nullable)
- sisters_married (Integer, Nullable)
- marital_status (String, Nullable)
- has_children (Boolean, Default: false)
- number_of_children (Integer, Nullable)
- smoking (String, Nullable)
- drinking (String, Nullable)
- diet (String, Nullable)
- hobbies (JSON Array, Default: [])
- interests (JSON Array, Default: [])
- looking_for (String, Nullable)
- preferred_age_min (Integer, Nullable)
- preferred_age_max (Integer, Nullable)
- preferred_religions (JSON Array, Default: [])
- preferred_locations (JSON Array, Default: [])
- preferred_education (String, Nullable)
- preferred_occupation (String, Nullable)
- is_active (Boolean, Default: true)
- is_premium (Boolean, Default: false)
- is_verified (Boolean, Default: false)
- last_active (Timestamp, Nullable)
- show_contact_info (Boolean, Default: false)
- show_last_active (Boolean, Default: true)
- show_age (Boolean, Default: true)
- bio (Text, Nullable)
- about_family (Text, Nullable)
- partner_expectations (Text, Nullable)
- profile_completion_score (Integer, Default: 0)
- created_at (Timestamp, Required)
- updated_at (Timestamp, Required)

### 3. ProfilePhoto
**Purpose:** Multiple profile photos with verification
**Fields:**
- id (UUID, Primary Key)
- profile_id (UUID, Foreign Key to Profile)
- photo_url (String, Required)
- is_primary (Boolean, Default: false)
- is_verified (Boolean, Default: false)
- upload_order (Integer, Default: 0)
- file_size (Integer, Nullable)
- created_at (Timestamp, Required)

### 4. ProfileVerification
**Purpose:** Profile and photo verification tracking
**Fields:**
- id (UUID, Primary Key)
- profile_id (UUID, Foreign Key to Profile)
- verification_type (Enum: 'profile', 'photo', 'document')
- status (Enum: 'pending', 'approved', 'rejected', Default: 'pending')
- submitted_data (JSON, Nullable)
- admin_notes (Text, Nullable)
- verified_by (UUID, Foreign Key to User, Nullable)
- verified_at (Timestamp, Nullable)
- created_at (Timestamp, Required)

---

## Matching & Discovery Entities

### 5. Match
**Purpose:** Like/interest system between users
**Fields:**
- id (UUID, Primary Key)
- sender_id (UUID, Foreign Key to User)
- receiver_id (UUID, Foreign Key to User)
- status (Enum: 'pending', 'accepted', 'declined', 'blocked', Default: 'pending')
- match_type (Enum: 'like', 'super_like', 'interest', Default: 'like')
- is_mutual (Boolean, Default: false)
- mutual_date (Timestamp, Nullable)
- message (Text, Nullable)
- sender_profile_view_count (Integer, Default: 0)
- created_at (Timestamp, Required)
- updated_at (Timestamp, Required)

### 6. SearchFilter
**Purpose:** Saved search criteria and preferences
**Fields:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to User)
- name (String, Required)
- filters (JSON, Required)
- is_default (Boolean, Default: false)
- created_at (Timestamp, Required)
- updated_at (Timestamp, Required)

### 7. ProfileView
**Purpose:** Track who viewed whose profile
**Fields:**
- id (UUID, Primary Key)
- viewer_id (UUID, Foreign Key to User)
- viewed_profile_id (UUID, Foreign Key to Profile)
- view_count (Integer, Default: 1)
- last_viewed_at (Timestamp, Required)
- created_at (Timestamp, Required)

### 8. Block
**Purpose:** Blocked users management
**Fields:**
- id (UUID, Primary Key)
- blocker_id (UUID, Foreign Key to User)
- blocked_id (UUID, Foreign Key to User)
- reason (String, Nullable)
- created_at (Timestamp, Required)

### 9. Favorite
**Purpose:** Saved/bookmarked profiles
**Fields:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to User)
- profile_id (UUID, Foreign Key to Profile)
- notes (Text, Nullable)
- created_at (Timestamp, Required)

---

## Communication Entities

### 10. Conversation
**Purpose:** Chat conversations between matched users
**Fields:**
- id (UUID, Primary Key)
- participants (JSON Array, Required)
- last_message (Text, Nullable)
- last_message_at (Timestamp, Nullable)
- last_message_by (UUID, Foreign Key to User, Nullable)
- is_active (Boolean, Default: true)
- is_blocked (Boolean, Default: false)
- blocked_by (UUID, Foreign Key to User, Nullable)
- total_messages (Integer, Default: 0)
- unread_count (JSON, Default: {})
- created_at (Timestamp, Required)
- updated_at (Timestamp, Required)

### 11. Message
**Purpose:** Individual chat messages
**Fields:**
- id (UUID, Primary Key)
- conversation_id (UUID, Foreign Key to Conversation)
- sender_id (UUID, Foreign Key to User)
- content (Text, Required)
- message_type (Enum: 'text', 'image', 'emoji', Default: 'text')
- is_read (Boolean, Default: false)
- read_at (Timestamp, Nullable)
- is_delivered (Boolean, Default: false)
- delivered_at (Timestamp, Nullable)
- is_reported (Boolean, Default: false)
- is_deleted (Boolean, Default: false)
- deleted_by (UUID, Foreign Key to User, Nullable)
- created_at (Timestamp, Required)

### 12. MessageAttachment
**Purpose:** Photos/files shared in messages
**Fields:**
- id (UUID, Primary Key)
- message_id (UUID, Foreign Key to Message)
- file_url (String, Required)
- file_type (String, Required)
- file_size (Integer, Nullable)
- created_at (Timestamp, Required)

---

## Engagement & Notifications Entities

### 13. Notification
**Purpose:** Push and in-app notifications
**Fields:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to User)
- title (String, Required)
- message (String, Required)
- type (Enum: 'new_match', 'new_message', 'profile_view', 'interest_received', 'system')
- related_user_id (UUID, Foreign Key to User, Nullable)
- related_entity_id (UUID, Nullable)
- related_entity_type (String, Nullable)
- is_read (Boolean, Default: false)
- read_at (Timestamp, Nullable)
- is_sent (Boolean, Default: false)
- sent_at (Timestamp, Nullable)
- push_notification_id (String, Nullable)
- created_at (Timestamp, Required)

### 14. UserActivity
**Purpose:** Login history and activity tracking
**Fields:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to User)
- activity_type (Enum: 'login', 'logout', 'profile_update', 'search', 'match_action')
- ip_address (String, Nullable)
- user_agent (String, Nullable)
- device_info (JSON, Nullable)
- created_at (Timestamp, Required)

### 15. DeviceToken
**Purpose:** FCM tokens for push notifications
**Fields:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to User)
- token (String, Required, Unique)
- platform (Enum: 'ios', 'android', 'web')
- is_active (Boolean, Default: true)
- created_at (Timestamp, Required)
- updated_at (Timestamp, Required)

---

## Family & Community Features

### 16. FamilyMember
**Purpose:** Family members who can assist in profile management
**Fields:**
- id (UUID, Primary Key)
- profile_id (UUID, Foreign Key to Profile)
- name (String, Required)
- relationship (String, Required)
- email (String, Nullable)
- phone (String, Nullable)
- can_view_matches (Boolean, Default: false)
- can_communicate (Boolean, Default: false)
- is_verified (Boolean, Default: false)
- created_at (Timestamp, Required)

### 17. FamilyInvitation
**Purpose:** Invitations for family involvement
**Fields:**
- id (UUID, Primary Key)
- profile_id (UUID, Foreign Key to Profile)
- inviter_id (UUID, Foreign Key to User)
- email (String, Required)
- role (String, Required)
- permissions (JSON, Default: {})
- status (Enum: 'pending', 'accepted', 'declined', 'expired', Default: 'pending')
- invitation_code (String, Unique, Required)
- expires_at (Timestamp, Required)
- accepted_at (Timestamp, Nullable)
- created_at (Timestamp, Required)

### 18. Testimonial
**Purpose:** Family/friend testimonials for profiles
**Fields:**
- id (UUID, Primary Key)
- profile_id (UUID, Foreign Key to Profile)
- author_name (String, Required)
- author_relationship (String, Required)
- content (Text, Required)
- is_approved (Boolean, Default: false)
- approved_by (UUID, Foreign Key to User, Nullable)
- created_at (Timestamp, Required)

### 19. ReferralCode
**Purpose:** User referral system
**Fields:**
- id (UUID, Primary Key)
- referrer_id (UUID, Foreign Key to User)
- code (String, Unique, Required)
- usage_count (Integer, Default: 0)
- max_uses (Integer, Default: 10)
- reward_type (String, Nullable)
- is_active (Boolean, Default: true)
- expires_at (Timestamp, Nullable)
- created_at (Timestamp, Required)

---

## Platform Management Entities

### 20. Report
**Purpose:** Report inappropriate content/users
**Fields:**
- id (UUID, Primary Key)
- reporter_id (UUID, Foreign Key to User)
- reported_user_id (UUID, Foreign Key to User, Nullable)
- reported_content_id (UUID, Nullable)
- content_type (String, Nullable)
- reason (String, Required)
- description (Text, Nullable)
- status (Enum: 'pending', 'investigating', 'resolved', 'dismissed', Default: 'pending')
- resolved_by (UUID, Foreign Key to User, Nullable)
- resolution_notes (Text, Nullable)
- created_at (Timestamp, Required)
- updated_at (Timestamp, Required)

### 21. AdminAction
**Purpose:** Moderation actions by admin
**Fields:**
- id (UUID, Primary Key)
- admin_id (UUID, Foreign Key to User)
- target_user_id (UUID, Foreign Key to User, Nullable)
- action_type (Enum: 'suspend', 'verify', 'warn', 'delete', 'restore')
- reason (String, Required)
- details (Text, Nullable)
- is_reversible (Boolean, Default: true)
- reversed_at (Timestamp, Nullable)
- reversed_by (UUID, Foreign Key to User, Nullable)
- created_at (Timestamp, Required)

### 22. CustomerSupport
**Purpose:** Support tickets and conversations
**Fields:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to User)
- subject (String, Required)
- description (Text, Required)
- category (String, Required)
- priority (Enum: 'low', 'medium', 'high', 'urgent', Default: 'medium')
- status (Enum: 'open', 'in_progress', 'resolved', 'closed', Default: 'open')
- assigned_to (UUID, Foreign Key to User, Nullable)
- resolution (Text, Nullable)
- created_at (Timestamp, Required)
- updated_at (Timestamp, Required)

### 23. SystemSetting
**Purpose:** App configuration and feature flags
**Fields:**
- id (UUID, Primary Key)
- key (String, Unique, Required)
- value (JSON, Required)
- description (Text, Nullable)
- is_public (Boolean, Default: false)
- updated_by (UUID, Foreign Key to User)
- updated_at (Timestamp, Required)

---

## Reference/Lookup Entities

### 24. Location
**Purpose:** Countries, states, cities hierarchy
**Fields:**
- id (UUID, Primary Key)
- name (String, Required)
- type (Enum: 'country', 'state', 'city')
- parent_id (UUID, Foreign Key to Location, Nullable)
- country_code (String, Nullable)
- is_active (Boolean, Default: true)

### 25. Religion
**Purpose:** Religious denominations and sects
**Fields:**
- id (UUID, Primary Key)
- name (String, Required)
- parent_id (UUID, Foreign Key to Religion, Nullable)
- is_active (Boolean, Default: true)

### 26. Caste
**Purpose:** Caste/community classifications
**Fields:**
- id (UUID, Primary Key)
- name (String, Required)
- religion_id (UUID, Foreign Key to Religion, Nullable)
- is_active (Boolean, Default: true)

### 27. Education
**Purpose:** Education levels and institutions
**Fields:**
- id (UUID, Primary Key)
- level (String, Required)
- field (String, Nullable)
- institution (String, Nullable)
- is_active (Boolean, Default: true)

### 28. Occupation
**Purpose:** Job categories and specific roles
**Fields:**
- id (UUID, Primary Key)
- category (String, Required)
- title (String, Required)
- industry (String, Nullable)
- is_active (Boolean, Default: true)

---

## Junction Tables (Many-to-Many Relationships)

### 29. user_languages
- user_id (UUID, Foreign Key to User)
- language (String)

### 30. profile_interests  
- profile_id (UUID, Foreign Key to Profile)
- interest (String)

### 31. user_device_tokens
- user_id (UUID, Foreign Key to User)
- device_token_id (UUID, Foreign Key to DeviceToken)

### 32. conversation_participants
- conversation_id (UUID, Foreign Key to Conversation)
- user_id (UUID, Foreign Key to User)
- joined_at (Timestamp)

### 33. referral_uses
- referral_code_id (UUID, Foreign Key to ReferralCode)
- referred_user_id (UUID, Foreign Key to User)
- used_at (Timestamp)

---

## Implementation Notes

### Field Type Standards
- **UUID**: All primary keys and foreign keys
- **Timestamp**: All created_at, updated_at fields with timezone support  
- **JSON**: Complex data structures (arrays, objects) for flexibility
- **Enum**: Predefined values for better data integrity
- **Text**: Long-form content (bio, messages, descriptions)

### Indexing Strategy (For Performance)
- Primary keys (automatic)
- Foreign keys (automatic)
- User lookup fields (email, display_name)
- Search fields (age, location, religion, education)
- Activity fields (last_active, created_at)

### Data Validation
- Email format validation
- Age range validation (18-80)
- Required field enforcement
- Enum value validation
- JSON schema validation for complex fields

**Total Database Structure:** 33 tables supporting comprehensive matrimonial platform with real-time features, family involvement, and advanced matching capabilities.