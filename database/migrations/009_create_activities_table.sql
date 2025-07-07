-- Migration: Create activities table for user activity feed
-- This table logs all user activities for the dashboard activity feed

CREATE TABLE IF NOT EXISTS activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'connection_request_sent',
        'connection_request_received',
        'connection_accepted',
        'profile_viewed',
        'profile_view_received',
        'match_created',
        'profile_liked',
        'profile_updated',
        'photo_uploaded',
        'verification_completed',
        'search_performed'
    )),
    actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- User who performed the action
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- User affected by the action
    metadata JSONB DEFAULT '{}', -- Additional activity-specific data
    is_public BOOLEAN DEFAULT TRUE NOT NULL, -- Whether activity is visible to others
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_actor_id ON activities(actor_id);
CREATE INDEX idx_activities_target_user_id ON activities(target_user_id);
CREATE INDEX idx_activities_type ON activities(type);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);

-- Composite indexes for activity feed queries
CREATE INDEX idx_activities_user_recent ON activities(user_id, created_at DESC);
CREATE INDEX idx_activities_public_recent ON activities(created_at DESC) WHERE is_public = TRUE;

-- Function to get recent activities for a user's feed
CREATE OR REPLACE FUNCTION get_user_activity_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    activity_id UUID,
    activity_type VARCHAR(50),
    actor_id UUID,
    actor_name VARCHAR(255),
    target_user_id UUID,
    target_user_name VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as activity_id,
        a.type as activity_type,
        a.actor_id,
        p1.display_name as actor_name,
        a.target_user_id,
        p2.display_name as target_user_name,
        a.metadata,
        a.created_at
    FROM activities a
    LEFT JOIN profiles p1 ON a.actor_id = p1.user_id
    LEFT JOIN profiles p2 ON a.target_user_id = p2.user_id
    WHERE a.user_id = p_user_id
        OR (a.target_user_id = p_user_id AND a.is_public = TRUE)
    ORDER BY a.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to log an activity
CREATE OR REPLACE FUNCTION log_activity(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_actor_id UUID DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_is_public BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    -- Log activity for the primary user
    INSERT INTO activities (
        user_id, type, actor_id, target_user_id, metadata, is_public
    ) VALUES (
        p_user_id, p_type, COALESCE(p_actor_id, p_user_id), p_target_user_id, p_metadata, p_is_public
    ) RETURNING id INTO activity_id;
    
    -- If there's a target user and the activity is public, log it for them too
    IF p_target_user_id IS NOT NULL AND p_is_public = TRUE AND p_target_user_id != p_user_id THEN
        INSERT INTO activities (
            user_id, type, actor_id, target_user_id, metadata, is_public
        ) VALUES (
            p_target_user_id, p_type, COALESCE(p_actor_id, p_user_id), p_target_user_id, p_metadata, p_is_public
        );
    END IF;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own activities
CREATE POLICY activities_own_policy ON activities
    FOR ALL
    USING (auth.uid() = user_id);

-- Policy: Users can see public activities where they are the target
CREATE POLICY activities_target_policy ON activities
    FOR SELECT
    USING (auth.uid() = target_user_id AND is_public = TRUE);

-- Comments for documentation
COMMENT ON TABLE activities IS 'Logs user activities for the activity feed feature';
COMMENT ON COLUMN activities.actor_id IS 'User who performed the action (defaults to user_id if not specified)';
COMMENT ON COLUMN activities.target_user_id IS 'User affected by the action (e.g., who received the connection request)';
COMMENT ON COLUMN activities.metadata IS 'JSON data specific to the activity type';
COMMENT ON COLUMN activities.is_public IS 'Whether this activity is visible to other users';
COMMENT ON FUNCTION get_user_activity_feed IS 'Get recent activities for a user''s dashboard feed';
COMMENT ON FUNCTION log_activity IS 'Helper function to log activities with automatic dual-logging for target users';