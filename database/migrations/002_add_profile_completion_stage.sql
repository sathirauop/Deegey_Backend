-- Migration: 002_add_profile_completion_stage.sql
-- Description: Add profile completion stage enum and column for stage-based navigation
-- Created: 2025-01-05

-- Create enum type for profile completion stages
CREATE TYPE profile_completion_stage AS ENUM (
  'stage1',
  'stage2', 
  'stage3',
  'stage4',
  'completed'
);

-- Add profile completion stage column to auth.users table
ALTER TABLE auth.users ADD COLUMN profile_completion_stage profile_completion_stage DEFAULT 'stage1';

-- Create index for performance on profile completion stage queries
CREATE INDEX IF NOT EXISTS idx_users_profile_completion_stage ON auth.users(profile_completion_stage);

-- Update existing users to have appropriate stage based on their current registration_step
UPDATE auth.users SET profile_completion_stage = 
  CASE 
    WHEN registration_step = 'basic' OR registration_step = 'email_verified' OR registration_step = 'phone_verified' THEN 'stage1'
    WHEN registration_step = 'profile_stage_1' THEN 'stage2'
    WHEN registration_step = 'profile_stage_2' THEN 'stage3'
    WHEN registration_step = 'profile_stage_3' THEN 'stage4'
    WHEN registration_step = 'profile_stage_4' OR registration_step = 'profile_complete' THEN 'completed'
    ELSE 'stage1'
  END;

-- Comments for documentation
COMMENT ON TYPE profile_completion_stage IS 'Enum for tracking user profile completion progress through stages';
COMMENT ON COLUMN auth.users.profile_completion_stage IS 'Current stage of profile completion (stage1-4, completed)';

-- Grant permissions (Supabase handles this automatically, but documenting)
-- GRANT SELECT, UPDATE ON auth.users TO authenticated;
-- GRANT ALL ON auth.users TO service_role;