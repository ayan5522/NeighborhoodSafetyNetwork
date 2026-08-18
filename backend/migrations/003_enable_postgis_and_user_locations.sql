-- Migration: 003_enable_postgis_and_user_locations
-- Purpose: Enable PostGIS extension and create user_locations spatial table for Module 2

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create user_locations Table
CREATE TABLE IF NOT EXISTS user_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 7) NOT NULL CHECK (latitude >= -90.0 AND latitude <= 90.0),
    longitude NUMERIC(10, 7) NOT NULL CHECK (longitude >= -180.0 AND longitude <= 180.0),
    geom GEOGRAPHY(Point, 4326) NOT NULL,
    accuracy NUMERIC(8, 2) DEFAULT 0.0 CHECK (accuracy >= 0.0),
    neighborhood_name VARCHAR(150),
    locality VARCHAR(150),
    city VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_locations_user_id UNIQUE (user_id)
);

-- 3. Create Spatial & Query Indexes
CREATE INDEX IF NOT EXISTS idx_user_locations_geom ON user_locations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
