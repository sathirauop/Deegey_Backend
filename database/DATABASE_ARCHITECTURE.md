# Database Architecture Summary

## Overview
This document summarizes the database schema implemented for the DeeGey matrimonial platform. The architecture supports connection requests, notifications, advanced searching, and activity tracking as specified in the requirements.

## Existing Tables (Pre-existing)
1. **auth.users** - Supabase Auth table with custom metadata
2. **profiles** - Comprehensive matrimonial profile data

## New Tables Created

### 1. **match_interests** (005)
Tracks interest expressions between users (connection requests).
- Supports sent/received/accepted/declined states
- Includes optional message with interest
- Automatic cleanup on user blocks
- RLS policies for sender/receiver access

### 2. **connections** (006)
Stores established mutual connections after interests are accepted.
- Bidirectional relationship (uses ordered user IDs)
- Tracks connection status and last interaction
- Helper function `get_user_connections()` for easy querying

### 3. **profile_views** (007)
Logs when users view other profiles.
- Tracks view source and optional duration
- Provides view statistics and recent viewers
- Triggers notifications on profile views
- Helper functions for analytics

### 4. **notifications** (008)
Central notification system for all user events.
- Supports multiple notification types
- Read/unread status tracking
- Actionable notifications with URLs
- Helper function `get_notification_counts()` for dashboard

### 5. **activities** (009)
Activity feed for user dashboard.
- Logs various user activities
- Public/private activity support
- Dual-logging for target users
- Helper function `get_user_activity_feed()`

### 6. **search_preferences** (010)
Saved search criteria for partner discovery.
- Comprehensive filtering options
- Default search preference support
- Last used tracking
- Helper function `search_profiles_with_preferences()`

### 7. **user_blocks** (011)
Blocking functionality to prevent unwanted interactions.
- Bidirectional blocking
- Automatic cleanup of connections/interests
- Helper functions for block checking

### 8. **featured_members** (012)
Manages featured profiles for landing page.
- Priority-based display
- Auto-featuring of verified members
- Expiration support
- Helper function `get_featured_members()`

### 9. **Helper Functions & Triggers** (013)
Additional functions and triggers for table interactions:
- `get_dashboard_stats()` - Dashboard statistics
- `get_recent_matches()` - Recent match suggestions
- Notification triggers for various events
- Gender column addition for search functionality

## Key Features Implemented

### Connection Request Flow
1. User sends interest via `match_interests` table
2. Recipient can accept/decline
3. Acceptance creates entry in `connections` table
4. Notifications sent at each step

### Notification System
- Real-time notification counts
- Multiple notification types
- Automatic creation via triggers
- Dashboard badge support

### Activity Tracking
- All major user actions logged
- Feed generation for dashboard
- Privacy controls (public/private)

### Search & Discovery
- Save multiple search preferences
- Advanced filtering criteria
- Profile matching queries
- Featured member showcase

### Security Features
- Row Level Security (RLS) on all tables
- User can only access their own data
- Blocking prevents all interactions
- Proper foreign key constraints

## Database Relationships
```
auth.users
    ↓
profiles
    ↓
├── match_interests (from/to users)
├── connections (user pairs)
├── profile_views (viewer/viewed)
├── notifications (user notifications)
├── activities (user activities)
├── search_preferences (user preferences)
├── user_blocks (blocker/blocked)
└── featured_members (featured users)
```

## Performance Optimizations
- Indexes on all foreign keys
- Composite indexes for common queries
- Partial indexes where applicable
- Helper functions to reduce query complexity

## Next Steps
1. Run migrations in sequence (001-013)
2. Test RLS policies
3. Implement API endpoints to use these tables
4. Add messaging tables in Phase 2
5. Add subscription/payment tables in Phase 3

## Migration Order
```sql
001_create_profiles_table.sql
002_add_profile_completion_stage.sql
003_add_minimal_profile_completion.sql
004_simplify_profile_completion.sql
005_create_match_interests_table.sql
006_create_connections_table.sql
007_create_profile_views_table.sql
008_create_notifications_table.sql
009_create_activities_table.sql
010_create_search_preferences_table.sql
011_create_user_blocks_table.sql
012_create_featured_members_table.sql
013_add_helper_functions_and_triggers.sql
```

All tables include proper indexing, RLS policies, and helper functions for common operations.