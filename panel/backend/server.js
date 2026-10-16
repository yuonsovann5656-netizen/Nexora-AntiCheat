const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const {
  initDatabase,
  readData,
  writeData,
  hashPassword,
  verifyPassword
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Public static assets & JAR download directory
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Serve compiled frontend UI if available
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Path to compiled Minecraft plugin JAR file
const JAR_PATHS = [
  path.join(publicDir, 'NexoraAntiCheat-1.0.0.jar'),
  path.join(__dirname, '..', '..', 'target', 'nexora-anticheat-1.0.0.jar')
];

function getPluginJarPath() {
  for (const p of JAR_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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
// 1. PUBLIC PLUGIN DOWNLOAD & TRACKING (TRACK HOW MANY USERS DOWNLOAD)
// -------------------------------------------------------------

function recordDownload(req) {
  const data = readData();
  data.downloads = data.downloads || [];
  data.totalDownloads = (data.totalDownloads || 0) + 1;

  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
  const userAgent = req.headers['user-agent'] || 'Browser / Direct Download';

  const downloadRecord = {
    id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    ip: clientIp,
    userAgent: userAgent.slice(0, 200),
    timestamp: Date.now()
  };

  data.downloads.unshift(downloadRecord);
  if (data.downloads.length > 500) {
    data.downloads = data.downloads.slice(0, 500);
  }

  writeData(data);
  return downloadRecord;
}

/**
 * Public Download route: /download or /api/download
 * Increments download counter, logs user info, and sends JAR file.
 */
app.get(['/download', '/api/download', '/api/download/nexora-anticheat.jar'], (req, res) => {
  const jarPath = getPluginJarPath();

  // Record this download in database
  recordDownload(req);

  if (jarPath && fs.existsSync(jarPath)) {
    res.download(jarPath, 'NexoraAntiCheat-1.0.0.jar', (err) => {
      if (err && !res.headersSent) {
        res.redirect('https://github.com/yuonsovann5656-netizen/Nexora-AntiCheat/releases/download/v1.0.0/NexoraAntiCheat-1.0.0.jar');
      }
    });
  } else {
    // Redirect to direct GitHub release binary
    res.redirect('https://github.com/yuonsovann5656-netizen/Nexora-AntiCheat/releases/download/v1.0.0/NexoraAntiCheat-1.0.0.jar');
  }
});

// -------------------------------------------------------------
// 2. MINECRAFT SERVER TELEMETRY (NO LICENSE KEY REQUIRED - FREE)
// -------------------------------------------------------------

/**
 * Server startup verification & registration.
 * Completely free — no license key required.
 * POST /api/license/verify
 */
app.post('/api/license/verify', (req, res) => {
  const { serverName, port, mcVersion, pluginVersion, ipOverride } = req.body;
  const clientIp = (ipOverride || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');

  const data = readData();
  data.servers = data.servers || [];

  const sName = (serverName || 'Minecraft Server').trim();
  const sPort = Number(port) || 25565;

  // Find or register server by IP + port or name
  let server = data.servers.find(s => (s.ip === clientIp && s.port === sPort) || s.serverName === sName);

  if (!server) {
    server = {
      id: 'srv_' + Math.random().toString(36).substr(2, 9),
      serverName: sName,
      ip: clientIp,
      port: sPort,
      mcVersion: mcVersion || 'Paper 1.20+',
      pluginVersion: pluginVersion || '1.0.0',
      onlinePlayers: 0,
      tps: 20.0,
      status: 'ONLINE',
      lastHeartbeat: Date.now(),
      firstSeen: Date.now(),
      plugins: [],
      playerNames: []
    };
    data.servers.push(server);
  } else {
    if (server.status === 'BANNED') {
      return res.status(403).json({
        valid: false,
        reason: 'SERVER_BANNED',
        message: 'This server has been suspended by Nexora Administration.'
      });
    }
    server.serverName = sName;
    server.ip = clientIp;
    server.port = sPort;
    server.mcVersion = mcVersion || server.mcVersion;
    server.pluginVersion = pluginVersion || server.pluginVersion;
    server.status = 'ONLINE';
    server.lastHeartbeat = Date.now();
  }

  writeData(data);

  return res.json({
    valid: true,
    serverId: server.id,
    serverName: server.serverName,
    tier: 'FREE_COMMUNITY',
    message: 'Nexora AntiCheat verified successfully.'
  });
});

/**
 * Periodic Heartbeat from running Minecraft server.
 * POST /api/license/heartbeat
 */
app.post('/api/license/heartbeat', (req, res) => {
  const { serverId, serverName, onlinePlayers, tps, recentViolations, playerNames, plugins } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');

  const data = readData();
  data.servers = data.servers || [];

  // Match server
  let server = data.servers.find(s => s.id === serverId || (s.ip === clientIp && s.serverName === serverName));
  if (!server) {
    server = {
      id: serverId || ('srv_' + Math.random().toString(36).substr(2, 9)),
      serverName: serverName || 'Minecraft Server',
      ip: clientIp,
      port: 25565,
      mcVersion: 'Paper 1.20+',
      pluginVersion: '1.0.0',
      onlinePlayers: Number(onlinePlayers || 0),
      tps: Number(tps || 20.0),
      status: 'ONLINE',
      lastHeartbeat: Date.now(),
      firstSeen: Date.now()
    };
    data.servers.push(server);
  } else {
    if (server.status === 'BANNED') {
      return res.status(403).json({ valid: false, reason: 'SERVER_BANNED' });
    }
    if (onlinePlayers !== undefined) server.onlinePlayers = Number(onlinePlayers);
    if (tps !== undefined) server.tps = Math.round(Number(tps) * 100) / 100;
    if (Array.isArray(playerNames)) server.playerNames = playerNames;
    if (Array.isArray(plugins)) server.plugins = plugins;
    server.lastHeartbeat = Date.now();
    server.status = 'ONLINE';
  }

  // Ingest violations reported by server
  if (Array.isArray(recentViolations) && recentViolations.length > 0) {
    data.violations = data.violations || [];
    for (const v of recentViolations) {
      data.violations.unshift({
        id: 'viol_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        serverName: server.serverName,
        playerName: v.playerName || 'Unknown',
        checkId: v.checkId || 'Combat/Movement',
        vl: Number(v.vl || 1.0),
        details: v.details || 'Cheat violation flagged',
        timestamp: v.timestamp || Date.now()
      });
    }
    if (data.violations.length > 1000) {
      data.violations = data.violations.slice(0, 1000);
    }
  }

  // Pending kicks for this server
  data.pendingKicks = data.pendingKicks || [];
  const pendingKicks = data.pendingKicks.filter(k => k.status === 'PENDING');
  pendingKicks.forEach(k => { k.status = 'DELIVERED'; });

  writeData(data);

  // Active player bans
  const activeBans = (data.playerBans || [])
    .filter(b => b.status === 'ACTIVE')
    .map(b => ({ playerName: b.playerName, reason: b.reason, ipBanned: b.ipBanned }));

  return res.json({
    status: 'OK',
    valid: true,
    serverStatus: server.status,
    activeBans,
    pendingKicks: pendingKicks.map(k => ({ playerName: k.playerName, reason: k.reason }))
  });
});

// -------------------------------------------------------------
// 3. ADMIN AUTHENTICATION (NO LICENSE KEY - USERNAME & PASSWORD ONLY)
// -------------------------------------------------------------

/**
 * Admin Login
 * POST /api/auth/login
 * Body: { username, password }
 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and Password are required.' });
  }

  const cleanUser = username.trim();
  const data = readData();
  data.users = data.users || [];

  const user = data.users.find(u => u.username.toLowerCase() === cleanUser.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  if (!verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  user.lastLogin = Date.now();
  writeData(data);

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: 'ADMIN'
    }
  });
});

/**
 * Admin Signup / Register
 * POST /api/auth/signup
 * Body: { username, password, confirmPassword }
 */
app.post('/api/auth/signup', (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Username, Password, and Confirm Password are required.' });
  }

  const cleanUser = username.trim();

  if (cleanUser.length < 3 || cleanUser.length > 32) {
    return res.status(400).json({ error: 'Username must be between 3 and 32 characters.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  const data = readData();
  data.users = data.users || [];

  const existing = data.users.find(u => u.username.toLowerCase() === cleanUser.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: `Username "${cleanUser}" is already taken.` });
  }

  const { hash, salt } = hashPassword(password);

  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    username: cleanUser,
    passwordHash: hash,
    salt,
    role: 'ADMIN',
    createdAt: Date.now(),
    lastLogin: Date.now()
  };

  data.users.push(newUser);
  writeData(data);

  return res.json({
    success: true,
    message: 'Admin account created successfully! Please sign in.',
    user: {
      id: newUser.id,
      username: newUser.username,
      role: 'ADMIN'
    }
  });
});

// -------------------------------------------------------------
// 4. ADMIN PANEL FLEET & DOWNLOADS API ENDPOINTS
// -------------------------------------------------------------

/**
 * Plugin Downloads Tracker Stats & History
 * GET /api/admin/downloads
 */
app.get('/api/admin/downloads', (req, res) => {
  const data = readData();
  res.json({
    totalDownloads: data.totalDownloads || (data.downloads ? data.downloads.length : 0),
    downloads: data.downloads || []
  });
});

/**
 * Global stats for Admin Panel
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', (req, res) => {
  const data = readData();
  const totalServersHosted = (data.servers || []).length;
  const activeServersOnline = (data.servers || []).filter(isServerOnline).length;
  const totalUsers = (data.users || []).length;
  const totalPlayerBans = (data.playerBans || []).filter(b => b.status === 'ACTIVE').length;
  const totalViolations = (data.violations || []).length;
  const totalDownloads = data.totalDownloads || (data.downloads ? data.downloads.length : 0);

  res.json({
    totalDownloads,
    totalServersHosted,
    activeServersOnline,
    totalUsers,
    totalPlayerBans,
    totalViolations,
    totalServers: totalServersHosted,
    onlineServers: activeServersOnline,
    registeredUsers: totalUsers,
    activeBans: totalPlayerBans
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
 * Ban/Suspend a Minecraft server
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
  server.banReason = reason || 'Admin server ban';
  writeData(data);

  res.json({ success: true, message: `Server "${server.serverName}" has been banned.` });
});

/**
 * List all admin accounts
 * GET /api/admin/users
 */
app.get('/api/admin/users', (req, res) => {
  const data = readData();
  const users = (data.users || []).map(u => ({
    id: u.id,
    username: u.username,
    role: u.role || 'ADMIN',
    createdAt: u.createdAt,
    lastLogin: u.lastLogin
  }));
  res.json(users);
});

/**
 * List all violations across all servers
 * GET /api/admin/violations
 */
app.get('/api/admin/violations', (req, res) => {
  const data = readData();
  res.json(data.violations || []);
});

/**
 * List all player bans across all servers
 * GET /api/admin/player-bans
 */
app.get('/api/admin/player-bans', (req, res) => {
  const data = readData();
  res.json(data.playerBans || []);
});

/**
 * Admin bans a player globally or on a specific server
 * POST /api/admin/players/ban
 */
app.post('/api/admin/players/ban', (req, res) => {
  const { playerName, reason, duration, ipBanned, serverName } = req.body;
  if (!playerName) {
    return res.status(400).json({ error: 'Player name is required.' });
  }

  const cleanPlayer = playerName.trim();
  const data = readData();
  data.playerBans = data.playerBans || [];

  const newBan = {
    id: 'pban_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    serverName: serverName || 'All Servers',
    playerName: cleanPlayer,
    reason: (reason || '').trim() || 'Admin ban',
    duration: duration || 'PERMANENT',
    bannedBy: 'Admin',
    ipBanned: Boolean(ipBanned),
    bannedAt: Date.now(),
    expiresAt: calculateExpiry(duration),
    status: 'ACTIVE'
  };

  data.playerBans.unshift(newBan);
  writeData(data);

  res.json({ success: true, message: `Player "${cleanPlayer}" banned.`, ban: newBan });
});

/**
 * Admin unbans a player
 * POST /api/admin/players/unban
 */
app.post('/api/admin/players/unban', (req, res) => {
  const { banId } = req.body;
  const data = readData();
  data.playerBans = data.playerBans || [];

  const ban = data.playerBans.find(b => b.id === banId);
  if (!ban) {
    return res.status(404).json({ error: 'Ban record not found.' });
  }

  ban.status = 'UNBANNED';
  writeData(data);

  res.json({ success: true, message: `Player "${ban.playerName}" unbanned.` });
});

/**
 * Admin kicks a player
 * POST /api/admin/players/kick
 */
app.post('/api/admin/players/kick', (req, res) => {
  const { playerName, reason } = req.body;
  if (!playerName) {
    return res.status(400).json({ error: 'Player name is required.' });
  }

  const data = readData();
  data.pendingKicks = data.pendingKicks || [];

  const kickItem = {
    id: 'kick_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    playerName: playerName.trim(),
    reason: (reason || '').trim() || 'Kicked by administrator',
    status: 'PENDING',
    timestamp: Date.now()
  };

  data.pendingKicks.push(kickItem);
  writeData(data);

  res.json({ success: true, message: `Kick signal sent for player "${playerName}".` });
});

/**
 * Health check endpoint for external uptime monitors (UptimeRobot, BetterStack, Render)
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Nexora AntiCheat Licensing & Fleet Authority',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
});

// Fallback to index.html for client-side routing (compatible with Express 4 and Express 5)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const indexHtml = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.send('Nexora AntiCheat Admin Panel API running. Frontend not compiled yet.');
  }
});

// 24/7 Keep-Alive self-pinger (prevents Render Free tier from sleeping after 15 mins)
function startKeepAlive() {
  const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
  if (!externalUrl) {
    console.log('[24/7 KeepAlive] RENDER_EXTERNAL_URL not set. Set it in Render dashboard or use UptimeRobot to ping /api/health every 5 minutes.');
    return;
  }

  const pingUrl = externalUrl.replace(/\/+$/, '') + '/api/health';
  console.log(`[24/7 KeepAlive] Service active. Auto-pinging ${pingUrl} every 10 minutes to stay online 24/7.`);

  setInterval(() => {
    try {
      const client = pingUrl.startsWith('https') ? https : http;
      client.get(pingUrl, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          console.log(`[24/7 KeepAlive] Ping successful (Status: ${res.statusCode}) at ${new Date().toISOString()}`);
        });
      }).on('error', (err) => {
        console.warn(`[24/7 KeepAlive] Ping warning: ${err.message}`);
      });
    } catch (e) {
      console.warn(`[24/7 KeepAlive] Exception on ping: ${e.message}`);
    }
  }, 10 * 60 * 1000);
}

// Start listening after database initialization
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`[Nexora Panel API] Server running on http://localhost:${PORT}`);
    startKeepAlive();
  });
}).catch(err => {
  console.error('[Nexora Panel API] Database initialization warning:', err.message);
  app.listen(PORT, () => {
    console.log(`[Nexora Panel API] Server running on http://localhost:${PORT}`);
    startKeepAlive();
  });
});
