-- ============================================================================
-- Migration 006: Create Incident Verifications Table
-- Module 5: Community Verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS incident_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_type VARCHAR(20) NOT NULL CHECK (verification_type IN ('CONFIRM', 'DISPUTE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_incident_verification_user UNIQUE (incident_id, user_id)
);

-- Performance Indexes for Quick Aggregation and Lookup
CREATE INDEX IF NOT EXISTS idx_incident_verifications_incident ON incident_verifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_verifications_user ON incident_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_incident_verifications_type ON incident_verifications(verification_type);
