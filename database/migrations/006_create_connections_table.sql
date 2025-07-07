-- Migration: Create connections table for established mutual connections
-- This table stores confirmed connections after match interests are accepted

CREATE TABLE IF NOT EXISTS connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_interest_id UUID REFERENCES match_interests(id) ON DELETE SET NULL,
    connected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
    ended_at TIMESTAMPTZ,
    ended_by UUID REFERENCES auth.users(id),
    
    -- Ensure users can't connect to themselves
    CONSTRAINT different_users CHECK (user1_id != user2_id),
    -- Ensure unique connection per user pair (bidirectional)
    -- Always store with smaller UUID first to avoid duplicates
    CONSTRAINT unique_connection UNIQUE(user1_id, user2_id),
    CONSTRAINT ordered_users CHECK (user1_id < user2_id)
);

-- Indexes for performance
CREATE INDEX idx_connections_user1 ON connections(user1_id);
CREATE INDEX idx_connections_user2 ON connections(user2_id);
CREATE INDEX idx_connections_status ON connections(status);
CREATE INDEX idx_connections_connected_at ON connections(connected_at DESC);
CREATE INDEX idx_connections_last_interaction ON connections(last_interaction_at DESC);

-- Function to get all connections for a user
CREATE OR REPLACE FUNCTION get_user_connections(user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connected_user_id UUID,
    connected_at TIMESTAMPTZ,
    last_interaction_at TIMESTAMPTZ,
    status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        CASE 
            WHEN c.user1_id = user_id THEN c.user2_id
            ELSE c.user1_id
        END as connected_user_id,
        c.connected_at,
        c.last_interaction_at,
        c.status
    FROM connections c
    WHERE (c.user1_id = user_id OR c.user2_id = user_id)
        AND c.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own connections
CREATE POLICY connections_user_policy ON connections
    FOR ALL
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Comments for documentation
COMMENT ON TABLE connections IS 'Stores established mutual connections between users';
COMMENT ON COLUMN connections.match_interest_id IS 'Reference to the original match interest that created this connection';
COMMENT ON COLUMN connections.status IS 'Connection status: active, paused, or ended';
COMMENT ON COLUMN connections.last_interaction_at IS 'Last time users interacted (message, view, etc.)';
COMMENT ON FUNCTION get_user_connections IS 'Helper function to get all active connections for a user';