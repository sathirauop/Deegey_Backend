-- Migration: Create profile_views table for tracking profile visits
-- This table logs when users view other users' profiles

CREATE TABLE IF NOT EXISTS profile_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    view_duration_seconds INTEGER, -- Optional: track how long they viewed
    view_source VARCHAR(50), -- Where they viewed from: search, match, direct, etc.
    
    -- Ensure users can't view themselves (optional, might want to allow for testing)
    CONSTRAINT different_users CHECK (viewer_id != viewed_profile_id)
);

-- Indexes for performance
CREATE INDEX idx_profile_views_viewer ON profile_views(viewer_id);
CREATE INDEX idx_profile_views_viewed_profile ON profile_views(viewed_profile_id);
CREATE INDEX idx_profile_views_viewed_at ON profile_views(viewed_at DESC);
CREATE INDEX idx_profile_views_source ON profile_views(view_source);

-- Composite index for getting unique viewers
CREATE INDEX idx_profile_views_unique_viewers ON profile_views(viewed_profile_id, viewer_id, viewed_at DESC);

-- Function to get profile view statistics
CREATE OR REPLACE FUNCTION get_profile_view_stats(user_id UUID, period_days INTEGER DEFAULT 7)
RETURNS TABLE (
    total_views BIGINT,
    unique_viewers BIGINT,
    views_today BIGINT,
    views_this_period BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_views,
        COUNT(DISTINCT viewer_id)::BIGINT as unique_viewers,
        COUNT(CASE WHEN viewed_at >= CURRENT_DATE THEN 1 END)::BIGINT as views_today,
        COUNT(CASE WHEN viewed_at >= CURRENT_DATE - INTERVAL '1 day' * period_days THEN 1 END)::BIGINT as views_this_period
    FROM profile_views
    WHERE viewed_profile_id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent viewers
CREATE OR REPLACE FUNCTION get_recent_profile_viewers(user_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    viewer_id UUID,
    last_viewed_at TIMESTAMPTZ,
    view_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pv.viewer_id,
        MAX(pv.viewed_at) as last_viewed_at,
        COUNT(*)::BIGINT as view_count
    FROM profile_views pv
    WHERE pv.viewed_profile_id = user_id
    GROUP BY pv.viewer_id
    ORDER BY MAX(pv.viewed_at) DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see who viewed their profile
CREATE POLICY profile_views_viewed_user_policy ON profile_views
    FOR SELECT
    USING (auth.uid() = viewed_profile_id);

-- Policy: Users can see their own viewing history
CREATE POLICY profile_views_viewer_policy ON profile_views
    FOR SELECT
    USING (auth.uid() = viewer_id);

-- Policy: Users can insert their own views
CREATE POLICY profile_views_insert_policy ON profile_views
    FOR INSERT
    WITH CHECK (auth.uid() = viewer_id);

-- Comments for documentation
COMMENT ON TABLE profile_views IS 'Tracks profile view events for analytics and notifications';
COMMENT ON COLUMN profile_views.view_duration_seconds IS 'Optional: how long the viewer stayed on the profile';
COMMENT ON COLUMN profile_views.view_source IS 'Source of the view: search, match, direct, notification, etc.';
COMMENT ON FUNCTION get_profile_view_stats IS 'Get profile view statistics for a user';
COMMENT ON FUNCTION get_recent_profile_viewers IS 'Get recent unique viewers of a profile';