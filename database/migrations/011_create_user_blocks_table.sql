-- Migration: Create user_blocks table for blocking functionality
-- This table tracks when users block other users

CREATE TABLE IF NOT EXISTS user_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason VARCHAR(100), -- Optional reason for blocking
    blocked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure users can't block themselves
    CONSTRAINT different_users CHECK (blocker_id != blocked_id),
    -- Ensure unique block per user pair
    CONSTRAINT unique_block UNIQUE(blocker_id, blocked_id)
);

-- Indexes for performance
CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);
CREATE INDEX idx_user_blocks_blocked_at ON user_blocks(blocked_at DESC);

-- Function to check if user A has blocked user B or vice versa
CREATE OR REPLACE FUNCTION is_blocked_between_users(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_blocks
        WHERE (blocker_id = user1_id AND blocked_id = user2_id)
           OR (blocker_id = user2_id AND blocked_id = user1_id)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get all blocked user IDs for a user
CREATE OR REPLACE FUNCTION get_blocked_user_ids(user_id UUID)
RETURNS TABLE (blocked_user_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT blocked_id as blocked_user_id
    FROM user_blocks
    WHERE blocker_id = user_id
    UNION
    SELECT blocker_id as blocked_user_id
    FROM user_blocks
    WHERE blocked_id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to clean up related data when a user is blocked
CREATE OR REPLACE FUNCTION handle_user_block()
RETURNS TRIGGER AS $$
BEGIN
    -- Remove any existing connections
    DELETE FROM connections
    WHERE (user1_id = NEW.blocker_id AND user2_id = NEW.blocked_id)
       OR (user1_id = NEW.blocked_id AND user2_id = NEW.blocker_id);
    
    -- Cancel any pending match interests
    UPDATE match_interests
    SET status = 'withdrawn'
    WHERE status = 'pending'
      AND ((from_user_id = NEW.blocker_id AND to_user_id = NEW.blocked_id)
        OR (from_user_id = NEW.blocked_id AND to_user_id = NEW.blocker_id));
    
    -- Log activity
    PERFORM log_activity(
        NEW.blocker_id,
        'user_blocked',
        NEW.blocker_id,
        NEW.blocked_id,
        jsonb_build_object('reason', NEW.reason),
        FALSE -- Private activity
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_user_block
    AFTER INSERT ON user_blocks
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_block();

-- Row Level Security
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see blocks they created
CREATE POLICY user_blocks_blocker_policy ON user_blocks
    FOR ALL
    USING (auth.uid() = blocker_id);

-- Policy: Users can see if they are blocked (for UI purposes)
CREATE POLICY user_blocks_blocked_policy ON user_blocks
    FOR SELECT
    USING (auth.uid() = blocked_id);

-- Comments for documentation
COMMENT ON TABLE user_blocks IS 'Tracks blocked users to prevent unwanted interactions';
COMMENT ON COLUMN user_blocks.reason IS 'Optional reason for blocking (spam, harassment, etc.)';
COMMENT ON FUNCTION is_blocked_between_users IS 'Check if any blocking relationship exists between two users';
COMMENT ON FUNCTION get_blocked_user_ids IS 'Get all user IDs that have blocking relationship with given user';
COMMENT ON TRIGGER trigger_handle_user_block IS 'Clean up connections and match interests when user is blocked';