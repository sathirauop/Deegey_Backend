-- Migration: Create search_preferences table for saved search criteria
-- This table stores user's search preferences for partner discovery

CREATE TABLE IF NOT EXISTS search_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100), -- Optional name for saved search
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Basic preferences
    looking_for VARCHAR(20) CHECK (looking_for IN ('male', 'female', 'any')),
    age_from INTEGER CHECK (age_from >= 18 AND age_from <= 100),
    age_to INTEGER CHECK (age_to >= 18 AND age_to <= 100 AND age_to >= age_from),
    
    -- Location preferences
    countries TEXT[], -- Array of country codes
    cities TEXT[], -- Array of city names
    willing_to_relocate BOOLEAN,
    
    -- Cultural preferences
    religions TEXT[], -- Array of religions
    castes TEXT[], -- Array of castes
    mother_tongues TEXT[], -- Array of languages
    
    -- Physical preferences
    height_from INTEGER, -- in cm
    height_to INTEGER, -- in cm
    body_types TEXT[], -- Array of body types
    complexions TEXT[], -- Array of complexions
    
    -- Professional preferences
    education_levels TEXT[], -- Array of education levels
    occupations TEXT[], -- Array of occupations
    employment_types TEXT[], -- Array of employment types
    income_from INTEGER,
    income_to INTEGER,
    
    -- Lifestyle preferences
    dietary_preferences TEXT[], -- Array of dietary preferences
    smoking_habits TEXT[], -- Array of smoking habits
    drinking_habits TEXT[], -- Array of drinking habits
    
    -- Other preferences
    marital_statuses TEXT[], -- Array of marital statuses
    have_children BOOLEAN,
    want_children BOOLEAN,
    family_types TEXT[], -- Array of family types
    family_values TEXT[], -- Array of family values
    
    -- Search settings
    include_only_verified BOOLEAN DEFAULT FALSE,
    include_only_with_photos BOOLEAN DEFAULT TRUE,
    sort_by VARCHAR(50) DEFAULT 'last_active', -- last_active, newest, match_percentage
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_used_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_search_preferences_user_id ON search_preferences(user_id);
CREATE INDEX idx_search_preferences_is_default ON search_preferences(is_default);
CREATE INDEX idx_search_preferences_last_used ON search_preferences(last_used_at DESC);

-- Ensure only one default search preference per user
CREATE UNIQUE INDEX idx_search_preferences_user_default ON search_preferences(user_id) WHERE is_default = TRUE;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_search_preferences_updated_at
    BEFORE UPDATE ON search_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to apply search preferences to profiles query
CREATE OR REPLACE FUNCTION search_profiles_with_preferences(
    p_search_preference_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    profile_id UUID,
    match_score INTEGER
) AS $$
DECLARE
    v_prefs search_preferences;
BEGIN
    -- Get the search preferences
    SELECT * INTO v_prefs FROM search_preferences WHERE id = p_search_preference_id;
    
    IF v_prefs IS NULL THEN
        RAISE EXCEPTION 'Search preference not found';
    END IF;
    
    -- Update last_used_at
    UPDATE search_preferences SET last_used_at = NOW() WHERE id = p_search_preference_id;
    
    RETURN QUERY
    SELECT 
        p.user_id as profile_id,
        100 as match_score -- Placeholder for actual matching algorithm
    FROM profiles p
    WHERE 
        -- Basic filters
        (v_prefs.looking_for IS NULL OR 
         (v_prefs.looking_for = 'any') OR
         (v_prefs.looking_for = 'male' AND p.gender = 'male') OR
         (v_prefs.looking_for = 'female' AND p.gender = 'female'))
        
        -- Age filter
        AND (v_prefs.age_from IS NULL OR 
             EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= v_prefs.age_from)
        AND (v_prefs.age_to IS NULL OR 
             EXTRACT(YEAR FROM AGE(p.date_of_birth)) <= v_prefs.age_to)
        
        -- Location filters
        AND (v_prefs.countries IS NULL OR p.current_location_country = ANY(v_prefs.countries))
        AND (v_prefs.cities IS NULL OR p.current_location_city = ANY(v_prefs.cities))
        
        -- Cultural filters
        AND (v_prefs.religions IS NULL OR p.religion = ANY(v_prefs.religions))
        AND (v_prefs.castes IS NULL OR p.caste = ANY(v_prefs.castes))
        AND (v_prefs.mother_tongues IS NULL OR p.mother_tongue = ANY(v_prefs.mother_tongues))
        
        -- Other filters
        AND (v_prefs.marital_statuses IS NULL OR p.marital_status = ANY(v_prefs.marital_statuses))
        AND (NOT v_prefs.include_only_verified OR p.is_verified = TRUE)
        AND (NOT v_prefs.include_only_with_photos OR p.primary_photo_url IS NOT NULL)
        AND p.is_public = TRUE
        
    ORDER BY 
        CASE v_prefs.sort_by
            WHEN 'last_active' THEN p.updated_at
            WHEN 'newest' THEN p.created_at
            ELSE p.created_at
        END DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE search_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own search preferences
CREATE POLICY search_preferences_user_policy ON search_preferences
    FOR ALL
    USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE search_preferences IS 'Stores saved search criteria for partner discovery';
COMMENT ON COLUMN search_preferences.is_default IS 'Whether this is the user''s default search preference';
COMMENT ON COLUMN search_preferences.last_used_at IS 'Last time this search preference was used';
COMMENT ON FUNCTION search_profiles_with_preferences IS 'Apply search preferences to find matching profiles';