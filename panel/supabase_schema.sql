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

-- 2. Registered Users Table (Auth with Username, Password Hash, Salt & License Key)
CREATE TABLE IF NOT EXISTS nexora_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    license_key VARCHAR(64) NOT NULL REFERENCES nexora_licenses(key) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'USER',
    created_at BIGINT NOT NULL,
    last_login BIGINT
);

-- 3. Minecraft Servers Fleet Table
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

-- 4. User Controlled Player Bans Table
CREATE TABLE IF NOT EXISTS nexora_player_bans (
    id VARCHAR(64) PRIMARY KEY,
    license_key VARCHAR(64) NOT NULL REFERENCES nexora_licenses(key) ON DELETE CASCADE,
    server_name VARCHAR(255),
    player_name VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    duration VARCHAR(64) NOT NULL DEFAULT 'PERMANENT',
    banned_by VARCHAR(64) NOT NULL,
    ip_banned BOOLEAN NOT NULL DEFAULT FALSE,
    banned_at BIGINT NOT NULL,
    expires_at BIGINT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);

-- 5. Telemetry & Cheat Violations Log Table
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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON nexora_users(username);
CREATE INDEX IF NOT EXISTS idx_users_license ON nexora_users(license_key);
CREATE INDEX IF NOT EXISTS idx_servers_license ON nexora_servers(license_key);
CREATE INDEX IF NOT EXISTS idx_servers_status ON nexora_servers(status);
CREATE INDEX IF NOT EXISTS idx_player_bans_license ON nexora_player_bans(license_key);
CREATE INDEX IF NOT EXISTS idx_violations_license ON nexora_violations(license_key);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON nexora_violations(timestamp DESC);
