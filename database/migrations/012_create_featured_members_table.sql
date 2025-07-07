-- Migration: Create featured_members table for landing page showcase
-- This table manages which profiles are featured on the landing page

CREATE TABLE IF NOT EXISTS featured_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    featured_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    featured_until TIMESTAMPTZ, -- Optional end date for featuring
    priority INTEGER DEFAULT 0 NOT NULL, -- Higher priority shows first
    reason VARCHAR(100), -- Why they're featured (new, popular, verified, etc.)
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by UUID REFERENCES auth.users(id), -- Admin who featured them
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure unique featuring per user
    CONSTRAINT unique_featured_user UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_featured_members_user_id ON featured_members(user_id);
CREATE INDEX idx_featured_members_active ON featured_members(is_active);
CREATE INDEX idx_featured_members_priority ON featured_members(priority DESC);
CREATE INDEX idx_featured_members_featured_at ON featured_members(featured_at DESC);

-- Composite index for active featured members query
CREATE INDEX idx_featured_members_active_priority ON featured_members(is_active, priority DESC, featured_at DESC)
    WHERE is_active = TRUE AND (featured_until IS NULL OR featured_until > NOW());

-- Function to get featured members with profile data
CREATE OR REPLACE FUNCTION get_featured_members(p_limit INTEGER DEFAULT 4)
RETURNS TABLE (
    user_id UUID,
    display_name VARCHAR(255),
    age INTEGER,
    profession VARCHAR(255),
    location TEXT,
    verified BOOLEAN,
    profile_photo TEXT,
    joined_date TIMESTAMPTZ,
    featured_reason VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fm.user_id,
        p.display_name,
        EXTRACT(YEAR FROM AGE(p.date_of_birth))::INTEGER as age,
        p.occupation as profession,
        CONCAT(p.current_location_city, ', ', p.current_location_country) as location,
        p.is_verified as verified,
        p.primary_photo_url as profile_photo,
        p.created_at as joined_date,
        fm.reason as featured_reason
    FROM featured_members fm
    INNER JOIN profiles p ON fm.user_id = p.user_id
    WHERE fm.is_active = TRUE
        AND (fm.featured_until IS NULL OR fm.featured_until > NOW())
        AND p.is_public = TRUE
        AND p.primary_photo_url IS NOT NULL
    ORDER BY fm.priority DESC, fm.featured_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-feature new verified members
CREATE OR REPLACE FUNCTION auto_feature_verified_members()
RETURNS void AS $$
DECLARE
    v_user_record RECORD;
BEGIN
    -- Feature recently verified members with complete profiles
    FOR v_user_record IN 
        SELECT p.user_id
        FROM profiles p
        LEFT JOIN featured_members fm ON p.user_id = fm.user_id
        WHERE p.is_verified = TRUE
            AND p.completion_percentage >= 80
            AND p.primary_photo_url IS NOT NULL
            AND fm.id IS NULL -- Not already featured
            AND p.created_at > NOW() - INTERVAL '7 days' -- New members
        ORDER BY p.created_at DESC
        LIMIT 5
    LOOP
        INSERT INTO featured_members (user_id, reason, priority)
        VALUES (v_user_record.user_id, 'new_verified', 1)
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
    
    -- Remove expired featured members
    UPDATE featured_members
    SET is_active = FALSE
    WHERE featured_until IS NOT NULL 
        AND featured_until < NOW()
        AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE featured_members ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read featured members (public data)
CREATE POLICY featured_members_read_policy ON featured_members
    FOR SELECT
    USING (TRUE);

-- Policy: Only admins can insert/update/delete (implement admin check as needed)
-- This is a placeholder - you'll need to implement proper admin authentication
CREATE POLICY featured_members_admin_policy ON featured_members
    FOR INSERT
    WITH CHECK (FALSE); -- Replace with actual admin check

-- Comments for documentation
COMMENT ON TABLE featured_members IS 'Manages which profiles are featured on the landing page';
COMMENT ON COLUMN featured_members.priority IS 'Display priority - higher numbers show first';
COMMENT ON COLUMN featured_members.featured_until IS 'Optional expiration date for featuring';
COMMENT ON COLUMN featured_members.reason IS 'Reason for featuring: new_verified, popular, admin_pick, etc.';
COMMENT ON FUNCTION get_featured_members IS 'Get featured members with their profile data for landing page';
COMMENT ON FUNCTION auto_feature_verified_members IS 'Automatically feature new verified members with complete profiles';