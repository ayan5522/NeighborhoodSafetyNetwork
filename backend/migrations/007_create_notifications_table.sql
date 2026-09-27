-- ============================================================================
-- Migration 007: Create Notifications Table
-- Module 7: Real-Time Communication & Notifications (Step 1)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (
        type IN (
            'INCIDENT_NEARBY',
            'ALERT_CREATED',
            'ALERT_UPDATED',
            'ALERT_RESOLVED',
            'SOS_NOTIFICATION',
            'COMMUNITY_VERIFICATION',
            'SYSTEM'
        )
    ),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Performance Indexes for Quick Feed Retrieval and Unread Filtering
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_incident ON notifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);
