const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase, readData, writeData, generateLicenseKey } = require('./database');

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
  if (server.status === 'BANNED') return false;
  return Date.now() - server.lastHeartbeat < 150000;
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

  if (!license || license.status === 'BANNED' || license.status === 'REVOKED') {
    return res.json({
      valid: false,
      reason: license ? license.status : 'LICENSE_NOT_FOUND',
      message: 'License has been suspended or banned. Plugin disabling required.'
    });
  }

  const server = data.servers.find(s => s.licenseKey === license.key);
  if (server) {
    server.lastHeartbeat = Date.now();
    server.onlinePlayers = typeof onlinePlayers === 'number' ? onlinePlayers : server.onlinePlayers;
    server.tps = typeof tps === 'number' ? Math.round(tps * 100) / 100 : server.tps;
    server.status = 'ONLINE';
  }

  // Ingest any recent violations reported by server
  if (Array.isArray(recentViolations) && recentViolations.length > 0) {
    recentViolations.forEach(v => {
      data.violations.unshift({
        id: 'viol_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        licenseKey: license.key,
        serverName: server ? server.serverName : 'Server',
        playerName: v.player || 'Unknown',
        checkId: v.check || 'Unknown',
        vl: v.vl || 1.0,
        details: v.details || 'Violation flagged',
        timestamp: v.timestamp || Date.now()
      });
    });
    // Keep at most 200 recent violations
    if (data.violations.length > 200) {
      data.violations = data.violations.slice(0, 200);
    }
  }

  writeData(data);
  return res.json({ valid: true });
});

// -------------------------------------------------------------
// 2. ADMIN PANEL API ENDPOINTS
// -------------------------------------------------------------

/**
 * Get global stats for Admin Dashboard
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', (req, res) => {
  const data = readData();
  const totalServersHosted = data.servers.length;
  const activeServersOnline = data.servers.filter(s => isServerOnline(s)).length;
  const totalLicenses = data.licenses.length;
  const bannedLicenses = data.licenses.filter(l => l.status === 'BANNED').length;
  const totalViolations = data.violations.length;

  res.json({
    totalServersHosted,
    activeServersOnline,
    totalLicenses,
    bannedLicenses,
    totalViolations
  });
});

/**
 * Get all servers with live status
 * GET /api/admin/servers
 */
app.get('/api/admin/servers', (req, res) => {
  const data = readData();
  const serversWithStatus = data.servers.map(s => ({
    ...s,
    isOnline: isServerOnline(s)
  }));
  res.json(serversWithStatus);
});

/**
 * Ban a server & its associated license key directly from Admin Panel
 * POST /api/admin/servers/:id/ban
 */
app.post('/api/admin/servers/:id/ban', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const data = readData();

  const server = data.servers.find(s => s.id === id);
  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }

  server.status = 'BANNED';
  const license = data.licenses.find(l => l.key === server.licenseKey);
  if (license) {
    license.status = 'BANNED';
    license.banReason = reason || 'Banned by Administrator from Web Panel';
  }

  writeData(data);
  res.json({ success: true, message: 'Server and associated license key banned successfully.' });
});

/**
 * Get all licenses
 * GET /api/admin/licenses
 */
app.get('/api/admin/licenses', (req, res) => {
  const data = readData();
  res.json(data.licenses);
});

/**
 * Generate a new license key
 * POST /api/admin/licenses/create
 */
app.post('/api/admin/licenses/create', (req, res) => {
  const { owner, email, tier, durationDays, maxServers } = req.body;
  if (!owner) {
    return res.status(400).json({ error: 'Owner name is required.' });
  }

  const data = readData();
  let key = generateLicenseKey();
  while (data.licenses.some(l => l.key === key)) {
    key = generateLicenseKey();
  }

  let expiresAt = null;
  if (tier === '30_DAYS') {
    expiresAt = Date.now() + 86400000 * 30;
  } else if (tier === '1_YEAR') {
    expiresAt = Date.now() + 86400000 * 365;
  } else if (durationDays && Number(durationDays) > 0) {
    expiresAt = Date.now() + 86400000 * Number(durationDays);
  }

  const newLicense = {
    key,
    owner: owner.trim(),
    email: (email || '').trim(),
    tier: tier || 'LIFETIME',
    status: 'ACTIVE',
    boundIp: null,
    maxServers: maxServers ? Number(maxServers) : 1,
    createdAt: Date.now(),
    expiresAt,
    banReason: null
  };

  data.licenses.unshift(newLicense);
  writeData(data);

  res.json({ success: true, license: newLicense });
});

/**
 * Change license status (ACTIVE, BANNED, REVOKED)
 * POST /api/admin/licenses/:key/status
 */
app.post('/api/admin/licenses/:key/status', (req, res) => {
  const { key } = req.params;
  const { status, reason } = req.body;
  const data = readData();

  const license = data.licenses.find(l => l.key === key);
  if (!license) {
    return res.status(404).json({ error: 'License key not found.' });
  }

  license.status = status;
  if (status === 'BANNED') {
    license.banReason = reason || 'Banned by Administrator';
    // Also mark connected server as banned
    const server = data.servers.find(s => s.licenseKey === key);
    if (server) {
      server.status = 'BANNED';
    }
  } else if (status === 'ACTIVE') {
    license.banReason = null;
    const server = data.servers.find(s => s.licenseKey === key);
    if (server && server.status === 'BANNED') {
      server.status = 'OFFLINE';
    }
  }

  writeData(data);
  res.json({ success: true, license });
});

/**
 * Reset bound IP for a license key
 * POST /api/admin/licenses/:key/reset-ip
 */
app.post('/api/admin/licenses/:key/reset-ip', (req, res) => {
  const { key } = req.params;
  const data = readData();

  const license = data.licenses.find(l => l.key === key);
  if (!license) {
    return res.status(404).json({ error: 'License key not found.' });
  }

  license.boundIp = null;
  writeData(data);
  res.json({ success: true, message: 'Server IP binding has been reset.' });
});

// -------------------------------------------------------------
// 3. USER (BUYER) PORTAL API ENDPOINTS
// -------------------------------------------------------------

/**
 * User login with license key
 * POST /api/user/portal
 */
app.post('/api/user/portal', (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'Please enter your license key.' });
  }

  const data = readData();
  const license = data.licenses.find(l => l.key.toUpperCase() === key.trim().toUpperCase());
  if (!license) {
    return res.status(404).json({ error: 'License key does not exist.' });
  }

  const server = data.servers.find(s => s.licenseKey === license.key);
  const violations = data.violations.filter(v => v.licenseKey === license.key).slice(0, 50);

  res.json({
    license,
    server: server ? { ...server, isOnline: isServerOnline(server) } : null,
    violations
  });
});

/**
 * User resets their own server IP binding
 * POST /api/user/reset-ip
 */
app.post('/api/user/reset-ip', (req, res) => {
  const { key } = req.body;
  const data = readData();
  const license = data.licenses.find(l => l.key.toUpperCase() === (key || '').trim().toUpperCase());

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

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
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

