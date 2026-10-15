-- ==========================================================
--     NEXORA ANTICHEAT - SUPABASE POSTGRESQL SCHEMA
-- ==========================================================
-- You can run this script directly in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run!
--
-- Note: The Nexora Panel backend also auto-creates these tables
-- automatically when connected via DATABASE_URL!
-- ==========================================================

-- 1. Licenses Table (cryptographic keys, tiers, owner, bound IP)
CREATE TABLE IF NOT EXISTS nexora_licenses (
    key VARCHAR(64) PRIMARY KEY,
    owner VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    tier VARCHAR(64) NOT NULL DEFAULT 'LIFETIME',
    status VARCHAR(64) NOT NULL DEFAULT 'ACTIVE',
    bound_ip VARCHAR(64),
    max_servers INT NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL,
    expires_at BIGINT,
    ban_reason TEXT
);

-- 2. Minecraft Servers Fleet Table
CREATE TABLE IF NOT EXISTS nexora_servers (
    id VARCHAR(64) PRIMARY KEY,
    license_key VARCHAR(64) NOT NULL REFERENCES nexora_licenses(key) ON DELETE CASCADE,
    server_name VARCHAR(255) NOT NULL,
    ip VARCHAR(64) NOT NULL,
    port INT NOT NULL DEFAULT 25565,
    mc_version VARCHAR(128),
    plugin_version VARCHAR(64),
    online_players INT NOT NULL DEFAULT 0,
    tps DOUBLE PRECISION NOT NULL DEFAULT 20.0,
    status VARCHAR(64) NOT NULL DEFAULT 'ONLINE',
    last_heartbeat BIGINT NOT NULL,
    first_seen BIGINT NOT NULL
);

-- 3. Telemetry & Cheat Violations Log Table
CREATE TABLE IF NOT EXISTS nexora_violations (
    id VARCHAR(64) PRIMARY KEY,
    license_key VARCHAR(64) NOT NULL REFERENCES nexora_licenses(key) ON DELETE CASCADE,
    server_name VARCHAR(255),
    player_name VARCHAR(64) NOT NULL,
    check_id VARCHAR(64) NOT NULL,
    vl DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    details TEXT,
    timestamp BIGINT NOT NULL
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_servers_license ON nexora_servers(license_key);
CREATE INDEX IF NOT EXISTS idx_servers_status ON nexora_servers(status);
CREATE INDEX IF NOT EXISTS idx_violations_license ON nexora_violations(license_key);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON nexora_violations(timestamp DESC);

-- Initial seed demo license (if table is empty)
INSERT INTO nexora_licenses (key, owner, email, tier, status, bound_ip, max_servers, created_at, expires_at, ban_reason)
VALUES 
    ('NX-DEMO-2026-KEY1', 'Server Owner Alpha', 'owner@example.com', 'LIFETIME', 'ACTIVE', NULL, 1, EXTRACT(EPOCH FROM NOW()) * 1000, NULL, NULL)
ON CONFLICT (key) DO NOTHING;
