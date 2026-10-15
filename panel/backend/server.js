const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  initDatabase,
  readData,
  writeData,
  generateLicenseKey,
  hashPassword,
  verifyPassword
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve compiled frontend UI if available
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Helper to determine if a server is currently online (heartbeat within 2.5 minutes)
function isServerOnline(server) {
  if (!server || server.status === 'BANNED') return false;
  return Date.now() - (server.lastHeartbeat || 0) < 150000;
}

function calculateExpiry(duration) {
  const d = (duration || '').toUpperCase();
  const now = Date.now();
  if (d.includes('24') || d.includes('1 DAY') || d.includes('24H')) return now + 86400000;
  if (d.includes('7') || d.includes('WEEK') || d.includes('7D')) return now + 86400000 * 7;
  if (d.includes('30') || d.includes('MONTH') || d.includes('30D')) return now + 86400000 * 30;
  return null; // Permanent
}

// -------------------------------------------------------------
// 1. MINECRAFT PLUGIN API ENDPOINTS
// -------------------------------------------------------------

/**
 * Verification on plugin startup.
 * POST /api/license/verify
 */
app.post('/api/license/verify', (req, res) => {
  const { key, serverName, port, mcVersion, pluginVersion, ipOverride } = req.body;
  const clientIp = ipOverride || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  if (!key) {
    return res.status(400).json({ valid: false, reason: 'KEY_MISSING', message: 'License key is missing.' });
  }

  const data = readData();
  const license = data.licenses.find(l => l.key.toUpperCase() === key.trim().toUpperCase());

  if (!license) {
    return res.status(403).json({
      valid: false,
      reason: 'LICENSE_NOT_FOUND',
      message: 'License key not recognized by Nexora Licensing Authority.'
    });
  }

  if (license.status === 'BANNED') {
    return res.status(403).json({
      valid: false,
      reason: 'LICENSE_BANNED',
      message: `License key has been BANNED by Nexora Administration. Reason: ${license.banReason || 'Policy Violation'}`
    });
  }

  if (license.status === 'REVOKED') {
    return res.status(403).json({
      valid: false,
      reason: 'LICENSE_REVOKED',
      message: 'License key has been revoked by administration.'
    });
  }

  if (license.expiresAt && Date.now() > license.expiresAt) {
    return res.status(403).json({
      valid: false,
      reason: 'LICENSE_EXPIRED',
      message: 'License key subscription has expired.'
    });
  }

  // IP Binding check (strictly 1 server per key if maxServers === 1)
  const normalizedClientIp = clientIp.replace('::ffff:', '');
  if (!license.boundIp) {
    // Bind to this first server IP
    license.boundIp = normalizedClientIp;
  } else if (license.boundIp !== normalizedClientIp && license.boundIp !== '127.0.0.1' && normalizedClientIp !== '127.0.0.1') {
    if (license.maxServers <= 1) {
      return res.status(403).json({
        valid: false,
        reason: 'IP_MISMATCH',
        message: `License is already bound to another host (${license.boundIp}). Please reset IP binding on your Buyer Portal before migrating.`
      });
    }
  }

  // Register or update server record
  let server = data.servers.find(s => s.licenseKey === license.key);
  if (!server) {
    server = {
      id: 'srv_' + Math.random().toString(36).substr(2, 9),
      licenseKey: license.key,
      serverName: serverName || 'Minecraft Server',
      ip: normalizedClientIp,
      port: port || 25565,
      mcVersion: mcVersion || 'Paper 26.2',
      pluginVersion: pluginVersion || '1.0.0',
      onlinePlayers: 0,
      tps: 20.0,
      status: 'ONLINE',
      lastHeartbeat: Date.now(),
      firstSeen: Date.now()
    };
    data.servers.push(server);
  } else {
    server.serverName = serverName || server.serverName;
    server.ip = normalizedClientIp;
    server.port = port || server.port;
    server.mcVersion = mcVersion || server.mcVersion;
    server.pluginVersion = pluginVersion || server.pluginVersion;
    server.status = 'ONLINE';
    server.lastHeartbeat = Date.now();
  }

  writeData(data);

  return res.json({
    valid: true,
    owner: license.owner,
    tier: license.tier,
    serverId: server.id,
    boundIp: license.boundIp,
    message: 'License successfully validated.'
  });
});

/**
 * Periodic Heartbeat from running Minecraft server (every 60-120s).
 * POST /api/license/heartbeat
 */
app.post('/api/license/heartbeat', (req, res) => {
  const { key, onlinePlayers, tps, recentViolations } = req.body;
  if (!key) {
    return res.status(400).json({ valid: false, reason: 'KEY_MISSING' });
  }

  const data = readData();
  const license = data.licenses.find(l => l.key.toUpperCase() === key.trim().toUpperCase());

  if (!license) {
    return res.status(403).json({ valid: false, reason: 'LICENSE_NOT_FOUND' });
  }

  if (license.status === 'BANNED') {
    return res.status(403).json({
      valid: false,
      reason: 'LICENSE_BANNED',
      message: `Your server license was BANNED. Disabling Nexora AntiCheat protection.`
    });
  }

  // Update server state
  let server = data.servers.find(s => s.licenseKey === license.key);
  if (server) {
    if (onlinePlayers !== undefined) server.onlinePlayers = Number(onlinePlayers);
    if (tps !== undefined) server.tps = Math.round(Number(tps) * 100) / 100;
    server.lastHeartbeat = Date.now();
    server.status = 'ONLINE';
  }

  // Ingest any cheat violations reported by the server
  if (Array.isArray(recentViolations) && recentViolations.length > 0) {
    for (const v of recentViolations) {
      data.violations.unshift({
        id: 'viol_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        licenseKey: license.key,
        serverName: server ? server.serverName : 'Minecraft Server',
        playerName: v.playerName || 'Unknown',
        checkId: v.checkId || 'Combat/Movement',
        vl: Number(v.vl || 1.0),
        details: v.details || 'Violation flagged',
        timestamp: v.timestamp || Date.now()
      });
    }
    // Cap in-memory history to latest 1000 records
    if (data.violations.length > 1000) {
      data.violations = data.violations.slice(0, 1000);
    }
  }

  writeData(data);

  // Return active player bans for this server so plugin can enforce in-game
  const activeBans = (data.playerBans || [])
    .filter(b => b.licenseKey === license.key && b.status === 'ACTIVE')
    .map(b => ({ playerName: b.playerName, reason: b.reason, ipBanned: b.ipBanned }));

  return res.json({
    status: 'OK',
    serverStatus: license.status,
    activeBans
  });
});

// -------------------------------------------------------------
// 2. USER AUTHENTICATION (SIGNUP & LOGIN)
// -------------------------------------------------------------

/**
 * User Registration (Signup)
 * POST /api/auth/signup
 * Fields: username, password, confirmPassword, licenseKey
 */
app.post('/api/auth/signup', (req, res) => {
  const { username, password, confirmPassword, licenseKey } = req.body;

  if (!username || !password || !confirmPassword || !licenseKey) {
    return res.status(400).json({ error: 'All fields (Username, Password, Confirm Password, License Key) are required.' });
  }

  const cleanUser = username.trim();
  const cleanKey = licenseKey.trim().toUpperCase();

  if (cleanUser.length < 3 || cleanUser.length > 32) {
    return res.status(400).json({ error: 'Username must be between 3 and 32 characters.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const data = readData();
  data.users = data.users || [];
  data.licenses = data.licenses || [];

  // Check if username is taken
  const existingUser = data.users.find(u => u.username.toLowerCase() === cleanUser.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: `Username "${cleanUser}" is already taken.` });
  }

  // Check if license key is already registered to an account
  const existingLicUser = data.users.find(u => u.licenseKey.toUpperCase() === cleanKey);
  if (existingLicUser) {
    return res.status(400).json({ error: 'This license key is already registered to another user account.' });
  }

  // Verify or auto-register the license key
  let license = data.licenses.find(l => l.key.toUpperCase() === cleanKey);
  if (!license) {
    // If not in licenses table yet, create as buyer license
    license = {
      key: cleanKey,
      owner: cleanUser,
      email: null,
      tier: 'LIFETIME',
      status: 'ACTIVE',
      boundIp: null,
      maxServers: 1,
      createdAt: Date.now(),
      expiresAt: null,
      banReason: null
    };
    data.licenses.push(license);
  } else if (license.status === 'BANNED') {
    return res.status(403).json({ error: `This license key has been BANNED: ${license.banReason || 'Policy Violation'}` });
  }

  // Hash password with salt
  const { hash, salt } = hashPassword(password);

  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    username: cleanUser,
    passwordHash: hash,
    salt,
    licenseKey: cleanKey,
    role: 'USER',
    createdAt: Date.now(),
    lastLogin: Date.now()
  };

  data.users.push(newUser);
  writeData(data);

  return res.json({
    success: true,
    message: 'Account successfully registered! Please log in.',
    user: {
      id: newUser.id,
      username: newUser.username,
      licenseKey: newUser.licenseKey,
      role: newUser.role
    }
  });
});

/**
 * User Login
 * POST /api/auth/login
 * Fields: username, password, licenseKey
 */
app.post('/api/auth/login', (req, res) => {
  const { username, password, licenseKey } = req.body;

  if (!username || !password || !licenseKey) {
    return res.status(400).json({ error: 'Username, Password, and License Key are required.' });
  }

  const cleanUser = username.trim();
  const cleanKey = licenseKey.trim().toUpperCase();

  const data = readData();
  data.users = data.users || [];

  const user = data.users.find(
    u => u.username.toLowerCase() === cleanUser.toLowerCase() && u.licenseKey.toUpperCase() === cleanKey
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. Please verify your Username, Password, and License Key.' });
  }

  if (!verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const license = (data.licenses || []).find(l => l.key.toUpperCase() === cleanKey);
  if (license && license.status === 'BANNED') {
    return res.status(403).json({ error: `Your license has been BANNED: ${license.banReason || 'Policy violation'}` });
  }

  user.lastLogin = Date.now();
  writeData(data);

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      licenseKey: user.licenseKey,
      role: user.role
    }
  });
});

// -------------------------------------------------------------
// 3. USER (BUYER) PORTAL & BAN CONTROL API ENDPOINTS
// -------------------------------------------------------------

/**
 * Load user dashboard data (server stats, violations, player bans)
 * POST /api/user/portal
 */
app.post('/api/user/portal', (req, res) => {
  const { key, username } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'License key is required.' });
  }

  const cleanKey = key.trim().toUpperCase();
  const data = readData();

  const license = (data.licenses || []).find(l => l.key.toUpperCase() === cleanKey);
  if (!license) {
    return res.status(404).json({ error: 'License key does not exist.' });
  }

  const server = (data.servers || []).find(s => s.licenseKey === license.key);
  const violations = (data.violations || []).filter(v => v.licenseKey === license.key).slice(0, 100);
  const playerBans = (data.playerBans || []).filter(b => b.licenseKey === license.key);

  res.json({
    license,
    server: server ? { ...server, isOnline: isServerOnline(server) } : null,
    violations,
    playerBans
  });
});

/**
 * User bans a player on their own server
 * POST /api/user/players/ban
 * Fields: licenseKey, username, playerName, reason, duration, ipBanned
 */
app.post('/api/user/players/ban', (req, res) => {
  const { licenseKey, username, playerName, reason, duration, ipBanned } = req.body;

  if (!licenseKey || !playerName) {
    return res.status(400).json({ error: 'License key and player name are required.' });
  }

  const cleanKey = licenseKey.trim().toUpperCase();
  const cleanPlayer = playerName.trim();
  const data = readData();

  const license = (data.licenses || []).find(l => l.key.toUpperCase() === cleanKey);
  if (!license) {
    return res.status(404).json({ error: 'License not found.' });
  }

  if (license.status === 'BANNED') {
    return res.status(403).json({ error: 'Banned licenses cannot manage player bans.' });
  }

  data.playerBans = data.playerBans || [];

  // Check if player is already active-banned
  const existingBan = data.playerBans.find(
    b => b.licenseKey === cleanKey && b.playerName.toLowerCase() === cleanPlayer.toLowerCase() && b.status === 'ACTIVE'
  );

  if (existingBan) {
    return res.status(400).json({ error: `Player "${cleanPlayer}" is already banned on this server.` });
  }

  const server = (data.servers || []).find(s => s.licenseKey === cleanKey);

  const newBan = {
    id: 'pban_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    licenseKey: cleanKey,
    serverName: server ? server.serverName : 'Server',
    playerName: cleanPlayer,
    reason: (reason || '').trim() || 'Violating server rules / Cheat violation',
    duration: duration || 'PERMANENT',
    bannedBy: username || 'Server Owner',
    ipBanned: Boolean(ipBanned),
    bannedAt: Date.now(),
    expiresAt: calculateExpiry(duration),
    status: 'ACTIVE'
  };

  data.playerBans.unshift(newBan);
  writeData(data);

  return res.json({
    success: true,
    message: `Player "${cleanPlayer}" has been banned successfully.`,
    ban: newBan
  });
});

/**
 * User unbans a player on their server
 * POST /api/user/players/unban
 * Fields: licenseKey, banId
 */
app.post('/api/user/players/unban', (req, res) => {
  const { licenseKey, banId } = req.body;
  if (!licenseKey || !banId) {
    return res.status(400).json({ error: 'License key and ban ID are required.' });
  }

  const cleanKey = licenseKey.trim().toUpperCase();
  const data = readData();
  data.playerBans = data.playerBans || [];

  const ban = data.playerBans.find(b => b.id === banId && b.licenseKey === cleanKey);
  if (!ban) {
    return res.status(404).json({ error: 'Ban record not found for this server.' });
  }

  ban.status = 'UNBANNED';
  writeData(data);

  return res.json({
    success: true,
    message: `Player "${ban.playerName}" has been unbanned.`
  });
});

/**
 * User resets their own server IP binding
 * POST /api/user/reset-ip
 */
app.post('/api/user/reset-ip', (req, res) => {
  const { key } = req.body;
  const data = readData();
  const license = (data.licenses || []).find(l => l.key.toUpperCase() === (key || '').trim().toUpperCase());

  if (!license) {
    return res.status(404).json({ error: 'License key not found.' });
  }

  if (license.status === 'BANNED') {
    return res.status(403).json({ error: 'Banned licenses cannot reset IP bindings.' });
  }

  license.boundIp = null;
  writeData(data);
  res.json({ success: true, message: 'Your server IP binding has been cleared! Start your server from the new hosting to bind.' });
});

// -------------------------------------------------------------
// 4. ADMIN FLEET CONTROL API ENDPOINTS (SUPABASE)
// -------------------------------------------------------------

/**
 * Admin authentication
 * POST /api/admin/login
 */
app.post('/api/admin/login', (req, res) => {
  const { secret } = req.body;
  const data = readData();

  if (!secret || secret !== data.adminSecret) {
    return res.status(401).json({ error: 'Invalid admin secret key.' });
  }

  res.json({ success: true, message: 'Admin authenticated.' });
});

/**
 * Global fleet stats for Admin Dashboard
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', (req, res) => {
  const data = readData();
  const totalServersHosted = (data.servers || []).length;
  const activeServersOnline = (data.servers || []).filter(isServerOnline).length;
  const totalLicenses = (data.licenses || []).length;
  const bannedLicenses = (data.licenses || []).filter(l => l.status === 'BANNED').length;
  const totalUsers = (data.users || []).length;
  const totalPlayerBans = (data.playerBans || []).filter(b => b.status === 'ACTIVE').length;
  const totalViolations = (data.violations || []).length;

  res.json({
    totalServersHosted,
    activeServersOnline,
    totalLicenses,
    bannedLicenses,
    totalUsers,
    totalPlayerBans,
    totalViolations
  });
});

/**
 * List all connected servers
 * GET /api/admin/servers
 */
app.get('/api/admin/servers', (req, res) => {
  const data = readData();
  const formatted = (data.servers || []).map(s => ({
    ...s,
    isOnline: isServerOnline(s)
  }));
  res.json(formatted);
});

/**
 * Ban an entire Minecraft server & revoke its license
 * POST /api/admin/servers/:id/ban
 */
app.post('/api/admin/servers/:id/ban', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const data = readData();

  const server = (data.servers || []).find(s => s.id === id);
  if (!server) {
    return res.status(404).json({ error: 'Server not found.' });
  }

  server.status = 'BANNED';
  const license = (data.licenses || []).find(l => l.key === server.licenseKey);
  if (license) {
    license.status = 'BANNED';
    license.banReason = reason || 'Admin server ban';
  }

  writeData(data);
  res.json({ success: true, message: `Server ${server.serverName} has been banned.` });
});

/**
 * List all users stored in Supabase
 * GET /api/admin/users
 */
app.get('/api/admin/users', (req, res) => {
  const data = readData();
  const users = (data.users || []).map(u => ({
    id: u.id,
    username: u.username,
    licenseKey: u.licenseKey,
    role: u.role,
    createdAt: u.createdAt,
    lastLogin: u.lastLogin
  }));
  res.json(users);
});

/**
 * List all licenses
 * GET /api/admin/licenses
 */
app.get('/api/admin/licenses', (req, res) => {
  const data = readData();
  res.json(data.licenses || []);
});

/**
 * Admin creates a new license key
 * POST /api/admin/licenses/create
 */
app.post('/api/admin/licenses/create', (req, res) => {
  const { owner, email, tier, durationDays, maxServers } = req.body;
  if (!owner) {
    return res.status(400).json({ error: 'Buyer / Owner name is required.' });
  }

  const data = readData();
  data.licenses = data.licenses || [];

  const key = generateLicenseKey();
  let expiresAt = null;
  if (durationDays && Number(durationDays) > 0) {
    expiresAt = Date.now() + Number(durationDays) * 86400000;
  }

  const newLicense = {
    key,
    owner: owner.trim(),
    email: email ? email.trim() : null,
    tier: tier || 'LIFETIME',
    status: 'ACTIVE',
    boundIp: null,
    maxServers: Number(maxServers) || 1,
    createdAt: Date.now(),
    expiresAt,
    banReason: null
  };

  data.licenses.unshift(newLicense);
  writeData(data);

  res.json({ success: true, license: newLicense });
});

/**
 * Admin toggles or bans a license
 * POST /api/admin/licenses/:key/status
 */
app.post('/api/admin/licenses/:key/status', (req, res) => {
  const { key } = req.params;
  const { status, reason } = req.body;

  const data = readData();
  const license = (data.licenses || []).find(l => l.key.toUpperCase() === key.toUpperCase());

  if (!license) {
    return res.status(404).json({ error: 'License key not found.' });
  }

  license.status = status || (license.status === 'BANNED' ? 'ACTIVE' : 'BANNED');
  if (license.status === 'BANNED') {
    license.banReason = reason || 'Administrative action';
  } else {
    license.banReason = null;
  }

  writeData(data);
  res.json({ success: true, license });
});

/**
 * Admin resets bound IP for a key
 * POST /api/admin/licenses/:key/reset-ip
 */
app.post('/api/admin/licenses/:key/reset-ip', (req, res) => {
  const { key } = req.params;
  const data = readData();
  const license = (data.licenses || []).find(l => l.key.toUpperCase() === key.toUpperCase());

  if (!license) {
    return res.status(404).json({ error: 'License key not found.' });
  }

  license.boundIp = null;
  writeData(data);
  res.json({ success: true, message: 'IP binding has been reset.' });
});

// Fallback to index.html for client-side routing (compatible with Express 4 and Express 5)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const indexHtml = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send('Nexora Panel API running. Frontend not compiled yet.');
  }
});

// Start listening after database initialization
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`[Nexora Panel API] Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[Nexora Panel API] Database initialization warning:', err.message);
  app.listen(PORT, () => {
    console.log(`[Nexora Panel API] Server running on http://localhost:${PORT}`);
  });
});
