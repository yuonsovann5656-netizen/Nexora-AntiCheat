-- ==========================================================
--     BAYON TECHNOLOGIES - PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- ==========================================================
-- Run this script in your Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run!
-- ==========================================================

-- 1. Official Bayon Users Table (E-Commerce Account Auth: NO LICENSE KEYS)
CREATE TABLE IF NOT EXISTS bayon_users (
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

-- Ensure all required columns exist in bayon_users
ALTER TABLE bayon_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE bayon_users ADD COLUMN IF NOT EXISTS balance DOUBLE PRECISION NOT NULL DEFAULT 0.00;
ALTER TABLE bayon_users ADD COLUMN IF NOT EXISTS purchased_plugins TEXT NOT NULL DEFAULT '[]';
ALTER TABLE bayon_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bayon_users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(64);

-- 2. Safe Auto-Migration from Legacy nexora_users (Fixes ERROR 42703 & 23502)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'nexora_users'
    ) THEN
        -- Add email column if missing to prevent 42703
        ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
        ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS balance DOUBLE PRECISION DEFAULT 0.00;
        ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS purchased_plugins TEXT DEFAULT '[]';
        ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(64);

        -- Drop not-null constraint on license_key if present
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'nexora_users' AND column_name = 'license_key'
        ) THEN
            ALTER TABLE nexora_users ALTER COLUMN license_key DROP NOT NULL;
            ALTER TABLE nexora_users ALTER COLUMN license_key SET DEFAULT '';
        END IF;

        -- Seamlessly copy existing records to bayon_users
        INSERT INTO bayon_users (id, username, email, password_hash, salt, role, balance, purchased_plugins, email_verified, verification_code, created_at, last_login)
        SELECT 
            id, 
            username, 
            COALESCE(email, username || '@bayon.dev'), 
            password_hash, 
            salt, 
            COALESCE(role, 'USER'), 
            COALESCE(balance, 0.00), 
            COALESCE(purchased_plugins, '[]'), 
            COALESCE(email_verified, FALSE), 
            verification_code, 
            created_at, 
            last_login
        FROM nexora_users
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            salt = EXCLUDED.salt,
            role = EXCLUDED.role,
            balance = EXCLUDED.balance,
            purchased_plugins = EXCLUDED.purchased_plugins,
            email_verified = EXCLUDED.email_verified;
    END IF;
END $$;

-- 3. Plugins Catalog Table (Marketplace Products)
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
    changelogs TEXT DEFAULT '[]',
    logo_url TEXT,
    banner_url TEXT
);
ALTER TABLE nexora_plugins ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE nexora_plugins ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- 4. Reviews & Feedback Table
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
ALTER TABLE nexora_reviews ADD COLUMN IF NOT EXISTS likes INT NOT NULL DEFAULT 0;
ALTER TABLE nexora_reviews ADD COLUMN IF NOT EXISTS liked_by TEXT NOT NULL DEFAULT '[]';

-- 5. Real Downloads Audit Log Table
CREATE TABLE IF NOT EXISTS nexora_downloads (
    id VARCHAR(64) PRIMARY KEY,
    plugin_id VARCHAR(64) NOT NULL DEFAULT 'bayon-anticheat',
    account VARCHAR(128) NOT NULL,
    ip VARCHAR(64),
    user_agent TEXT,
    timestamp BIGINT NOT NULL
);
ALTER TABLE nexora_downloads ADD COLUMN IF NOT EXISTS plugin_id VARCHAR(64) NOT NULL DEFAULT 'bayon-anticheat';
ALTER TABLE nexora_downloads ADD COLUMN IF NOT EXISTS account VARCHAR(128);

-- 6. Deposits / Transactions Table
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

-- 7. Minecraft Server Fleet Heartbeat Table
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
CREATE INDEX IF NOT EXISTS idx_bayon_users_username ON bayon_users(username);
CREATE INDEX IF NOT EXISTS idx_bayon_users_email ON bayon_users(email);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON nexora_plugins(category);
CREATE INDEX IF NOT EXISTS idx_reviews_plugin ON nexora_reviews(plugin_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON nexora_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_downloads_plugin ON nexora_downloads(plugin_id);
CREATE INDEX IF NOT EXISTS idx_downloads_account ON nexora_downloads(account);
CREATE INDEX IF NOT EXISTS idx_downloads_timestamp ON nexora_downloads(timestamp DESC);

-- ==========================================================
--                     DEFAULT SEED DATA
-- ==========================================================

-- Seed Admin Account into bayon_users (NO license key!)
INSERT INTO bayon_users (
    id, username, email, password_hash, salt, role, balance, purchased_plugins, email_verified, created_at
) VALUES (
    'usr_admin',
    'admin',
    'admin@bayon.dev',
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    'salt_nexora_admin_seed',
    'ADMIN',
    500.00,
    '["bayon-anticheat","nexora-core-staff","nexora-combat-log","nexora-security-bundle"]',
    TRUE,
    1730000000000
) ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', email_verified = TRUE;

-- Also seed into legacy nexora_users if it exists without license_key constraint issues
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nexora_users') THEN
        INSERT INTO nexora_users (
            id, username, email, password_hash, salt, role, balance, purchased_plugins, email_verified, created_at
        ) VALUES (
            'usr_admin',
            'admin',
            'admin@bayon.dev',
            '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
            'salt_nexora_admin_seed',
            'ADMIN',
            500.00,
            '["bayon-anticheat","nexora-core-staff","nexora-combat-log","nexora-security-bundle"]',
            TRUE,
            1730000000000
        ) ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', email_verified = TRUE;
    END IF;
END $$;

-- Seed Marketplace Plugins
INSERT INTO nexora_plugins (
    id, name, tagline, description, price, version, category, tags, icon, downloads, rating, jar_file_name, download_url, supported_versions, software, changelogs, logo_url, banner_url
) VALUES 
(
    'bayon-anticheat',
    'Bayon AntiCheat',
    'High-Performance Heuristic & Packet Anti-Cheat Engine',
    'Advanced behavioral anti-cheat solution featuring 26+ heuristic detection algorithms across Movement, Combat, World, and Packet vectors. Optimized for Paper, Purpur, and Folia regionized threading with automated lag and tick compensation.',
    19.99,
    '1.0.0',
    'Security',
    '["AntiCheat","Bayon","Folia","Paper","Combat","Movement","Zero-Lag"]',
    '🛡️',
    1420,
    5.0,
    'BayonAntiCheat-1.0.0.jar',
    '/api/plugins/bayon-anticheat/download',
    '1.20 - 1.21.4',
    '["Paper","Purpur","Folia"]',
    '[{"version":"1.0.0","date":"October 16, 2026","title":"Initial Enterprise Release","notes":["Removed all licensing restrictions for completely free community deployment.","Added 26+ high precision checks: KillAura, Reach, Velocity, Speed, Fly, BadPackets.","Full Folia region-threading compliance."]}]',
    '/logo.png',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80'
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
    '[{"version":"2.4.0","date":"October 10, 2026","title":"Packet Vanish Update","notes":["Packet entity destroy filter.","Staff notes system."]}]',
    '',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80'
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
    '[{"version":"1.3.0","date":"October 5, 2026","title":"Actionbar Countdown","notes":["Adventure Actionbar timer.","Configurable NPC health."]}]',
    '',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80'
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
    '[{"version":"1.0.0","date":"October 16, 2026","title":"Complete 2026 Edition","notes":["Includes AntiCheat 1.0.0, Staff Suite 2.4.0, and CombatLog 1.3.0."]}]',
    '/logo.png',
    'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=800&q=80'
)
ON CONFLICT (id) DO NOTHING;
