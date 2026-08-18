-- Migration 002: Create OTP Verifications Table
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(30) NOT NULL 
        CHECK (purpose IN ('EMAIL_VERIFICATION', 'MOBILE_VERIFICATION', 'PASSWORD_RESET')),
    channel VARCHAR(10) NOT NULL 
        CHECK (channel IN ('EMAIL', 'SMS')),
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp_verifications(user_id, purpose, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_created_at ON otp_verifications(created_at);
