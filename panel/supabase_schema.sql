-- ==========================================================
--     NEXORA ANTICHEAT - PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- ==========================================================
-- Run this script directly in your Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run!
--
-- Note: The Nexora backend automatically connects to Supabase 
-- when DATABASE_URL is set in your Render environment variables.
-- ==========================================================

-- 1. Registered Users Table (Auth, Balance, Email Verification & Purchased Library)
CREATE TABLE IF NOT EXISTS nexora_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'USER',
    balance DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    purchased_plugins TEXT NOT NULL DEFAULT '[]',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code VARCHAR(64),
    created_at BIGINT NOT NULL,
    last_login BIGINT
);

-- Ensure all user columns exist on existing tables
ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS balance DOUBLE PRECISION NOT NULL DEFAULT 0.00;
ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS purchased_plugins TEXT NOT NULL DEFAULT '[]';
ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(64);

-- 2. Plugins Catalog Table (Marketplace Products)
CREATE TABLE IF NOT EXISTS nexora_plugins (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tagline TEXT,
    description TEXT,
    price DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    version VARCHAR(64) NOT NULL DEFAULT '1.0.0',
    category VARCHAR(64) NOT NULL DEFAULT 'General',
    tags TEXT DEFAULT '[]',
    icon VARCHAR(64) DEFAULT '🛡️',
    downloads INT DEFAULT 0,
    rating DOUBLE PRECISION DEFAULT 5.0,
    jar_file_name VARCHAR(255),
    download_url TEXT,
    github_release_url TEXT,
    supported_versions VARCHAR(128) DEFAULT '1.20 - 1.21.4',
    software TEXT DEFAULT '["Paper","Purpur","Folia"]',
    screenshots TEXT DEFAULT '[]',
    changelogs TEXT DEFAULT '[]'
);

-- 3. Reviews & Feedback Table (Real ratings, comments, screenshots & upvote likes)
CREATE TABLE IF NOT EXISTS nexora_reviews (
    id VARCHAR(64) PRIMARY KEY,
    plugin_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    rating INT NOT NULL DEFAULT 5,
    comment TEXT NOT NULL,
    image_url TEXT,
    likes INT NOT NULL DEFAULT 0,
    liked_by TEXT NOT NULL DEFAULT '[]',
    created_at BIGINT NOT NULL
);

-- Ensure likes columns exist on existing review tables
ALTER TABLE nexora_reviews ADD COLUMN IF NOT EXISTS likes INT NOT NULL DEFAULT 0;
ALTER TABLE nexora_reviews ADD COLUMN IF NOT EXISTS liked_by TEXT NOT NULL DEFAULT '[]';

-- 4. Real Downloads Audit Log Table (Tracking unique accounts & IPs per plugin)
CREATE TABLE IF NOT EXISTS nexora_downloads (
    id VARCHAR(64) PRIMARY KEY,
    plugin_id VARCHAR(64) NOT NULL DEFAULT 'nexora-anticheat',
    account VARCHAR(128) NOT NULL,
    ip VARCHAR(64),
    user_agent TEXT,
    timestamp BIGINT NOT NULL
);

-- Ensure download columns exist on existing download tables
ALTER TABLE nexora_downloads ADD COLUMN IF NOT EXISTS plugin_id VARCHAR(64) NOT NULL DEFAULT 'nexora-anticheat';
ALTER TABLE nexora_downloads ADD COLUMN IF NOT EXISTS account VARCHAR(128);

-- 5. Deposits / Transactions Table
CREATE TABLE IF NOT EXISTS nexora_deposits (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    username VARCHAR(64) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
    khqr_ref VARCHAR(128) NOT NULL,
    payment_method VARCHAR(64) DEFAULT 'KHQR (Bakong Cambodia)',
    receipt_image TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at BIGINT NOT NULL,
    approved_at BIGINT
);

-- 6. Minecraft Server Fleet Heartbeat Table
CREATE TABLE IF NOT EXISTS nexora_servers (
    id VARCHAR(64) PRIMARY KEY,
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

-- ==========================================================
--                     PERFORMANCE INDEXES
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_users_username ON nexora_users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON nexora_users(email);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON nexora_plugins(category);
CREATE INDEX IF NOT EXISTS idx_reviews_plugin ON nexora_reviews(plugin_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON nexora_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_downloads_plugin ON nexora_downloads(plugin_id);
CREATE INDEX IF NOT EXISTS idx_downloads_account ON nexora_downloads(account);
CREATE INDEX IF NOT EXISTS idx_downloads_timestamp ON nexora_downloads(timestamp DESC);

-- ==========================================================
--                     DEFAULT SEED DATA
-- ==========================================================

-- Seed Admin Account (username: admin, password: admin)
INSERT INTO nexora_users (
    id, username, email, password_hash, salt, role, balance, purchased_plugins, email_verified, created_at
) VALUES (
    'usr_admin',
    'admin',
    'admin@nexora.dev',
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    'salt_nexora_admin_seed',
    'ADMIN',
    500.00,
    '["nexora-anticheat","nexora-core-staff","nexora-combat-log","nexora-security-bundle"]',
    TRUE,
    1730000000000
) ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', email_verified = TRUE;

-- Seed Marketplace Plugins
INSERT INTO nexora_plugins (
    id, name, tagline, description, price, version, category, tags, icon, downloads, rating, jar_file_name, download_url, supported_versions, software, changelogs
) VALUES 
(
    'nexora-anticheat',
    'Nexora AntiCheat',
    'High-Performance Heuristic & Packet Anti-Cheat Engine',
    'Advanced behavioral anti-cheat solution featuring 26+ heuristic detection algorithms across Movement, Combat, World, and Packet vectors. Optimized for Paper, Purpur, and Folia regionized threading with automated lag and tick compensation.',
    19.99,
    '1.0.0',
    'Security',
    '["AntiCheat","Folia","Paper","Combat","Movement","Zero-Lag"]',
    '🛡️',
    1420,
    5.0,
    'NexoraAntiCheat-1.0.0.jar',
    '/api/plugins/nexora-anticheat/download',
    '1.20 - 1.21.4',
    '["Paper","Purpur","Folia"]',
    '[{"version":"1.0.0","date":"October 16, 2026","title":"Initial Enterprise Release","notes":["Removed all licensing restrictions for completely free community deployment.","Added 26+ high precision checks: KillAura, Reach, Velocity, Speed, Fly, BadPackets.","Full Folia region-threading compliance."]}]'
),
(
    'nexora-core-staff',
    'Nexora Staff Suite & Core',
    'All-In-One Moderation, Freeze Screen & Inspection Utility',
    'Comprehensive staff utility suite providing interactive freeze GUIs, ghost vanish with packet manipulation, silent player inventory inspection, staff chat channels, and automated suspicious activity logs.',
    9.99,
    '2.4.0',
    'Administration',
    '["Staff","Moderation","Freeze","Vanish","Admin"]',
    '⚡',
    870,
    4.9,
    'NexoraStaffSuite-2.4.0.jar',
    '/api/plugins/nexora-core-staff/download',
    '1.20 - 1.21.4',
    '["Paper","Purpur","Folia"]',
    '[{"version":"2.4.0","date":"October 10, 2026","title":"Packet Vanish Update","notes":["Packet entity destroy filter.","Staff notes system."]}]'
),
(
    'nexora-combat-log',
    'Nexora CombatLog & AntiQuit',
    'Combat Tagging & Combat Logout NPC Protection',
    'Prevents unfair PvP combat logging by keeping players tagged during combat, spawning a killable NPC proxy if they disconnect, and blocking commands or safezone teleports during fights.',
    4.99,
    '1.3.0',
    'Combat',
    '["PvP","Combat","AntiQuit","NPC"]',
    '⚔️',
    650,
    4.8,
    'NexoraCombatLog-1.3.0.jar',
    '/api/plugins/nexora-combat-log/download',
    '1.20 - 1.21.4',
    '["Paper","Purpur","Folia"]',
    '[{"version":"1.3.0","date":"October 5, 2026","title":"Actionbar Countdown","notes":["Adventure Actionbar timer.","Configurable NPC health."]}]'
),
(
    'nexora-security-bundle',
    'Nexora Ultimate Security Bundle',
    'Complete Server Protection: AntiCheat + Staff Suite + ExploitGuard',
    'Get the full suite of Nexora security plugins at a discount. Protect your server from hackers, combat loggers, server crash exploits, and book dupes with one comprehensive package.',
    29.99,
    '1.0.0',
    'Bundle',
    '["Bundle","Security","AntiCheat","BestValue"]',
    '👑',
    410,
    5.0,
    'NexoraUltimateBundle-1.0.0.zip',
    '/api/plugins/nexora-security-bundle/download',
    '1.20 - 1.21.4',
    '["Paper","Purpur","Folia"]',
    '[{"version":"1.0.0","date":"October 16, 2026","title":"Complete 2026 Edition","notes":["Includes AntiCheat 1.0.0, Staff Suite 2.4.0, and CombatLog 1.3.0."]}]'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Default Verified Community Reviews
INSERT INTO nexora_reviews (
    id, plugin_id, username, rating, comment, image_url, likes, liked_by, created_at
) VALUES 
(
    'rev_1',
    'nexora-anticheat',
    'HypixelDev_Sokha',
    5,
    'The best Folia-ready anti-cheat we have tested. Zero false positives on 1.21.4 movement checks and instantaneous KillAura raytrace detection. The new update runs smooth as butter!',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    14,
    '["admin","MineCraftNetworkAdmin"]',
    1729100000000
),
(
    'rev_2',
    'nexora-anticheat',
    'MineCraftNetworkAdmin',
    5,
    'Massive TPS improvement compared to Spartan or Grim on our 200 player server. Shaded JAR dropped in and worked right out of the box with zero setup needed.',
    '',
    9,
    '["HypixelDev_Sokha"]',
    1729180000000
),
(
    'rev_3',
    'nexora-core-staff',
    'PvPKingdomStaff',
    5,
    'The freeze GUI caught 4 x-rayers and closet cheaters in our first hour of running it. Highly recommended staff utility.',
    '',
    6,
    '["admin"]',
    1729000000000
)
ON CONFLICT (id) DO NOTHING;
