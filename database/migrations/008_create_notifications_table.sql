-- Migration: Create notifications table for user notifications
-- This table stores all types of notifications for users

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'new_match',
        'connection_request',
        'connection_accepted',
        'profile_view',
        'message', -- For future use
        'profile_like',
        'profile_verification',
        'system'
    )),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional data specific to notification type
    related_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_url VARCHAR(255), -- URL to navigate when notification is clicked
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    is_actionable BOOLEAN DEFAULT FALSE NOT NULL, -- If notification requires user action
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ -- Optional expiration for time-sensitive notifications
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_related_user ON notifications(related_user_id);

-- Composite indexes for common queries
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_recent ON notifications(user_id, created_at DESC);

-- Function to get notification counts by type
CREATE OR REPLACE FUNCTION get_notification_counts(user_id UUID)
RETURNS TABLE (
    total_count BIGINT,
    unread_count BIGINT,
    connection_requests BIGINT,
    new_matches BIGINT,
    profile_views BIGINT,
    messages BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_count,
        COUNT(CASE WHEN NOT is_read THEN 1 END)::BIGINT as unread_count,
        COUNT(CASE WHEN type = 'connection_request' AND NOT is_read THEN 1 END)::BIGINT as connection_requests,
        COUNT(CASE WHEN type = 'new_match' AND NOT is_read THEN 1 END)::BIGINT as new_matches,
        COUNT(CASE WHEN type = 'profile_view' AND NOT is_read THEN 1 END)::BIGINT as profile_views,
        COUNT(CASE WHEN type = 'message' AND NOT is_read THEN 1 END)::BIGINT as messages
    FROM notifications n
    WHERE n.user_id = get_notification_counts.user_id
        AND (n.expires_at IS NULL OR n.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_related_user_id UUID DEFAULT NULL,
    p_action_url VARCHAR(255) DEFAULT NULL,
    p_is_actionable BOOLEAN DEFAULT FALSE,
    p_data JSONB DEFAULT '{}',
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (
        user_id, type, title, message, related_user_id, 
        action_url, is_actionable, data, expires_at
    ) VALUES (
        p_user_id, p_type, p_title, p_message, p_related_user_id,
        p_action_url, p_is_actionable, p_data, p_expires_at
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update read_at when marking as read
CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
        NEW.read_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_read_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_read_at();

-- Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY notifications_user_policy ON notifications
    FOR ALL
    USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE notifications IS 'Stores all user notifications with support for various notification types';
COMMENT ON COLUMN notifications.data IS 'JSONB field for type-specific additional data';
COMMENT ON COLUMN notifications.is_actionable IS 'Whether the notification requires user action (e.g., accept/decline)';
COMMENT ON COLUMN notifications.expires_at IS 'Optional expiration timestamp for time-sensitive notifications';
COMMENT ON FUNCTION get_notification_counts IS 'Get notification counts by type for dashboard badges';
COMMENT ON FUNCTION create_notification IS 'Helper function to create notifications with proper defaults';