-- Migration: 001_create_profiles_table.sql
-- Description: Create profiles table for matrimonial platform
-- Created: 2025-01-02

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Required matrimonial fields
    marital_status TEXT CHECK (marital_status IN ('single', 'divorced', 'widowed', 'separated')),
    education TEXT CHECK (education IN ('high_school', 'diploma', 'bachelors', 'masters', 'phd', 'professional', 'other')),
    occupation TEXT,
    height INTEGER CHECK (height >= 120 AND height <= 250),
    mother_tongue TEXT CHECK (mother_tongue IN ('sinhala', 'tamil', 'english', 'other')),
    
    -- Physical attributes
    weight INTEGER CHECK (weight >= 30 AND weight <= 200),
    body_type TEXT CHECK (body_type IN ('slim', 'average', 'athletic', 'heavy')),
    complexion TEXT CHECK (complexion IN ('fair', 'wheatish', 'dusky', 'dark')),
    
    -- Professional details
    employment_type TEXT CHECK (employment_type IN ('employed', 'self_employed', 'business', 'student', 'unemployed')),
    income INTEGER CHECK (income >= 0),
    work_location JSONB,
    
    -- Cultural details
    caste TEXT,
    sub_caste TEXT,
    family_type TEXT CHECK (family_type IN ('nuclear', 'joint')),
    family_values TEXT CHECK (family_values IN ('traditional', 'moderate', 'liberal')),
    
    -- Lifestyle preferences
    dietary_preference TEXT CHECK (dietary_preference IN ('vegetarian', 'non_vegetarian', 'vegan', 'jain_vegetarian')),
    smoking_habits TEXT CHECK (smoking_habits IN ('never', 'occasionally', 'regularly')),
    drinking_habits TEXT CHECK (drinking_habits IN ('never', 'socially', 'occasionally', 'regularly')),
    
    -- Immigration status (Sri Lankan diaspora focus)
    immigration_status TEXT CHECK (immigration_status IN ('citizen', 'permanent_resident', 'work_visa', 'student_visa', 'other')),
    willing_to_relocate BOOLEAN DEFAULT false,
    
    -- Profile content
    about_me TEXT CHECK (length(about_me) <= 1000),
    family_details TEXT CHECK (length(family_details) <= 1000),
    partner_expectations TEXT CHECK (length(partner_expectations) <= 1000),
    
    -- Media and interests
    profile_photos TEXT[],
    primary_photo_url TEXT,
    hobbies TEXT[],
    interests TEXT[],
    known_languages TEXT[],
    
    -- Profile status and completion
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    is_complete BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id),
    
    -- Ensure at least one of the required fields is present for meaningful profile
    CONSTRAINT valid_profile CHECK (
        marital_status IS NOT NULL OR 
        education IS NOT NULL OR 
        occupation IS NOT NULL
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_public ON profiles(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_profiles_completion ON profiles(completion_percentage);
CREATE INDEX IF NOT EXISTS idx_profiles_is_complete ON profiles(is_complete) WHERE is_complete = true;
CREATE INDEX IF NOT EXISTS idx_profiles_marital_status ON profiles(marital_status);
CREATE INDEX IF NOT EXISTS idx_profiles_education ON profiles(education);
CREATE INDEX IF NOT EXISTS idx_profiles_height ON profiles(height);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own profile (one per user)
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile" ON profiles
    FOR DELETE USING (auth.uid() = user_id);

-- Authenticated users can view public profiles
CREATE POLICY "Authenticated users can view public profiles" ON profiles
    FOR SELECT USING (
        is_public = true 
        AND is_complete = true 
        AND auth.role() = 'authenticated'
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic updated_at
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate profile completion percentage
CREATE OR REPLACE FUNCTION calculate_profile_completion(profile_row profiles)
RETURNS INTEGER AS $$
DECLARE
    required_fields INTEGER := 0;
    optional_fields INTEGER := 0;
    required_total INTEGER := 5; -- marital_status, education, occupation, height, mother_tongue
    optional_total INTEGER := 7; -- about_me, primary_photo_url, etc.
    completion INTEGER;
BEGIN
    -- Count required fields
    IF profile_row.marital_status IS NOT NULL THEN required_fields := required_fields + 1; END IF;
    IF profile_row.education IS NOT NULL THEN required_fields := required_fields + 1; END IF;
    IF profile_row.occupation IS NOT NULL THEN required_fields := required_fields + 1; END IF;
    IF profile_row.height IS NOT NULL THEN required_fields := required_fields + 1; END IF;
    IF profile_row.mother_tongue IS NOT NULL THEN required_fields := required_fields + 1; END IF;
    
    -- Count optional important fields
    IF profile_row.about_me IS NOT NULL AND length(profile_row.about_me) > 0 THEN optional_fields := optional_fields + 1; END IF;
    IF profile_row.primary_photo_url IS NOT NULL THEN optional_fields := optional_fields + 1; END IF;
    IF profile_row.dietary_preference IS NOT NULL THEN optional_fields := optional_fields + 1; END IF;
    IF profile_row.family_type IS NOT NULL THEN optional_fields := optional_fields + 1; END IF;
    IF profile_row.immigration_status IS NOT NULL THEN optional_fields := optional_fields + 1; END IF;
    IF profile_row.income IS NOT NULL THEN optional_fields := optional_fields + 1; END IF;
    IF profile_row.body_type IS NOT NULL THEN optional_fields := optional_fields + 1; END IF;
    
    -- Calculate completion percentage (60% required, 40% optional)
    completion := ROUND((required_fields::FLOAT / required_total * 60) + (optional_fields::FLOAT / optional_total * 40));
    
    RETURN LEAST(100, GREATEST(0, completion));
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE profiles IS 'Matrimonial profiles for DeeGey platform users';
COMMENT ON COLUMN profiles.user_id IS 'Foreign key to auth.users table';
COMMENT ON COLUMN profiles.completion_percentage IS 'Calculated profile completion score (0-100)';
COMMENT ON COLUMN profiles.is_public IS 'Whether profile is visible in public search';
COMMENT ON COLUMN profiles.is_verified IS 'Whether profile has been verified by admin';

-- Grant permissions (Supabase handles this automatically, but documenting)
-- GRANT ALL ON profiles TO authenticated;
-- GRANT ALL ON profiles TO service_role;