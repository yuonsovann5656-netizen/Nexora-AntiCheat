const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'nexora_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory data store cache
let memoryStore = null;
let pgPool = null;

// Initial default state
const defaultState = {
  adminSecret: 'nexora_admin_secret_2026',
  licenses: [
    {
      key: 'NX-DEMO-2026-KEY1',
      owner: 'Server Owner Alpha',
      email: 'owner@example.com',
      tier: 'LIFETIME',
      status: 'ACTIVE',
      boundIp: null,
      maxServers: 1,
      createdAt: Date.now() - 86400000 * 5,
      expiresAt: null,
      banReason: null
    },
    {
      key: 'NX-TEST-BANNED-KEY2',
      owner: 'Malicious Leaker',
      email: 'leaker@pirate.org',
      tier: '30_DAYS',
      status: 'BANNED',
      boundIp: '198.51.100.44',
      maxServers: 1,
      createdAt: Date.now() - 86400000 * 10,
      expiresAt: Date.now() + 86400000 * 20,
      banReason: 'Leaking plugin JAR on pirate forums'
    }
  ],
  servers: [
    {
      id: 'srv_demo_1',
      licenseKey: 'NX-DEMO-2026-KEY1',
      serverName: 'Nexora Survival SMP',
      ip: '127.0.0.1',
      port: 25565,
      mcVersion: 'Paper 26.2 (build 134)',
      pluginVersion: '1.0.0',
      onlinePlayers: 24,
      tps: 19.95,
      status: 'ONLINE',
      lastHeartbeat: Date.now() - 15000,
      firstSeen: Date.now() - 86400000 * 3
    }
  ],
  violations: [
    {
      id: 'viol_1',
      licenseKey: 'NX-DEMO-2026-KEY1',
      serverName: 'Nexora Survival SMP',
      playerName: 'CheaterBoy_99',
      checkId: 'KillAura',
      vl: 12.0,
      details: 'Angle snap: 124.5 deg/tick > 90.0',
      timestamp: Date.now() - 60000 * 25
    },
    {
      id: 'viol_2',
      licenseKey: 'NX-DEMO-2026-KEY1',
      serverName: 'Nexora Survival SMP',
      playerName: 'SpeedyMiner',
      checkId: 'Speed',
      vl: 8.5,
      details: 'Speed: 0.542 > Max: 0.360',
      timestamp: Date.now() - 60000 * 10
    }
  ]
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
        connectionTimeoutMillis: 5000
      });

      // Test connection & auto-migrate tables
      const client = await pgPool.connect();
      try {
        await client.query(`
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

          CREATE TABLE IF NOT EXISTS nexora_servers (
            id VARCHAR(64) PRIMARY KEY,
            license_key VARCHAR(64) NOT NULL,
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

          CREATE TABLE IF NOT EXISTS nexora_violations (
            id VARCHAR(64) PRIMARY KEY,
            license_key VARCHAR(64) NOT NULL,
            server_name VARCHAR(255),
            player_name VARCHAR(64) NOT NULL,
            check_id VARCHAR(64) NOT NULL,
            vl DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            details TEXT,
            timestamp BIGINT NOT NULL
          );
        `);
        console.log('[Database] Supabase PostgreSQL tables verified/created successfully.');

        // Load data from Supabase
        const licRes = await client.query('SELECT * FROM nexora_licenses');
        const srvRes = await client.query('SELECT * FROM nexora_servers');
        const vioRes = await client.query('SELECT * FROM nexora_violations ORDER BY timestamp DESC LIMIT 200');

        if (licRes.rows.length === 0) {
          // Seed initial default demo data into Supabase
          console.log('[Database] Seeding initial demo license records to Supabase...');
          for (const lic of defaultState.licenses) {
            await client.query(
              'INSERT INTO nexora_licenses (key, owner, email, tier, status, bound_ip, max_servers, created_at, expires_at, ban_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING',
              [lic.key, lic.owner, lic.email, lic.tier, lic.status, lic.boundIp, lic.maxServers, lic.createdAt, lic.expiresAt, lic.banReason]
            );
          }
          for (const s of defaultState.servers) {
            await client.query(
              'INSERT INTO nexora_servers (id, license_key, server_name, ip, port, mc_version, plugin_version, online_players, tps, status, last_heartbeat, first_seen) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING',
              [s.id, s.licenseKey, s.serverName, s.ip, s.port, s.mcVersion, s.pluginVersion, s.onlinePlayers, s.tps, s.status, s.lastHeartbeat, s.firstSeen]
            );
          }
          memoryStore = JSON.parse(JSON.stringify(defaultState));
        } else {
          memoryStore = {
            adminSecret: defaultState.adminSecret,
            licenses: licRes.rows.map(r => ({
              key: r.key,
              owner: r.owner,
              email: r.email,
              tier: r.tier,
              status: r.status,
              boundIp: r.bound_ip,
              maxServers: r.max_servers,
              createdAt: Number(r.created_at),
              expiresAt: r.expires_at ? Number(r.expires_at) : null,
              banReason: r.ban_reason
            })),
            servers: srvRes.rows.map(r => ({
              id: r.id,
              licenseKey: r.license_key,
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
            violations: vioRes.rows.map(r => ({
              id: r.id,
              licenseKey: r.license_key,
              serverName: r.server_name,
              playerName: r.player_name,
              checkId: r.check_id,
              vl: Number(r.vl),
              details: r.details,
              timestamp: Number(r.timestamp)
            }))
          };
        }
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
      memoryStore = JSON.parse(raw);
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

  // 1. Write to local file
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local file:', err);
  }

  // 2. Asynchronously sync to Supabase PostgreSQL if connected
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
    // Sync licenses
    for (const lic of data.licenses) {
      await client.query(`
        INSERT INTO nexora_licenses (key, owner, email, tier, status, bound_ip, max_servers, created_at, expires_at, ban_reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (key) DO UPDATE SET
          owner = EXCLUDED.owner,
          email = EXCLUDED.email,
          tier = EXCLUDED.tier,
          status = EXCLUDED.status,
          bound_ip = EXCLUDED.bound_ip,
          max_servers = EXCLUDED.max_servers,
          expires_at = EXCLUDED.expires_at,
          ban_reason = EXCLUDED.ban_reason;
      `, [lic.key, lic.owner, lic.email, lic.tier, lic.status, lic.boundIp, lic.maxServers, lic.createdAt, lic.expiresAt, lic.banReason]);
    }

    // Sync servers
    for (const s of data.servers) {
      await client.query(`
        INSERT INTO nexora_servers (id, license_key, server_name, ip, port, mc_version, plugin_version, online_players, tps, status, last_heartbeat, first_seen)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      `, [s.id, s.licenseKey, s.serverName, s.ip, s.port, s.mcVersion, s.pluginVersion, s.onlinePlayers, s.tps, s.status, s.lastHeartbeat, s.firstSeen]);
    }

    // Sync latest 20 violations
    for (const v of data.violations.slice(0, 20)) {
      await client.query(`
        INSERT INTO nexora_violations (id, license_key, server_name, player_name, check_id, vl, details, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING;
      `, [v.id, v.licenseKey, v.serverName, v.playerName, v.checkId, v.vl, v.details, v.timestamp]);
    }
  } finally {
    client.release();
  }
}

// License Key Generator Helper: NX-XXXX-XXXX-XXXX
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `NX-${segment()}-${segment()}-${segment()}`;
}

module.exports = {
  initDatabase,
  readData,
  writeData,
  generateLicenseKey
};
