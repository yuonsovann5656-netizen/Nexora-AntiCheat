const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'nexora_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory data store cache
let memoryStore = null;
let pgPool = null;

// Cryptographic password hashing helpers (Zero external dependencies)
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

// Clean default state with pre-seeded Admin account
const defaultState = {
  adminSecret: process.env.ADMIN_SECRET || 'nexora_admin_2026',
  users: [
    {
      id: 'usr_admin',
      username: 'admin',
      passwordHash: defaultAdminCreds.hash,
      salt: defaultAdminCreds.salt,
      role: 'ADMIN',
      createdAt: Date.now(),
      lastLogin: null
    }
  ],
  downloads: [],
  totalDownloads: 0,
  licenses: [],
  servers: [],
  violations: [],
  playerBans: [],
  pendingKicks: []
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
          rejectUnauthorized: false // Required for Supabase SSL connection
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
            ip VARCHAR(64),
            user_agent TEXT,
            timestamp BIGINT NOT NULL
          );

          -- 2. Registered Admin Users Table
          CREATE TABLE IF NOT EXISTS nexora_users (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(64) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            salt VARCHAR(64) NOT NULL,
            license_key VARCHAR(64) DEFAULT 'NONE',
            role VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
            created_at BIGINT NOT NULL,
            last_login BIGINT
          );

          -- Ensure license_key is nullable if it was NOT NULL previously
          ALTER TABLE nexora_users ALTER COLUMN license_key DROP NOT NULL;

          -- 3. Minecraft Servers Fleet Table
          CREATE TABLE IF NOT EXISTS nexora_servers (
            id VARCHAR(64) PRIMARY KEY,
            license_key VARCHAR(64) DEFAULT 'COMMUNITY',
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
            license_key VARCHAR(64) DEFAULT 'COMMUNITY',
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

          -- 5. Violation History Log Table
          CREATE TABLE IF NOT EXISTS nexora_violations (
            id VARCHAR(64) PRIMARY KEY,
            license_key VARCHAR(64) DEFAULT 'COMMUNITY',
            server_name VARCHAR(255),
            player_name VARCHAR(64) NOT NULL,
            check_id VARCHAR(64) NOT NULL,
            vl DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            details TEXT,
            timestamp BIGINT NOT NULL
          );

          -- 6. Licenses (Optional/Legacy)
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

          -- Indexes for performance
          CREATE INDEX IF NOT EXISTS idx_users_username ON nexora_users(username);
          CREATE INDEX IF NOT EXISTS idx_downloads_ts ON nexora_downloads(timestamp DESC);
          CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON nexora_violations(timestamp DESC);
        `);
        console.log('[Database] Supabase PostgreSQL tables verified/created successfully.');

        // Load data from Supabase
        const usrRes = await client.query('SELECT * FROM nexora_users');
        const srvRes = await client.query('SELECT * FROM nexora_servers');
        const banRes = await client.query('SELECT * FROM nexora_player_bans ORDER BY banned_at DESC LIMIT 500');
        const vioRes = await client.query('SELECT * FROM nexora_violations ORDER BY timestamp DESC LIMIT 500');
        const dlRes = await client.query('SELECT * FROM nexora_downloads ORDER BY timestamp DESC LIMIT 300');
        const dlCountRes = await client.query('SELECT COUNT(*) as total FROM nexora_downloads');

        let loadedUsers = usrRes.rows.map(r => ({
          id: r.id,
          username: r.username,
          passwordHash: r.password_hash,
          salt: r.salt,
          role: r.role || 'ADMIN',
          createdAt: Number(r.created_at),
          lastLogin: r.last_login ? Number(r.last_login) : null
        }));

        // If no user exists in database, seed the default admin
        if (loadedUsers.length === 0) {
          const defaultAdmin = defaultState.users[0];
          await client.query(`
            INSERT INTO nexora_users (id, username, password_hash, salt, role, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING;
          `, [defaultAdmin.id, defaultAdmin.username, defaultAdmin.passwordHash, defaultAdmin.salt, defaultAdmin.role, defaultAdmin.createdAt]);
          loadedUsers = [defaultAdmin];
        }

        memoryStore = {
          adminSecret: defaultState.adminSecret,
          users: loadedUsers,
          downloads: dlRes.rows.map(r => ({
            id: r.id,
            ip: r.ip,
            userAgent: r.user_agent,
            timestamp: Number(r.timestamp)
          })),
          totalDownloads: Number(dlCountRes.rows[0]?.total || dlRes.rows.length),
          licenses: [],
          servers: srvRes.rows.map(r => ({
            id: r.id,
            serverName: r.server_name,
            ip: r.ip,
            port: r.port,
            mcVersion: r.mc_version,
            pluginVersion: r.plugin_version,
            onlinePlayers: r.online_players,
            tps: Number(r.tps),
            status: r.status,
            lastHeartbeat: Number(r.last_heartbeat),
            firstSeen: Number(r.first_seen)
          })),
          playerBans: banRes.rows.map(r => ({
            id: r.id,
            serverName: r.server_name,
            playerName: r.player_name,
            reason: r.reason,
            duration: r.duration,
            bannedBy: r.banned_by,
            ipBanned: r.ip_banned,
            bannedAt: Number(r.banned_at),
            expiresAt: r.expires_at ? Number(r.expires_at) : null,
            status: r.status
          })),
          violations: vioRes.rows.map(r => ({
            id: r.id,
            serverName: r.server_name,
            playerName: r.player_name,
            checkId: r.check_id,
            vl: Number(r.vl),
            details: r.details,
            timestamp: Number(r.timestamp)
          })),
          pendingKicks: []
        };
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[Database] Failed to connect to Supabase PostgreSQL, falling back to local JSON store:', err.message);
      pgPool = null;
      loadLocalStore();
    }
  } else {
    console.log('[Database] No DATABASE_URL found. Running with local JSON database store.');
    loadLocalStore();
  }
}

function loadLocalStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
      memoryStore = JSON.parse(JSON.stringify(defaultState));
    } else {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      parsed.users = parsed.users || [];
      if (parsed.users.length === 0) {
        parsed.users = JSON.parse(JSON.stringify(defaultState.users));
      }
      parsed.downloads = parsed.downloads || [];
      parsed.totalDownloads = parsed.totalDownloads || parsed.downloads.length;
      parsed.servers = parsed.servers || [];
      parsed.violations = parsed.violations || [];
      parsed.playerBans = parsed.playerBans || [];
      parsed.pendingKicks = parsed.pendingKicks || [];
      memoryStore = parsed;
    }
  } catch (err) {
    memoryStore = JSON.parse(JSON.stringify(defaultState));
  }
}

function readData() {
  if (!memoryStore) {
    loadLocalStore();
  }
  return memoryStore;
}

function writeData(data) {
  memoryStore = data;

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local file:', err);
  }

  if (pgPool) {
    syncToPostgres(data).catch(err => {
      console.error('[Database] Error syncing data to Supabase:', err.message);
    });
  }
}

async function syncToPostgres(data) {
  if (!pgPool) return;
  const client = await pgPool.connect();
  try {
    // Sync users
    for (const u of data.users) {
      await client.query(`
        INSERT INTO nexora_users (id, username, password_hash, salt, role, created_at, last_login)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          salt = EXCLUDED.salt,
          last_login = EXCLUDED.last_login;
      `, [u.id, u.username, u.passwordHash, u.salt, u.role || 'ADMIN', u.createdAt, u.lastLogin]);
    }

    // Sync latest downloads
    for (const d of (data.downloads || []).slice(0, 30)) {
      await client.query(`
        INSERT INTO nexora_downloads (id, ip, user_agent, timestamp)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING;
      `, [d.id, d.ip, d.userAgent, d.timestamp]);
    }

    // Sync servers
    for (const s of data.servers) {
      await client.query(`
        INSERT INTO nexora_servers (id, server_name, ip, port, mc_version, plugin_version, online_players, tps, status, last_heartbeat, first_seen)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          server_name = EXCLUDED.server_name,
          ip = EXCLUDED.ip,
          port = EXCLUDED.port,
          mc_version = EXCLUDED.mc_version,
          plugin_version = EXCLUDED.plugin_version,
          online_players = EXCLUDED.online_players,
          tps = EXCLUDED.tps,
          status = EXCLUDED.status,
          last_heartbeat = EXCLUDED.last_heartbeat;
      `, [s.id, s.serverName, s.ip, s.port, s.mcVersion, s.pluginVersion, s.onlinePlayers, s.tps, s.status, s.lastHeartbeat, s.firstSeen]);
    }

    // Sync player bans
    for (const b of (data.playerBans || [])) {
      await client.query(`
        INSERT INTO nexora_player_bans (id, server_name, player_name, reason, duration, banned_by, ip_banned, banned_at, expires_at, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          reason = EXCLUDED.reason;
      `, [b.id, b.serverName, b.playerName, b.reason, b.duration, b.bannedBy, b.ipBanned, b.bannedAt, b.expiresAt, b.status]);
    }

    // Sync latest 20 violations
    for (const v of data.violations.slice(0, 20)) {
      await client.query(`
        INSERT INTO nexora_violations (id, server_name, player_name, check_id, vl, details, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING;
      `, [v.id, v.serverName, v.playerName, v.checkId, v.vl, v.details, v.timestamp]);
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
