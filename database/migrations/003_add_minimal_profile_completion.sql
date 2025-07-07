-- Migration: 003_add_minimal_profile_completion.sql
-- Description: Add minimal profile completion tracking for two-phase profile system
-- Created: 2025-01-05

-- Add minimal_profile_completion column to auth.users table
ALTER TABLE auth.users ADD COLUMN minimal_profile_completion BOOLEAN DEFAULT FALSE;

-- Create index for performance on minimal profile completion queries
CREATE INDEX IF NOT EXISTS idx_users_minimal_profile_completion ON auth.users(minimal_profile_completion);

-- Update existing users based on their current profile completion stage
-- Users who have completed profile stages should have minimal completion set to true
UPDATE auth.users SET minimal_profile_completion = TRUE 
WHERE profile_completion_stage IN ('completed') 
   OR registration_step IN ('profile_complete', 'profile_stage_4');

-- Comments for documentation
COMMENT ON COLUMN auth.users.minimal_profile_completion IS 'Indicates if user has completed minimal profile requirements and can access dashboard';

-- Grant permissions (Supabase handles this automatically, but documenting)
-- GRANT SELECT, UPDATE ON auth.users TO authenticated;
-- GRANT ALL ON auth.users TO service_role;