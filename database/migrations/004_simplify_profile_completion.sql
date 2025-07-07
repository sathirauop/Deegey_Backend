-- Migration: 004_simplify_profile_completion.sql
-- Description: Simplify profile completion by removing stage tracking
-- Created: 2025-01-06

-- Remove the profile_completion_stage column as we no longer track stages
ALTER TABLE auth.users DROP COLUMN IF EXISTS profile_completion_stage;

-- Remove the registration_step column as it's no longer needed
ALTER TABLE auth.users DROP COLUMN IF EXISTS registration_step;

-- Drop the enum type if it exists
DROP TYPE IF EXISTS profile_completion_stage;

-- Keep only minimal_profile_completion for tracking dashboard access
-- This is all we need: either they've submitted initial profile or not

-- Comments for documentation
COMMENT ON COLUMN auth.users.minimal_profile_completion IS 'True when user has submitted initial profile and can access dashboard';

-- Drop indexes that are no longer needed
DROP INDEX IF EXISTS idx_users_profile_completion_stage;
DROP INDEX IF EXISTS idx_users_registration_step;