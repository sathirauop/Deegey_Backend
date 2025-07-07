-- Migration: Create match_interests table for connection requests
-- This table tracks interest expressions between users (like "Send Interest" functionality)

CREATE TABLE IF NOT EXISTS match_interests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
    message TEXT, -- Optional message with the interest
    responded_at TIMESTAMPTZ, -- When the recipient responded
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure users can't send interest to themselves
    CONSTRAINT different_users CHECK (from_user_id != to_user_id),
    -- Ensure unique interest per user pair (one-way)
    CONSTRAINT unique_interest UNIQUE(from_user_id, to_user_id)
);

-- Indexes for performance
CREATE INDEX idx_match_interests_from_user ON match_interests(from_user_id);
CREATE INDEX idx_match_interests_to_user ON match_interests(to_user_id);
CREATE INDEX idx_match_interests_status ON match_interests(status);
CREATE INDEX idx_match_interests_created_at ON match_interests(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_match_interests_updated_at
    BEFORE UPDATE ON match_interests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE match_interests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see interests they sent
CREATE POLICY match_interests_sender_policy ON match_interests
    FOR ALL
    USING (auth.uid() = from_user_id);

-- Policy: Users can see interests they received
CREATE POLICY match_interests_receiver_policy ON match_interests
    FOR SELECT
    USING (auth.uid() = to_user_id);

-- Policy: Recipients can update (accept/decline) interests they received
CREATE POLICY match_interests_receiver_update_policy ON match_interests
    FOR UPDATE
    USING (auth.uid() = to_user_id AND status = 'pending')
    WITH CHECK (auth.uid() = to_user_id);

-- Comments for documentation
COMMENT ON TABLE match_interests IS 'Tracks interest expressions between users for connection requests';
COMMENT ON COLUMN match_interests.status IS 'Status of the interest: pending, accepted, declined, withdrawn';
COMMENT ON COLUMN match_interests.message IS 'Optional message sent with the interest expression';
COMMENT ON COLUMN match_interests.responded_at IS 'Timestamp when the recipient responded to the interest';