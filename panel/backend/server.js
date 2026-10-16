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
// Support base64 image uploads for reviews & payment proofs
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Public static assets & JAR download directory
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Local Plugin binary storage directory (No GitHub hosting)
const PLUGINS_STORAGE_DIR = path.join(__dirname, 'storage', 'plugins');
if (!fs.existsSync(PLUGINS_STORAGE_DIR)) {
  fs.mkdirSync(PLUGINS_STORAGE_DIR, { recursive: true });
}

const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PLUGINS_STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    const pluginId = (req.params.id || req.body.pluginId || 'plugin').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    cb(null, `${pluginId}.jar`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max
});

// Serve compiled frontend UI if available
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// -------------------------------------------------------------
// KHQR (BAKONG CAMBODIA) GENERATOR
// -------------------------------------------------------------
function calculateCRC16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTLV(tag, value) {
  const valStr = String(value);
  const lenStr = String(valStr.length).padStart(2, '0');
  return `${tag}${lenStr}${valStr}`;
}

function generateBakongKHQR({ bakongId = 'nexora_tech@aclb', merchantName = 'NEXORA TECHNOLOGIES', amount = '10.00', currency = 'USD', ref = 'NXR-DEP-001' }) {
  let qr = formatTLV('00', '01');
  qr += formatTLV('01', '12'); // Dynamic QR

  const sub00 = formatTLV('00', bakongId);
  qr += formatTLV('29', sub00);

  qr += formatTLV('52', '5732'); // Computer Software Stores

  const currCode = currency.toUpperCase() === 'KHR' ? '116' : '840';
  qr += formatTLV('53', currCode);

  if (amount && Number(amount) > 0) {
    const amtStr = currency.toUpperCase() === 'KHR' ? String(Math.round(Number(amount))) : Number(amount).toFixed(2);
    qr += formatTLV('54', amtStr);
  }

  qr += formatTLV('58', 'KH');
  qr += formatTLV('59', merchantName.substring(0, 25));
  qr += formatTLV('60', 'Phnom Penh');

  const sub01 = formatTLV('01', ref.substring(0, 25));
  qr += formatTLV('62', sub01);

  qr += '6304';
  const checksum = calculateCRC16(qr);
  return qr + checksum;
}

// -------------------------------------------------------------
// 1. AUTHENTICATION & USER MANAGEMENT
// -------------------------------------------------------------

/**
 * Register new user
 * POST /api/auth/register or /api/auth/signup
 */
app.post(['/api/auth/register', '/api/auth/signup'], (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUser = username.trim();
  if (cleanUser.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }

  const data = readData();
  data.users = data.users || [];

  if (data.users.some(u => u.username.toLowerCase() === cleanUser.toLowerCase())) {
    return res.status(409).json({ error: 'Username is already registered.' });
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    username: cleanUser,
    email: (email || '').trim(),
    passwordHash: hash,
    salt,
    role: cleanUser.toLowerCase() === 'admin' ? 'ADMIN' : 'USER',
    balance: cleanUser.toLowerCase() === 'admin' ? 100.00 : 0.00,
    purchasedPlugins: cleanUser.toLowerCase() === 'admin' ? ['nexora-anticheat', 'nexora-core-staff', 'nexora-combat-log', 'nexora-security-bundle'] : [],
    createdAt: Date.now(),
    lastLogin: Date.now()
  };

  data.users.push(newUser);
  writeData(data);

  return res.json({
    success: true,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      balance: newUser.balance,
      purchasedPlugins: newUser.purchasedPlugins
    }
  });
});

/**
 * Login
 * POST /api/auth/login
 */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const data = readData();
  const cleanUser = username.trim().toLowerCase();
  const user = (data.users || []).find(u => u.username.toLowerCase() === cleanUser);

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  user.lastLogin = Date.now();
  writeData(data);

  return res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email || '',
      role: user.role || 'USER',
      balance: Number(user.balance || 0),
      purchasedPlugins: user.purchasedPlugins || []
    }
  });
});

/**
 * Get current user profile & balance
 * GET /api/auth/me?username=...
 */
app.get('/api/auth/me', (req, res) => {
  const { username, userId } = req.query;
  const data = readData();

  const user = (data.users || []).find(u => (userId && u.id === userId) || (username && u.username.toLowerCase() === username.toLowerCase()));
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email || '',
    role: user.role || 'USER',
    balance: Number(user.balance || 0),
    purchasedPlugins: user.purchasedPlugins || []
  });
});

// -------------------------------------------------------------
// 2. E-COMMERCE & PLUGINS MARKETPLACE API
// -------------------------------------------------------------

/**
 * List all marketplace plugins
 * GET /api/plugins
 */
app.get('/api/plugins', (req, res) => {
  const data = readData();
  res.json(data.plugins || []);
});

/**
 * Get single plugin details with changelogs and reviews
 * GET /api/plugins/:id
 */
app.get('/api/plugins/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  const plugin = (data.plugins || []).find(p => p.id === id);
  if (!plugin) {
    return res.status(404).json({ error: 'Plugin not found.' });
  }

  const reviews = (data.reviews || []).filter(r => r.pluginId === id);
  res.json({
    ...plugin,
    reviews
  });
});

/**
 * Purchase a plugin using wallet balance
 * POST /api/plugins/:id/buy
 * Body: { username }
 */
app.post('/api/plugins/:id/buy', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'User session required to complete purchase.' });
  }

  const data = readData();
  const user = (data.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const plugin = (data.plugins || []).find(p => p.id === id);
  if (!plugin) {
    return res.status(404).json({ error: 'Plugin not found.' });
  }

  user.purchasedPlugins = user.purchasedPlugins || [];
  if (user.purchasedPlugins.includes(id)) {
    return res.json({
      success: true,
      alreadyOwned: true,
      message: 'You already own this plugin! Direct download started.',
      downloadUrl: `/api/plugins/${id}/download`,
      balance: user.balance
    });
  }

  const price = Number(plugin.price || 0);
  const currentBalance = Number(user.balance || 0);

  if (currentBalance < price) {
    return res.status(402).json({
      error: 'Insufficient wallet balance.',
      required: price,
      current: currentBalance,
      shortfall: (price - currentBalance).toFixed(2)
    });
  }

  // Deduct balance and grant plugin
  user.balance = Math.max(0, currentBalance - price);
  user.purchasedPlugins.push(id);
  plugin.downloads = (plugin.downloads || 0) + 1;

  writeData(data);

  return res.json({
    success: true,
    message: `Successfully purchased ${plugin.name}!`,
    newBalance: user.balance,
    downloadUrl: `/api/plugins/${id}/download`,
    purchasedPlugins: user.purchasedPlugins
  });
});

/**
 * Download plugin binary (.jar file)
 * GET /api/plugins/:id/download or /api/download/:fileName
 * Download plugin binary directly from local server storage
 * NO GITHUB REDIRECTS to protect proprietary source code.
 * One account downloading a specific plugin file increments its count by 1.
 * Downloading a different plugin file increments that other plugin's count.
 * GET /api/plugins/:id/download
 */
app.get(['/api/plugins/:id/download', '/api/download/:file', '/download'], (req, res) => {
  const data = readData();
  const rawId = req.params.id || (req.params.file ? req.params.file.replace(/\.jar$/i, '') : 'nexora-anticheat');

  const plugin = (data.plugins || []).find(p => p.id === rawId || p.id === 'nexora-anticheat') || {
    id: 'nexora-anticheat',
    name: 'Nexora AntiCheat',
    jarFileName: 'NexoraAntiCheat-1.0.0.jar'
  };

  // Determine user account or client IP identifier
  const username = (req.query.username || '').trim().toLowerCase();
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').replace('::ffff:', '');
  const accountKey = username ? `user_${username}` : `ip_${clientIp}`;

  // Unique download count per account for THIS specific plugin file
  if (plugin.baseDownloads === undefined) {
    plugin.baseDownloads = plugin.downloads || 0;
  }
  plugin.downloadedAccounts = plugin.downloadedAccounts || [];
  if (!plugin.downloadedAccounts.includes(accountKey)) {
    plugin.downloadedAccounts.push(accountKey);
    plugin.downloads = plugin.baseDownloads + plugin.downloadedAccounts.length;
    data.totalDownloads = (data.plugins || []).reduce((sum, p) => sum + (p.downloads || 0), 0);
  }

  // Record audit log
  data.downloads = data.downloads || [];
  data.downloads.unshift({
    id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    pluginId: plugin.id,
    account: accountKey,
    ip: clientIp,
    userAgent: req.headers['user-agent'] || 'Direct Download',
    timestamp: Date.now()
  });
  if (data.downloads.length > 500) data.downloads = data.downloads.slice(0, 500);

  writeData(data);

  // Locate binary in local private server storage
  const primaryStorage = path.join(PLUGINS_STORAGE_DIR, `${plugin.id}.jar`);
  const anticheatStorage = path.join(PLUGINS_STORAGE_DIR, 'nexora-anticheat.jar');
  const targetBuild = path.join(__dirname, '..', '..', 'target', 'nexora-anticheat-1.0.0.jar');
  const publicJar = path.join(publicDir, 'NexoraAntiCheat-1.0.0.jar');

  let fileToSend = null;
  if (fs.existsSync(primaryStorage)) {
    fileToSend = primaryStorage;
  } else if (fs.existsSync(anticheatStorage)) {
    fileToSend = anticheatStorage;
  } else if (fs.existsSync(targetBuild)) {
    fileToSend = targetBuild;
  } else if (fs.existsSync(publicJar)) {
    fileToSend = publicJar;
  }

  if (fileToSend) {
    const filename = plugin.jarFileName || `${plugin.name.replace(/\s+/g, '')}-v${plugin.version || '1.0.0'}.jar`;
    return res.download(fileToSend, filename);
  }

  return res.status(404).send(`
    <!DOCTYPE html>
    <html>
      <head><title>File Not Found</title></head>
      <body style="background:#050505;color:#fff;font-family:monospace;padding:40px;text-align:center;">
        <h2>Plugin File Not Found</h2>
        <p>The administrator has not uploaded the .jar file for ${plugin.name} to server storage yet.</p>
        <p>Please upload it via the Admin Panel.</p>
        <a href="/" style="color:#fff;border:1px solid #fff;padding:8px 16px;text-decoration:none;border-radius:4px;display:inline-block;margin-top:16px;">Back to Store</a>
      </body>
    </html>
  `);
});

// -------------------------------------------------------------
// 3. REVIEWS & FEEDBACK WITH IMAGE UPLOAD
// -------------------------------------------------------------

/**
 * Get reviews for a plugin
 * GET /api/plugins/:id/reviews
 */
app.get('/api/plugins/:id/reviews', (req, res) => {
  const { id } = req.params;
  const data = readData();
  const reviews = (data.reviews || []).filter(r => r.pluginId === id);
  res.json(reviews);
});

/**
 * Post a review / feedback with optional image attachment
 * POST /api/plugins/:id/reviews
 * Body: { username, rating, comment, imageUrl }
 */
app.post('/api/plugins/:id/reviews', (req, res) => {
  const { id } = req.params;
  const { username, rating, comment, imageUrl } = req.body;

  if (!username || !comment) {
    return res.status(400).json({ error: 'User and comment text are required.' });
  }

  const data = readData();
  data.reviews = data.reviews || [];

  const newReview = {
    id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    pluginId: id,
    username: username.trim(),
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    comment: comment.trim(),
    imageUrl: (imageUrl || '').trim(),
    createdAt: Date.now()
  };

  data.reviews.unshift(newReview);

  // Recalculate average rating for plugin
  const plugin = (data.plugins || []).find(p => p.id === id);
  if (plugin) {
    const pluginReviews = data.reviews.filter(r => r.pluginId === id);
    const avg = pluginReviews.reduce((sum, r) => sum + r.rating, 0) / pluginReviews.length;
    plugin.rating = Math.round(avg * 10) / 10;
  }

  writeData(data);
  res.json({ success: true, review: newReview, averageRating: plugin ? plugin.rating : 5.0 });
});

// -------------------------------------------------------------
// 4. WALLET & KHQR (BAKONG CAMBODIA) DEPOSIT API
// -------------------------------------------------------------

/**
 * Generate real Bakong KHQR payload for a deposit amount
 * POST /api/wallet/deposit/khqr/generate
 * Body: { amount, currency, username }
 */
app.post('/api/wallet/deposit/khqr/generate', (req, res) => {
  const { amount, currency = 'USD', username } = req.body;
  const numAmount = Number(amount);

  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid deposit amount required.' });
  }

  const refCode = 'NXR-DEP-' + Math.floor(100000 + Math.random() * 900000);
  const bakongId = 'nexora_tech@aclb';
  const merchantName = 'NEXORA TECHNOLOGIES';

  const khqrString = generateBakongKHQR({
    bakongId,
    merchantName,
    amount: numAmount.toFixed(2),
    currency,
    ref: refCode
  });

  return res.json({
    success: true,
    khqrString,
    refCode,
    amount: numAmount,
    currency: currency.toUpperCase(),
    merchantName,
    bakongId,
    instructions: 'Scan with any Cambodian Banking App (Bakong, ABA Bank, ACLEDA, Wing, Canadia, Sathapana) to complete payment.'
  });
});

/**
 * Submit payment confirmation with reference or receipt proof
 * POST /api/wallet/deposit/khqr/submit
 * Body: { username, amount, currency, refCode, receiptImage, txHash }
 */
app.post('/api/wallet/deposit/khqr/submit', (req, res) => {
  const { username, amount, currency = 'USD', refCode, receiptImage, txHash } = req.body;

  if (!username || !amount || !refCode) {
    return res.status(400).json({ error: 'Username, amount, and reference code are required.' });
  }

  const data = readData();
  const user = (data.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  data.deposits = data.deposits || [];

  const newDeposit = {
    id: 'dep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    userId: user.id,
    username: user.username,
    amount: Number(amount),
    currency: currency.toUpperCase(),
    khqrRef: refCode,
    paymentMethod: 'KHQR (Bakong Cambodia)',
    receiptImage: (receiptImage || txHash || '').trim(),
    status: 'PENDING',
    createdAt: Date.now(),
    approvedAt: null
  };

  data.deposits.unshift(newDeposit);
  writeData(data);

  return res.json({
    success: true,
    message: 'Deposit proof submitted successfully. Funds will be credited once verified.',
    deposit: newDeposit
  });
});

/**
 * Get deposit history for a user
 * GET /api/wallet/deposits?username=...
 */
app.get('/api/wallet/deposits', (req, res) => {
  const { username } = req.query;
  const data = readData();

  if (!username) {
    return res.json([]);
  }

  const userDeposits = (data.deposits || []).filter(d => d.username.toLowerCase() === username.toLowerCase());
  res.json(userDeposits);
});

// -------------------------------------------------------------
// 5. NOTIFICATIONS & CHANGELOGS
// -------------------------------------------------------------

/**
 * Get latest update announcements & changelogs
 * GET /api/notifications
 */
app.get('/api/notifications', (req, res) => {
  const data = readData();
  const notifications = [];

  for (const p of (data.plugins || [])) {
    if (Array.isArray(p.changelogs) && p.changelogs.length > 0) {
      const latest = p.changelogs[0];
      notifications.push({
        id: `notif_${p.id}_${latest.version}`,
        pluginId: p.id,
        pluginName: p.name,
        version: latest.version,
        title: `${p.name} v${latest.version} Released!`,
        date: latest.date,
        summary: latest.title,
        notes: latest.notes || [],
        downloadUrl: `/api/plugins/${p.id}/download`,
        timestamp: Date.now()
      });
    }
  }

  res.json(notifications);
});

// -------------------------------------------------------------
// 6. ADMIN MANAGEMENT API
// -------------------------------------------------------------

/**
 * Admin Stats Overview
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', (req, res) => {
  const data = readData();

  const totalUsers = (data.users || []).length;
  const totalPlugins = (data.plugins || []).length;
  const totalDownloads = data.totalDownloads || (data.downloads || []).length;
  const approvedDeposits = (data.deposits || []).filter(d => d.status === 'APPROVED');
  const totalRevenue = approvedDeposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const pendingDepositsCount = (data.deposits || []).filter(d => d.status === 'PENDING').length;

  res.json({
    totalUsers,
    totalPlugins,
    totalDownloads,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    pendingDepositsCount,
    totalServers: (data.servers || []).length
  });
});

/**
 * Admin list all deposits
 * GET /api/admin/deposits
 */
app.get('/api/admin/deposits', (req, res) => {
  const data = readData();
  res.json(data.deposits || []);
});

/**
 * Admin approve a deposit
 * POST /api/admin/deposits/:id/approve
 */
app.post('/api/admin/deposits/:id/approve', (req, res) => {
  const { id } = req.params;
  const data = readData();

  const deposit = (data.deposits || []).find(d => d.id === id);
  if (!deposit) {
    return res.status(404).json({ error: 'Deposit record not found.' });
  }

  if (deposit.status === 'APPROVED') {
    return res.json({ success: true, message: 'Deposit already approved.', deposit });
  }

  deposit.status = 'APPROVED';
  deposit.approvedAt = Date.now();

  // Credit user wallet balance
  const user = (data.users || []).find(u => u.username.toLowerCase() === deposit.username.toLowerCase() || u.id === deposit.userId);
  if (user) {
    user.balance = (Number(user.balance) || 0) + Number(deposit.amount);
  }

  writeData(data);

  res.json({
    success: true,
    message: `Approved $${deposit.amount} ${deposit.currency} for ${deposit.username}.`,
    newBalance: user ? user.balance : null,
    deposit
  });
});

/**
 * Admin reject a deposit
 * POST /api/admin/deposits/:id/reject
 */
app.post('/api/admin/deposits/:id/reject', (req, res) => {
  const { id } = req.params;
  const data = readData();

  const deposit = (data.deposits || []).find(d => d.id === id);
  if (!deposit) {
    return res.status(404).json({ error: 'Deposit record not found.' });
  }

  deposit.status = 'REJECTED';
  writeData(data);

  res.json({ success: true, message: 'Deposit rejected.', deposit });
});

/**
 * Admin add or update a plugin
 * POST /api/admin/plugins
 */
app.post('/api/admin/plugins', (req, res) => {
  const { id, name, tagline, description, price, version, category, tags, icon } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'Plugin ID and Name are required.' });
  }

  const data = readData();
  data.plugins = data.plugins || [];

  let plugin = data.plugins.find(p => p.id === id);
  if (!plugin) {
    plugin = {
      id: id.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      name,
      tagline: tagline || '',
      description: description || '',
      price: Number(price) || 0,
      version: version || '1.0.0',
      category: category || 'General',
      tags: Array.isArray(tags) ? tags : ['Plugin'],
      icon: icon || '📦',
      downloads: 0,
      rating: 5.0,
      jarFileName: `${name.replace(/\s+/g, '')}-${version || '1.0.0'}.jar`,
      downloadUrl: `/api/plugins/${id}/download`,
      githubReleaseUrl: '',
      supportedVersions: '1.20 - 1.21.4',
      software: ['Paper', 'Purpur', 'Folia'],
      screenshots: [],
      changelogs: [
        {
          version: version || '1.0.0',
          date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          title: 'Initial Release',
          notes: ['Initial publication to Nexora Marketplace.']
        }
      ]
    };
    data.plugins.push(plugin);
  } else {
    plugin.name = name || plugin.name;
    plugin.tagline = tagline !== undefined ? tagline : plugin.tagline;
    plugin.description = description !== undefined ? description : plugin.description;
    plugin.price = price !== undefined ? Number(price) : plugin.price;
    plugin.version = version || plugin.version;
    plugin.category = category || plugin.category;
    if (tags) plugin.tags = Array.isArray(tags) ? tags : plugin.tags;
    if (icon) plugin.icon = icon;
  }

  writeData(data);
  res.json({ success: true, plugin });
});

/**
 * Admin uploads .jar file for a plugin directly to server storage (No GitHub)
 * POST /api/admin/plugins/:id/upload
 */
app.post('/api/admin/plugins/:id/upload', upload.single('jarFile'), (req, res) => {
  const { id } = req.params;
  const data = readData();

  const plugin = (data.plugins || []).find(p => p.id === id);
  if (!plugin) {
    return res.status(404).json({ error: 'Plugin not found.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No .jar file was uploaded.' });
  }

  plugin.jarFileName = req.file.originalname;
  plugin.hasFile = true;
  plugin.fileSize = req.file.size;
  plugin.uploadedAt = Date.now();

  writeData(data);

  return res.json({
    success: true,
    message: `File "${req.file.originalname}" (${(req.file.size / 1024 / 1024).toFixed(2)} MB) uploaded successfully!`,
    plugin
  });
});

/**
 * Admin add changelog to a plugin
 * POST /api/admin/plugins/:id/changelog
 */
app.post('/api/admin/plugins/:id/changelog', (req, res) => {
  const { id } = req.params;
  const { version, title, notes } = req.body;

  const data = readData();
  const plugin = (data.plugins || []).find(p => p.id === id);
  if (!plugin) {
    return res.status(404).json({ error: 'Plugin not found.' });
  }

  plugin.changelogs = plugin.changelogs || [];
  const newLog = {
    version: version || plugin.version,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    title: title || 'Version Update',
    notes: Array.isArray(notes) ? notes : [notes || 'Performance enhancements.']
  };

  plugin.version = newLog.version;
  plugin.changelogs.unshift(newLog);
  writeData(data);

  res.json({ success: true, plugin });
});

/**
 * Admin list all users
 * GET /api/admin/users
 */
app.get('/api/admin/users', (req, res) => {
  const data = readData();
  const users = (data.users || []).map(u => ({
    id: u.id,
    username: u.username,
    email: u.email || '',
    role: u.role || 'USER',
    balance: Number(u.balance || 0),
    purchasedPlugins: u.purchasedPlugins || [],
    createdAt: u.createdAt,
    lastLogin: u.lastLogin
  }));
  res.json(users);
});

/**
 * Admin delete review
 * DELETE /api/admin/reviews/:id
 */
app.delete('/api/admin/reviews/:id', (req, res) => {
  const { id } = req.params;
  const data = readData();
  data.reviews = (data.reviews || []).filter(r => r.id !== id);
  writeData(data);
  res.json({ success: true, message: 'Review deleted.' });
});

// -------------------------------------------------------------
// SPA Catch-all: Send frontend index.html (Express 5 compatible)
// -------------------------------------------------------------
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Nexora Plugins - High-Tech Marketplace</title>
          <style>
            body { background: #050505; color: #fff; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0c0e14; border: 1px solid #1f2432; padding: 32px; border-radius: 8px; text-align: center; max-width: 500px; }
            h1 { font-size: 20px; color: #fff; }
            p { color: #8892a4; font-size: 14px; }
            a { color: #fff; background: #222; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>NEXORA PLUGINS MARKETPLACE</h1>
            <p>API Server running in production. Building frontend distribution...</p>
            <a href="/api/plugins">Browse Plugins API</a>
          </div>
        </body>
      </html>
    `);
  }
});

// Start Express server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Nexora] E-Commerce Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('[Nexora] Critical database startup failure:', err);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Nexora] Server running in fallback mode on port ${PORT}`);
  });
});
