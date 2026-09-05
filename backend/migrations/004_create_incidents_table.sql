-- Migration: 004_create_incidents_table
-- Purpose: Create incidents spatial table for Module 3 Incident Reporting

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'ACCIDENT',
        'FIRE',
        'SUSPICIOUS_ACTIVITY',
        'ROAD_HAZARD',
        'FLOOD_WATERLOGGING',
        'MEDICAL_EMERGENCY',
        'INFRASTRUCTURE_ISSUE',
        'OTHER'
    )),
    title VARCHAR(120) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'RESOLVED', 'CANCELLED')),
    latitude NUMERIC(10, 7) NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude NUMERIC(10, 7) NOT NULL CHECK (longitude >= -180.0 AND longitude <= 180.0),
    geom GEOGRAPHY(Point, 4326) NOT NULL,
    image_url VARCHAR(500),
    neighborhood_name VARCHAR(150),
    locality VARCHAR(150),
    city VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Spatial Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_reporter_id ON incidents(reporter_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents(category);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_geom ON incidents USING GIST (geom);
