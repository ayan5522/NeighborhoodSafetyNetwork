-- ============================================================================
-- Migration 008: Add Unique Index for Notification Duplicate Prevention
-- Module 7: Real-Time Communication & Notifications (Step 2)
-- ============================================================================

-- Prevents duplicate notifications of the same type for a user on a given incident,
-- while allowing future distinct notification types (e.g. ALERT_RESOLVED) for the same incident.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_incident_type 
ON notifications (user_id, incident_id, type) 
WHERE incident_id IS NOT NULL;
