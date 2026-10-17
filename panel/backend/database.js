const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const { Pool } = require('pg');

// Force IPv4 address resolution first to prevent ENETUNREACH on IPv6-only Supabase endpoints
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'nexora_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory data store cache
let memoryStore = null;
let pgPool = null;

// Cryptographic password hashing helpers
function hashPassword(password, salt) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return verify === hash;
}

const defaultAdminCreds = hashPassword('admin');

// Pre-seeded plugins for the marketplace
const defaultPlugins = [
  {
    id: 'bayon-anticheat',
    name: 'Bayon AntiCheat',
    tagline: 'High-Performance Heuristic & Packet Anti-Cheat Engine',
    description: 'Advanced behavioral anti-cheat solution featuring 26+ heuristic detection algorithms across Movement, Combat, World, and Packet vectors. Optimized for Paper, Purpur, and Folia regionized threading with automated lag and tick compensation.',
    price: 19.99,
    version: '1.0.0',
    category: 'Security',
    tags: ['AntiCheat', 'Bayon', 'Folia', 'Paper', 'Combat', 'Movement', 'Zero-Lag'],
    icon: '🛡️',
    logoUrl: '/logo.png',
    bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    downloads: 1420,
    rating: 5.0,
    jarFileName: 'BayonAntiCheat-1.0.0.jar',
    downloadUrl: '/api/download/bayon-anticheat.jar',
    githubReleaseUrl: 'https://github.com/yuonsovann5656-netizen/Nexora-AntiCheat/releases/download/v1.0.0/BayonAntiCheat-1.0.0.jar',
    supportedVersions: '1.20 - 1.21.4',
    software: ['Paper', 'Purpur', 'Folia'],
    screenshots: [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
      'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=800&q=80'
    ],
    changelogs: [
      {
        version: '1.0.0',
        date: 'October 16, 2026',
        title: 'Initial Enterprise Public Release',
        notes: [
          'Removed all licensing restrictions for completely free, unencumbered community deployment.',
          'Added 26+ high precision checks: KillAura, Reach (3.001 block raytrace), Velocity, Speed, Fly, Phase, BadPackets.',
          'Full Folia region-threading compliance and async telemetry logging.',
          'Server TPS and ping spike lag compensation.'
        ]
      }
    ]
  },
  {
    id: 'nexora-core-staff',
    name: 'Nexora Staff Suite & Core',
    tagline: 'All-In-One Moderation, Freeze Screen & Inspection Utility',
    description: 'Comprehensive staff utility suite providing interactive freeze GUIs, ghost vanish with packet manipulation, silent player inventory inspection, staff chat channels, and automated suspicious activity logs.',
    price: 9.99,
    version: '2.4.0',
    category: 'Administration',
    tags: ['Staff', 'Moderation', 'Freeze', 'Vanish', 'Admin'],
    icon: '⚡',
    logoUrl: '',
    bannerUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80',
    downloads: 870,
    rating: 4.9,
    jarFileName: 'NexoraStaffSuite-2.4.0.jar',
    downloadUrl: '/api/download/nexora-staff-suite.jar',
    githubReleaseUrl: '',
    supportedVersions: '1.20 - 1.21.4',
    software: ['Paper', 'Purpur', 'Folia'],
    screenshots: [
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80'
    ],
    changelogs: [
      {
        version: '2.4.0',
        date: 'October 10, 2026',
        title: 'Packet-Level Vanish Update',
        notes: [
          'Replaced Bukkit hidePlayer with true packet entity destroy filter.',
          'Added staff note system with persistent SQLite database.'
        ]
      }
    ]
  },
  {
    id: 'nexora-combat-log',
    name: 'Nexora CombatLog & AntiQuit',
    tagline: 'Combat Tagging & Combat Logout NPC Protection',
    description: 'Prevents unfair PvP combat logging by keeping players tagged during combat, spawning a killable NPC proxy if they disconnect, and blocking commands or safezone teleports during fights.',
    price: 4.99,
    version: '1.3.0',
    category: 'Combat',
    tags: ['PvP', 'Combat', 'AntiQuit', 'NPC'],
    icon: '⚔️',
    logoUrl: '',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80',
    downloads: 650,
    rating: 4.8,
    jarFileName: 'NexoraCombatLog-1.3.0.jar',
    downloadUrl: '/api/download/nexora-combat-log.jar',
    githubReleaseUrl: '',
    supportedVersions: '1.20 - 1.21.4',
    software: ['Paper', 'Purpur', 'Folia'],
    screenshots: [
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80'
    ],
    changelogs: [
      {
        version: '1.3.0',
        date: 'October 5, 2026',
        title: 'Actionbar Countdown & Custom Drops',
        notes: [
          'Added smooth Adventure Actionbar timer countdown.',
          'Configurable NPC health and drop mechanics.'
        ]
      }
    ]
  },
  {
    id: 'nexora-security-bundle',
    name: 'Nexora Ultimate Security Bundle',
    tagline: 'Complete Server Protection: AntiCheat + Staff Suite + ExploitGuard',
    description: 'Get the full suite of Nexora security plugins at a discount. Protect your server from hackers, combat loggers, server crash exploits, and book dupes with one comprehensive package.',
    price: 29.99,
    version: '1.0.0',
    category: 'Bundle',
    tags: ['Bundle', 'Security', 'AntiCheat', 'BestValue'],
    icon: '👑',
    logoUrl: '/logo.png',
    bannerUrl: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=800&q=80',
    downloads: 410,
    rating: 5.0,
    jarFileName: 'NexoraUltimateBundle-1.0.0.zip',
    downloadUrl: '/api/download/nexora-bundle.zip',
    githubReleaseUrl: '',
    supportedVersions: '1.20 - 1.21.4',
    software: ['Paper', 'Purpur', 'Folia'],
    screenshots: [],
    changelogs: [
      {
        version: '1.0.0',
        date: 'October 16, 2026',
        title: 'Complete 2026 Security Edition',
        notes: ['Includes AntiCheat 1.0.0, Staff Suite 2.4.0, and CombatLog 1.3.0.']
      }
    ]
  }
];

const defaultReviews = [
  {
    id: 'rev_1',
    pluginId: 'bayon-anticheat',
    username: 'HypixelDev_Sokha',
    rating: 5,
    comment: 'The best Folia-ready anti-cheat we have tested. Zero false positives on 1.21.4 movement checks and instantaneous KillAura raytrace detection. The new update runs smooth as butter!',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    likes: 14,
    likedBy: ['admin', 'MineCraftNetworkAdmin'],
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: 'rev_2',
    pluginId: 'bayon-anticheat',
    username: 'MineCraftNetworkAdmin',
    rating: 5,
    comment: 'Massive TPS improvement compared to Spartan or Grim on our 200 player server. Shaded JAR dropped in and worked right out of the box with zero setup needed.',
    imageUrl: '',
    likes: 9,
    likedBy: ['HypixelDev_Sokha'],
    createdAt: Date.now() - 86400000 * 1
  },
  {
    id: 'rev_3',
    pluginId: 'nexora-core-staff',
    username: 'PvPKingdomStaff',
    rating: 5,
    comment: 'The freeze GUI caught 4 x-rayers and closet cheaters in our first hour of running it. Highly recommended staff utility.',
    imageUrl: '',
    likes: 6,
    likedBy: ['admin'],
    createdAt: Date.now() - 86400000 * 5
  }
];

const defaultDeposits = [
  {
    id: 'dep_sample_1',
    userId: 'usr_admin',
    username: 'admin',
    amount: 50.00,
    currency: 'USD',
    khqrRef: 'NXR-DEP-849102',
    paymentMethod: 'KHQR (Bakong Cambodia)',
    receiptImage: '',
    status: 'APPROVED',
    createdAt: Date.now() - 86400000 * 2,
    approvedAt: Date.now() - 86400000 * 2
  }
];

// Clean default state with pre-seeded Admin account and store catalog
const defaultState = {
  adminSecret: process.env.ADMIN_SECRET || 'nexora_admin_2026',
  users: [
    {
      id: 'usr_admin',
      username: 'admin',
      email: 'admin@nexora.dev',
      passwordHash: defaultAdminCreds.hash,
      salt: defaultAdminCreds.salt,
      role: 'ADMIN',
      balance: 100.00,
      emailVerified: true,
      purchasedPlugins: ['nexora-anticheat', 'nexora-core-staff', 'nexora-combat-log', 'nexora-security-bundle'],
      createdAt: Date.now(),
      lastLogin: null
    }
  ],
  plugins: defaultPlugins,
  reviews: defaultReviews,
  downloads: [],
  totalDownloads: 0,
  servers: [],
  violations: [],
  playerBans: []
};

/**
 * Initialize connection to Supabase PostgreSQL or local fallback.
 */
async function initDatabase() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (dbUrl) {
    try {
      console.log('[Database] Connecting to Supabase PostgreSQL database...');
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: {
          rejectUnauthorized: false
        },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 8000
      });

      // Test connection & auto-migrate all tables in Supabase
      const client = await pgPool.connect();
      try {
        await client.query(`
          -- 1. Plugin Downloads Tracker Table
          CREATE TABLE IF NOT EXISTS nexora_downloads (
            id VARCHAR(64) PRIMARY KEY,
            plugin_id VARCHAR(64) NOT NULL DEFAULT 'nexora-anticheat',
            account VARCHAR(128) NOT NULL,
            ip VARCHAR(64),
            user_agent TEXT,
            timestamp BIGINT NOT NULL
          );
          ALTER TABLE nexora_downloads ADD COLUMN IF NOT EXISTS plugin_id VARCHAR(64) NOT NULL DEFAULT 'nexora-anticheat';
          ALTER TABLE nexora_downloads ADD COLUMN IF NOT EXISTS account VARCHAR(128);

          -- 2. Registered Users Table (with Wallet Balance & Library)
          CREATE TABLE IF NOT EXISTS nexora_users (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(64) UNIQUE NOT NULL,
            email VARCHAR(255),
            password_hash VARCHAR(255) NOT NULL,
            salt VARCHAR(64) NOT NULL,
            role VARCHAR(32) NOT NULL DEFAULT 'USER',
            balance DOUBLE PRECISION NOT NULL DEFAULT 0.00,
            purchased_plugins TEXT NOT NULL DEFAULT '[]',
            created_at BIGINT NOT NULL,
            last_login BIGINT
          );

          -- Ensure email, balance, verification & purchased_plugins exist
          ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
          ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS balance DOUBLE PRECISION NOT NULL DEFAULT 0.00;
          ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS purchased_plugins TEXT NOT NULL DEFAULT '[]';
          ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(64);
          ALTER TABLE nexora_users ADD COLUMN IF NOT EXISTS license_key VARCHAR(128) DEFAULT '';

          -- Fix legacy license_key not-null constraint if table was created in an older schema version
          DO $$ 
          BEGIN
              IF EXISTS (
                  SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'nexora_users' AND column_name = 'license_key'
              ) THEN
                  ALTER TABLE nexora_users ALTER COLUMN license_key DROP NOT NULL;
                  ALTER TABLE nexora_users ALTER COLUMN license_key SET DEFAULT '';
              END IF;
          END $$;

          -- 3. Plugins Catalog Table
          CREATE TABLE IF NOT EXISTS nexora_plugins (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            tagline TEXT,
            description TEXT,
            price DOUBLE PRECISION NOT NULL DEFAULT 0.00,
            version VARCHAR(64) NOT NULL DEFAULT '1.0.0',
            category VARCHAR(64) NOT NULL DEFAULT 'General',
            tags TEXT DEFAULT '[]',
            icon VARCHAR(64) DEFAULT '📦',
            downloads INT DEFAULT 0,
            rating DOUBLE PRECISION DEFAULT 5.0,
            jar_file_name VARCHAR(255),
            download_url TEXT,
            github_release_url TEXT,
            supported_versions VARCHAR(128),
            software TEXT DEFAULT '["Paper"]',
            screenshots TEXT DEFAULT '[]',
            changelogs TEXT DEFAULT '[]',
            logo_url TEXT,
            banner_url TEXT
          );
          ALTER TABLE nexora_plugins ADD COLUMN IF NOT EXISTS logo_url TEXT;
          ALTER TABLE nexora_plugins ADD COLUMN IF NOT EXISTS banner_url TEXT;

          -- 4. Reviews & Community Feedback Table
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

          -- 5. KHQR Wallet Deposits Table
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

          -- 6. Minecraft Servers Fleet Table
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
        `);
        console.log('[Database] Supabase PostgreSQL tables verified successfully.');
      } finally {
        client.release();
      }

      // Load initial state from Supabase
      memoryStore = await loadFromPostgres();
      return;
    } catch (err) {
      console.warn('[Database] Supabase connection failed, falling back to local JSON store:', err.message);
    }
  }

  // Fallback: Local JSON File store
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const loaded = JSON.parse(raw);
      memoryStore = {
        ...defaultState,
        ...loaded,
        users: loaded.users && loaded.users.length ? loaded.users : defaultState.users,
        plugins: loaded.plugins && loaded.plugins.length ? loaded.plugins : defaultPlugins,
        reviews: loaded.reviews && loaded.reviews.length ? loaded.reviews : defaultReviews,
        deposits: loaded.deposits && loaded.deposits.length ? loaded.deposits : defaultDeposits
      };
      console.log(`[Database] Loaded local store from ${DATA_FILE}`);
    } catch (err) {
      console.error('[Database] Failed to parse local JSON store, using defaults:', err.message);
      memoryStore = JSON.parse(JSON.stringify(defaultState));
    }
  } else {
    memoryStore = JSON.parse(JSON.stringify(defaultState));
    writeData(memoryStore);
    console.log(`[Database] Created fresh local store at ${DATA_FILE}`);
  }
}

async function loadFromPostgres() {
  const store = JSON.parse(JSON.stringify(defaultState));
  if (!pgPool) return store;

  const client = await pgPool.connect();
  try {
    // 1. Users
    const usersRes = await client.query('SELECT * FROM nexora_users');
    if (usersRes.rows.length > 0) {
      store.users = usersRes.rows.map(r => ({
        id: r.id,
        username: r.username,
        email: r.email,
        passwordHash: r.password_hash,
        salt: r.salt,
        role: r.role,
        balance: Number(r.balance || 0),
        emailVerified: r.email_verified === true || r.role === 'ADMIN',
        verificationCode: r.verification_code || null,
        purchasedPlugins: JSON.parse(r.purchased_plugins || '[]'),
        licenseKey: r.license_key || null,
        createdAt: Number(r.created_at),
        lastLogin: r.last_login ? Number(r.last_login) : null
      }));
    }

    // 2. Plugins
    const pluginsRes = await client.query('SELECT * FROM nexora_plugins');
    if (pluginsRes.rows.length > 0) {
      store.plugins = pluginsRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        tagline: r.tagline,
        description: r.description,
        price: Number(r.price || 0),
        version: r.version,
        category: r.category,
        tags: JSON.parse(r.tags || '[]'),
        icon: r.icon,
        downloads: Number(r.downloads || 0),
        rating: Number(r.rating || 5.0),
        jarFileName: r.jar_file_name,
        downloadUrl: r.download_url,
        githubReleaseUrl: r.github_release_url,
        supportedVersions: r.supported_versions,
        software: JSON.parse(r.software || '["Paper"]'),
        screenshots: JSON.parse(r.screenshots || '[]'),
        changelogs: JSON.parse(r.changelogs || '[]'),
        logoUrl: r.logo_url || (r.id === 'bayon-anticheat' ? '/logo.png' : ''),
        bannerUrl: r.banner_url || (r.screenshots ? (JSON.parse(r.screenshots || '[]')[0] || '') : '')
      }));
    } else {
      store.plugins = defaultPlugins;
    }

    // 3. Reviews
    const revsRes = await client.query('SELECT * FROM nexora_reviews ORDER BY created_at DESC');
    if (revsRes.rows.length > 0) {
      store.reviews = revsRes.rows.map(r => ({
        id: r.id,
        pluginId: r.plugin_id,
        username: r.username,
        rating: Number(r.rating),
        comment: r.comment,
        imageUrl: r.image_url,
        likes: Number(r.likes || 0),
        likedBy: JSON.parse(r.liked_by || '[]'),
        createdAt: Number(r.created_at)
      }));
    } else {
      store.reviews = defaultReviews;
    }

    // 4. Downloads
    try {
      const dlRes = await client.query('SELECT * FROM nexora_downloads ORDER BY timestamp DESC LIMIT 200');
      if (dlRes.rows.length > 0) {
        store.downloads = dlRes.rows.map(r => ({
          id: r.id,
          pluginId: r.plugin_id,
          account: r.account,
          ip: r.ip,
          userAgent: r.user_agent,
          timestamp: Number(r.timestamp)
        }));
      }
    } catch (e) {
      // ignore if empty
    }

    // 5. Deposits
    const depsRes = await client.query('SELECT * FROM nexora_deposits ORDER BY created_at DESC');
    if (depsRes.rows.length > 0) {
      store.deposits = depsRes.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        amount: Number(r.amount),
        currency: r.currency,
        khqrRef: r.khqr_ref,
        paymentMethod: r.payment_method,
        receiptImage: r.receipt_image,
        status: r.status,
        createdAt: Number(r.created_at),
        approvedAt: r.approved_at ? Number(r.approved_at) : null
      }));
    } else {
      store.deposits = defaultDeposits;
    }

    // 5. Servers
    const serversRes = await client.query('SELECT * FROM nexora_servers');
    store.servers = serversRes.rows.map(r => ({
      id: r.id,
      serverName: r.server_name,
      ip: r.ip,
      port: r.port,
      mcVersion: r.mc_version,
      pluginVersion: r.plugin_version,
      onlinePlayers: r.online_players,
      tps: r.tps,
      status: r.status,
      lastHeartbeat: Number(r.last_heartbeat),
      firstSeen: Number(r.first_seen)
    }));

    return store;
  } finally {
    client.release();
  }
}

function readData() {
  if (!memoryStore) {
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        memoryStore = { ...defaultState, ...JSON.parse(raw) };
      } catch {
        memoryStore = JSON.parse(JSON.stringify(defaultState));
      }
    } else {
      memoryStore = JSON.parse(JSON.stringify(defaultState));
    }
  }
  return memoryStore;
}

let lastPostgresSyncErrorTime = 0;
let isPostgresSyncHealthy = true;

function writeData(data) {
  memoryStore = data;

  // 1. Write to local JSON asynchronously
  fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8', (err) => {
    if (err) console.error('[Database] Failed to write local JSON store:', err);
  });

  // 2. Synchronize to Supabase if connected
  if (pgPool) {
    syncToPostgres(data).catch(() => {});
  }
}

async function syncToPostgres(data) {
  if (!pgPool) return;

  // If recently encountered ENETUNREACH, backoff for 30 seconds
  if (!isPostgresSyncHealthy && Date.now() - lastPostgresSyncErrorTime < 30000) {
    return;
  }

  let client;
  try {
    client = await pgPool.connect();
    isPostgresSyncHealthy = true;
  } catch (connErr) {
    isPostgresSyncHealthy = false;
    const now = Date.now();
    if (now - lastPostgresSyncErrorTime > 30000) {
      lastPostgresSyncErrorTime = now;
      if (connErr.message && connErr.message.includes('ENETUNREACH')) {
        console.warn('[Database] Supabase is unreachable via IPv6 (ENETUNREACH).');
        console.warn('[Database] -> Please switch your DATABASE_URL in Render to your Supabase Connection Pooler: aws-0-[region].pooler.supabase.com:6543 (port 6543 or 5432).');
        console.warn('[Database] -> Local database is active and authoritative; data is safe in data/nexora_store.json.');
      } else {
        console.warn('[Database] Supabase sync deferred:', connErr.message);
      }
    }
    return;
  }

  try {
    // Sync users
    for (const u of (data.users || [])) {
      await client.query(`
        INSERT INTO nexora_users (id, username, email, password_hash, salt, role, balance, purchased_plugins, email_verified, verification_code, created_at, last_login, license_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          salt = EXCLUDED.salt,
          balance = EXCLUDED.balance,
          purchased_plugins = EXCLUDED.purchased_plugins,
          email_verified = EXCLUDED.email_verified,
          verification_code = EXCLUDED.verification_code,
          last_login = EXCLUDED.last_login,
          license_key = EXCLUDED.license_key;
      `, [u.id, u.username, u.email || '', u.passwordHash, u.salt, u.role || 'USER', u.balance || 0, JSON.stringify(u.purchasedPlugins || []), u.emailVerified === true, u.verificationCode || null, u.createdAt, u.lastLogin, u.licenseKey || '']);
    }

    // Sync plugins
    const validPluginIds = (data.plugins || []).map(p => p.id);
    if (validPluginIds.length > 0) {
      const placeholders = validPluginIds.map((_, i) => `$${i + 1}`).join(',');
      await client.query(`DELETE FROM nexora_plugins WHERE id NOT IN (${placeholders})`, validPluginIds);
    }

    for (const p of (data.plugins || [])) {
      const pLogo = p.logoUrl || (p.id === 'bayon-anticheat' ? '/logo.png' : '');
      const pBanner = p.bannerUrl || (Array.isArray(p.screenshots) && p.screenshots.length > 0 ? p.screenshots[0] : '');

      await client.query(`
        INSERT INTO nexora_plugins (id, name, tagline, description, price, version, category, tags, icon, downloads, rating, jar_file_name, download_url, github_release_url, supported_versions, software, screenshots, changelogs, logo_url, banner_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          tagline = EXCLUDED.tagline,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          version = EXCLUDED.version,
          category = EXCLUDED.category,
          tags = EXCLUDED.tags,
          icon = EXCLUDED.icon,
          downloads = EXCLUDED.downloads,
          rating = EXCLUDED.rating,
          jar_file_name = EXCLUDED.jar_file_name,
          download_url = EXCLUDED.download_url,
          github_release_url = EXCLUDED.github_release_url,
          supported_versions = EXCLUDED.supported_versions,
          software = EXCLUDED.software,
          screenshots = EXCLUDED.screenshots,
          changelogs = EXCLUDED.changelogs,
          logo_url = EXCLUDED.logo_url,
          banner_url = EXCLUDED.banner_url;
      `, [p.id, p.name, p.tagline, p.description, p.price, p.version, p.category, JSON.stringify(p.tags || []), p.icon, p.downloads, p.rating, p.jarFileName, p.downloadUrl, p.githubReleaseUrl, p.supportedVersions, JSON.stringify(p.software || []), JSON.stringify(p.screenshots || []), JSON.stringify(p.changelogs || []), pLogo, pBanner]);
    }

    // Sync reviews
    for (const r of (data.reviews || []).slice(0, 50)) {
      await client.query(`
        INSERT INTO nexora_reviews (id, plugin_id, username, rating, comment, image_url, likes, liked_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          comment = EXCLUDED.comment,
          rating = EXCLUDED.rating,
          image_url = EXCLUDED.image_url,
          likes = EXCLUDED.likes,
          liked_by = EXCLUDED.liked_by;
      `, [r.id, r.pluginId, r.username, r.rating, r.comment, r.imageUrl || '', r.likes || 0, JSON.stringify(r.likedBy || []), r.createdAt]);
    }

    // Sync downloads
    for (const dl of (data.downloads || []).slice(0, 50)) {
      await client.query(`
        INSERT INTO nexora_downloads (id, plugin_id, account, ip, user_agent, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING;
      `, [dl.id, dl.pluginId || 'nexora-anticheat', dl.account || 'unknown', dl.ip || '', dl.userAgent || '', dl.timestamp]);
    }

    // Sync deposits
    for (const d of (data.deposits || [])) {
      await client.query(`
        INSERT INTO nexora_deposits (id, user_id, username, amount, currency, khqr_ref, payment_method, receipt_image, status, created_at, approved_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          approved_at = EXCLUDED.approved_at;
      `, [d.id, d.userId, d.username, d.amount, d.currency, d.khqrRef, d.paymentMethod, d.receiptImage || '', d.status, d.createdAt, d.approvedAt]);
    }

  } finally {
    client.release();
  }
}

module.exports = {
  initDatabase,
  readData,
  writeData,
  hashPassword,
  verifyPassword
};
