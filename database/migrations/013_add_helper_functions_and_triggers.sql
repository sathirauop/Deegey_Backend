-- Migration: Add helper functions and triggers for table interactions
-- This migration ensures all tables work together with proper triggers and functions

-- Function to check if update_updated_at_column exists (used by multiple tables)
CREATE OR REPLACE FUNCTION create_update_trigger_if_not_exists()
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to create trigger if needed
SELECT create_update_trigger_if_not_exists();

-- Drop the helper function
DROP FUNCTION create_update_trigger_if_not_exists();

-- Trigger to create notification when match interest is accepted
CREATE OR REPLACE FUNCTION notify_match_interest_accepted()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- Create notification for the sender
        PERFORM create_notification(
            NEW.from_user_id,
            'connection_accepted',
            'Connection Accepted!',
            'Your connection request has been accepted',
            NEW.to_user_id,
            '/connections',
            FALSE
        );
        
        -- Create mutual connection
        INSERT INTO connections (user1_id, user2_id, match_interest_id)
        VALUES (
            LEAST(NEW.from_user_id, NEW.to_user_id),
            GREATEST(NEW.from_user_id, NEW.to_user_id),
            NEW.id
        )
        ON CONFLICT (user1_id, user2_id) DO NOTHING;
        
        -- Log activity for both users
        PERFORM log_activity(
            NEW.from_user_id,
            'connection_accepted',
            NEW.to_user_id,
            NEW.from_user_id,
            jsonb_build_object('match_interest_id', NEW.id)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_match_interest_accepted
    AFTER UPDATE ON match_interests
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_match_interest_accepted();

-- Trigger to create notification when someone views a profile
CREATE OR REPLACE FUNCTION notify_profile_view()
RETURNS TRIGGER AS $$
DECLARE
    v_viewer_name TEXT;
BEGIN
    -- Get viewer's display name
    SELECT display_name INTO v_viewer_name
    FROM profiles
    WHERE user_id = NEW.viewer_id;
    
    -- Create notification for the viewed user
    PERFORM create_notification(
        NEW.viewed_profile_id,
        'profile_view',
        'Someone viewed your profile',
        COALESCE(v_viewer_name, 'Someone') || ' viewed your profile',
        NEW.viewer_id,
        '/profile/views',
        FALSE
    );
    
    -- Log activity
    PERFORM log_activity(
        NEW.viewed_profile_id,
        'profile_view_received',
        NEW.viewer_id,
        NEW.viewed_profile_id,
        jsonb_build_object('view_source', NEW.view_source)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_profile_view
    AFTER INSERT ON profile_views
    FOR EACH ROW
    EXECUTE FUNCTION notify_profile_view();

-- Function to get dashboard statistics for a user
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS TABLE (
    new_matches_count BIGINT,
    new_matches_change TEXT,
    connection_requests_count BIGINT,
    connection_requests_change TEXT,
    unread_messages_count BIGINT,
    unread_messages_change TEXT,
    profile_views_count BIGINT,
    profile_views_change TEXT
) AS $$
DECLARE
    v_week_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
    v_day_ago TIMESTAMPTZ := NOW() - INTERVAL '1 day';
BEGIN
    RETURN QUERY
    SELECT
        -- New matches (mutual interests)
        (SELECT COUNT(*) FROM match_interests 
         WHERE to_user_id = p_user_id 
         AND status = 'pending'
         AND created_at > v_week_ago)::BIGINT as new_matches_count,
        
        '+' || (SELECT COUNT(*) FROM match_interests 
                WHERE to_user_id = p_user_id 
                AND status = 'pending'
                AND created_at > v_week_ago)::TEXT || ' this week' as new_matches_change,
        
        -- Connection requests
        (SELECT COUNT(*) FROM match_interests 
         WHERE to_user_id = p_user_id 
         AND status = 'pending')::BIGINT as connection_requests_count,
        
        (SELECT COUNT(*) FROM match_interests 
         WHERE to_user_id = p_user_id 
         AND status = 'pending'
         AND created_at > v_day_ago)::TEXT || ' new today' as connection_requests_change,
        
        -- Unread messages (placeholder - will be 0 for now)
        0::BIGINT as unread_messages_count,
        '0 new today' as unread_messages_change,
        
        -- Profile views
        (SELECT COUNT(*) FROM profile_views 
         WHERE viewed_profile_id = p_user_id
         AND viewed_at > v_week_ago)::BIGINT as profile_views_count,
        
        '+' || (SELECT COUNT(*) FROM profile_views 
                WHERE viewed_profile_id = p_user_id
                AND viewed_at > v_week_ago)::TEXT || ' this week' as profile_views_change;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent matches for a user
CREATE OR REPLACE FUNCTION get_recent_matches(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
    match_id UUID,
    user_id UUID,
    name VARCHAR(255),
    age INTEGER,
    profession VARCHAR(255),
    location TEXT,
    match_percentage INTEGER,
    verified BOOLEAN,
    profile_photo TEXT,
    matched_date TIMESTAMPTZ,
    interest_status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH potential_matches AS (
        -- Get users who sent interest to current user
        SELECT 
            mi.id as match_id,
            mi.from_user_id as matched_user_id,
            mi.created_at as matched_date,
            mi.status as interest_status
        FROM match_interests mi
        WHERE mi.to_user_id = p_user_id
            AND mi.status = 'pending'
        
        UNION ALL
        
        -- Get users current user sent interest to (optional, based on UI needs)
        SELECT 
            mi.id as match_id,
            mi.to_user_id as matched_user_id,
            mi.created_at as matched_date,
            mi.status as interest_status
        FROM match_interests mi
        WHERE mi.from_user_id = p_user_id
            AND mi.status IN ('pending', 'accepted')
    )
    SELECT DISTINCT ON (pm.matched_user_id)
        pm.match_id,
        p.user_id,
        p.display_name as name,
        EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
        p.occupation as profession,
        CONCAT(p.current_location_city, ', ', p.current_location_country) as location,
        95 as match_percentage, -- Placeholder - implement actual matching algorithm
        p.is_verified as verified,
        p.primary_photo_url as profile_photo,
        pm.matched_date,
        pm.interest_status
    FROM potential_matches pm
    INNER JOIN profiles p ON p.user_id = pm.matched_user_id
    WHERE p.is_public = TRUE
        AND NOT EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = p_user_id AND ub.blocked_id = pm.matched_user_id)
               OR (ub.blocker_id = pm.matched_user_id AND ub.blocked_id = p_user_id)
        )
    ORDER BY pm.matched_user_id, pm.matched_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Add gender column to profiles if it doesn't exist (needed for search)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'gender'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other'));
    END IF;
END $$;

-- Create index on gender for search performance
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);

-- Comments for documentation
COMMENT ON FUNCTION get_dashboard_stats IS 'Get all dashboard statistics for a user';
COMMENT ON FUNCTION get_recent_matches IS 'Get recent match suggestions or interests for a user';
COMMENT ON TRIGGER trigger_notify_match_interest_accepted IS 'Creates notifications and connections when match interest is accepted';
COMMENT ON TRIGGER trigger_notify_profile_view IS 'Creates notifications when someone views a profile';