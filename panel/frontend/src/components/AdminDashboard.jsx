import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../apiConfig';

const ADMIN_NAV = [
  { key: 'overview', icon: '📊', label: 'Fleet Overview' },
  { key: 'downloads', icon: '📥', label: 'Plugin Downloads' },
  { key: 'servers', icon: '🖥️', label: 'Server Fleet' },
  { key: 'plugins', icon: '🔌', label: 'Server Plugins' },
  { key: 'players', icon: '👥', label: 'Online Players' },
  { key: 'violations', icon: '🚨', label: 'Violation Logs' },
  { key: 'bans', icon: '🔨', label: 'Player Bans' },
  { key: 'admins', icon: '👤', label: 'Admin Accounts' },
];

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

function tpsColor(tps) {
  const val = Number(tps || 20);
  if (val >= 19.0) return 'var(--green)';
  if (val >= 15.0) return 'var(--yellow)';
  return 'var(--red)';
}

export default function AdminDashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState('overview');
  const [stats, setStats] = useState(null);
  const [servers, setServers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [violations, setViolations] = useState([]);
  const [playerBans, setPlayerBans] = useState([]);
  const [downloadData, setDownloadData] = useState({ totalDownloads: 0, downloads: [] });
  const [pluginSearch, setPluginSearch] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banningServerId, setBanningServerId] = useState(null);
  const [actionAlert, setActionAlert] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  /* Quick action states */
  const [newBanPlayer, setNewBanPlayer] = useState('');
  const [newBanReason, setNewBanReason] = useState('');
  const [kickPlayerName, setKickPlayerName] = useState('');
  const [kickReason, setKickReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, serversRes, adminsRes, violationsRes, bansRes, dlRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`),
        fetch(`${API_BASE}/api/admin/servers`),
        fetch(`${API_BASE}/api/admin/users`),
        fetch(`${API_BASE}/api/admin/violations`),
        fetch(`${API_BASE}/api/admin/player-bans`),
        fetch(`${API_BASE}/api/admin/downloads`),
      ]);

      const [statsD, serversD, adminsD, violationsD, bansD, dlD] = await Promise.all([
        statsRes.json(),
        serversRes.json(),
        adminsRes.json(),
        violationsRes.json(),
        bansRes.json(),
        dlRes.json(),
      ]);

      setStats(statsD);
      setServers(Array.isArray(serversD) ? serversD : []);
      setAdmins(Array.isArray(adminsD) ? adminsD : []);
      setViolations(Array.isArray(violationsD) ? violationsD : []);
      setPlayerBans(Array.isArray(bansD) ? bansD : []);
      setDownloadData(dlD && typeof dlD === 'object' ? dlD : { totalDownloads: 0, downloads: [] });
    } catch (err) {
      console.warn('Admin fetch warning:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleBanServer = async (serverId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/servers/${serverId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: banReason.trim() || 'Admin fleet ban' }),
      });
      const data = await res.json();
      setBanReason('');
      setBanningServerId(null);
      setActionAlert({ type: res.ok ? 'success' : 'error', text: data.message || 'Server banned.' });
      fetchData();
      setTimeout(() => setActionAlert(null), 4000);
    } catch {
      setActionAlert({ type: 'error', text: 'Failed to ban server.' });
    }
  };

  const handleUnbanServer = async (serverId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/servers/${serverId}/unban`, {
        method: 'POST'
      });
      const data = await res.json();
      setActionAlert({ type: res.ok ? 'success' : 'error', text: data.message || 'Server unbanned.' });
      fetchData();
      setTimeout(() => setActionAlert(null), 4000);
    } catch {
      setActionAlert({ type: 'error', text: 'Failed to unban server.' });
    }
  };

  const handleBanPlayer = async (e) => {
    e.preventDefault();
    if (!newBanPlayer.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/players/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: newBanPlayer.trim(),
          reason: newBanReason.trim() || 'Admin ban',
          duration: 'PERMANENT',
          ipBanned: true
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionAlert({ type: 'success', text: `Player "${newBanPlayer}" banned.` });
        setNewBanPlayer('');
        setNewBanReason('');
        fetchData();
      } else {
        setActionAlert({ type: 'error', text: data.error || 'Ban failed.' });
      }
      setTimeout(() => setActionAlert(null), 4000);
    } catch {
      setActionAlert({ type: 'error', text: 'Network connection failed.' });
    }
  };

  const handleUnbanPlayer = async (banId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/players/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banId }),
      });
      const data = await res.json();
      setActionAlert({ type: res.ok ? 'success' : 'error', text: data.message || 'Player unbanned.' });
      fetchData();
      setTimeout(() => setActionAlert(null), 3500);
    } catch {
      setActionAlert({ type: 'error', text: 'Failed to unban player.' });
    }
  };

  const handleKickPlayer = async (playerName) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/players/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, reason: 'Kicked by administrator' }),
      });
      const data = await res.json();
      setActionAlert({ type: res.ok ? 'success' : 'error', text: data.message || 'Kick dispatched.' });
      fetchData();
      setTimeout(() => setActionAlert(null), 3500);
    } catch {
      setActionAlert({ type: 'error', text: 'Failed to kick player.' });
    }
  };

  const downloadUrl = `${window.location.origin}/download`;

  const copyDownloadLink = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Collect all online players across all connected servers
  const allOnlinePlayers = [];
  servers.forEach(s => {
    if (s.isOnline && Array.isArray(s.playerNames)) {
      s.playerNames.forEach(pName => {
        allOnlinePlayers.push({
          name: pName,
          serverName: s.serverName,
          serverIp: `${s.ip}:${s.port}`
        });
      });
    }
  });

  /* ========================================================
     PAGES RENDERERS
     ======================================================== */

  // 1. Overview
  const renderOverview = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet & Downloads Overview</h1>
          <p className="page-desc">Telemetry dashboard monitoring plugin downloads and active Minecraft servers.</p>
        </div>
        <div className="uptime-badge">
          <div className="uptime-pulse"></div>
          <span>24/7 Nexora Authority Active</span>
        </div>
      </div>

      {actionAlert && (
        <div className={`alert alert-${actionAlert.type}`}>{actionAlert.text}</div>
      )}

      {/* Global Stat Cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <span className="stat-label">Plugin Downloads</span>
          <span className="stat-value" style={{ color: 'var(--blue)' }}>
            {downloadData.totalDownloads}
          </span>
          <span className="stat-sub">Total times downloaded</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Active Servers</span>
          <span className="stat-value" style={{ color: 'var(--green)' }}>
            {stats?.onlineServers ?? 0}
          </span>
          <span className="stat-sub">{servers.length} total registered</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Players Online</span>
          <span className="stat-value" style={{ color: '#fff' }}>
            {allOnlinePlayers.length}
          </span>
          <span className="stat-sub">Across all servers</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Violations Flagged</span>
          <span className="stat-value" style={{ color: 'var(--yellow)' }}>
            {violations.length}
          </span>
          <span className="stat-sub">{playerBans.filter(b => b.status === 'ACTIVE').length} active bans</span>
        </div>
      </div>

      {/* Public Download Banner */}
      <div className="glass-panel" style={{
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(255, 26, 42, 0.05) 100%)',
        borderColor: 'rgba(59, 130, 246, 0.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📥 Public Plugin Download Link
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Share this link with your players and server owners. Every download is tracked live in this panel!
            </p>
            <div className="mono" style={{
              background: 'var(--bg-input)',
              padding: '8px 14px',
              borderRadius: '8px',
              marginTop: '10px',
              border: '1px solid var(--border)',
              display: 'inline-block',
              color: '#93c5fd'
            }}>
              {downloadUrl}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={copyDownloadLink}>
              {copiedLink ? '✅ Link Copied!' : '📋 Copy Download Link'}
            </button>
            <a href="/download" className="btn btn-primary" download>
              ⬇️ Download JAR
            </a>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Downloads */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">📥 Recent Plugin Downloads</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setActivePage('downloads')}>
              View All ({downloadData.totalDownloads})
            </button>
          </div>
          {downloadData.downloads && downloadData.downloads.length > 0 ? (
            <div className="table-container">
              <table className="nexora-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User IP</th>
                    <th>Client / Device</th>
                  </tr>
                </thead>
                <tbody>
                  {downloadData.downloads.slice(0, 5).map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {formatDate(d.timestamp)}
                      </td>
                      <td className="mono" style={{ fontSize: '12px', color: 'var(--blue)' }}>
                        {d.ip}
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {d.userAgent ? d.userAgent.slice(0, 32) + '…' : 'Browser'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No downloads recorded yet. Share your download link to see downloads!</p>
            </div>
          )}
        </div>

        {/* Server Fleet Summary */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">🖥️ Connected Servers ({servers.length})</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setActivePage('servers')}>
              Manage Fleet
            </button>
          </div>
          {servers.length > 0 ? (
            <div className="table-container">
              <table className="nexora-table">
                <thead>
                  <tr>
                    <th>Server</th>
                    <th>TPS</th>
                    <th>Players</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {servers.slice(0, 5).map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.serverName}</td>
                      <td className="mono" style={{ color: tpsColor(s.tps) }}>
                        {s.isOnline ? (s.tps != null ? Number(s.tps).toFixed(1) : '20.0') : '—'}
                      </td>
                      <td>{s.isOnline ? (s.onlinePlayers ?? 0) : 0}</td>
                      <td>
                        <span className={`badge ${s.status === 'BANNED' ? 'badge-danger' : s.isOnline ? 'badge-green' : 'badge-gray'}`}>
                          {s.status === 'BANNED' ? 'BANNED' : s.isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No servers connected yet. Install the plugin JAR on your server to connect!</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // 2. Plugin Downloads Tracker (Specific User Request!)
  const renderDownloads = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Plugin Downloads Tracker</h1>
          <p className="page-desc">Live statistics and history of users downloading your Nexora AntiCheat plugin.</p>
        </div>
        <div className="badge badge-blue">
          {downloadData.totalDownloads} Total Download{downloadData.totalDownloads !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-label">Total Downloads</span>
          <span className="stat-value" style={{ color: 'var(--blue)' }}>
            {downloadData.totalDownloads}
          </span>
          <span className="stat-sub">Verified downloads served</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Plugin Binary</span>
          <span className="stat-value" style={{ fontSize: '20px', marginTop: '4px' }}>
            NexoraAntiCheat.jar
          </span>
          <span className="stat-sub">Paper / Folia 1.20 - 1.21+</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Direct Download Link</span>
          <div style={{ marginTop: '6px' }}>
            <button className="btn btn-primary btn-sm btn-full" onClick={copyDownloadLink}>
              {copiedLink ? '✅ Link Copied!' : '📋 Copy Download URL'}
            </button>
          </div>
          <span className="stat-sub">{downloadUrl}</span>
        </div>
      </div>

      {/* Download History Table */}
      <div className="glass-panel">
        <div className="panel-header">
          <h3 className="panel-title">📥 Download Logs ({downloadData.downloads.length})</h3>
          <a href="/download" className="btn btn-secondary btn-sm" download>
            ⬇️ Test Download (.jar)
          </a>
        </div>

        {downloadData.downloads && downloadData.downloads.length > 0 ? (
          <div className="table-container">
            <table className="nexora-table">
              <thead>
                <tr>
                  <th>Download ID</th>
                  <th>IP Address</th>
                  <th>Client / Browser User-Agent</th>
                  <th>Timestamp</th>
                  <th>Delivered File</th>
                </tr>
              </thead>
              <tbody>
                {downloadData.downloads.map((d) => (
                  <tr key={d.id}>
                    <td className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {d.id}
                    </td>
                    <td className="mono" style={{ color: 'var(--blue)', fontWeight: 700 }}>
                      {d.ip}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {d.userAgent || 'Direct Web Download'}
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {formatDate(d.timestamp)}
                    </td>
                    <td>
                      <span className="badge badge-green">NexoraAntiCheat-1.0.0.jar</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📥</div>
            <h3>No Download Events Recorded Yet</h3>
            <p>Share your public download link <code>{downloadUrl}</code> to start tracking downloads.</p>
          </div>
        )}
      </div>
    </>
  );

  // 3. Server Fleet
  const renderServerFleet = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Connected Server Fleet</h1>
          <p className="page-desc">Every Minecraft server running your Nexora AntiCheat plugin.</p>
        </div>
      </div>

      {actionAlert && (
        <div className={`alert alert-${actionAlert.type}`}>{actionAlert.text}</div>
      )}

      <div className="glass-panel">
        {servers.length > 0 ? (
          <div className="table-container">
            <table className="nexora-table">
              <thead>
                <tr>
                  <th>Server Name</th>
                  <th>Host IP:Port</th>
                  <th>Minecraft Core</th>
                  <th>Plugin Version</th>
                  <th>TPS</th>
                  <th>Players</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.serverName}</td>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      {s.ip}:{s.port}
                    </td>
                    <td style={{ fontSize: '12px' }}>{s.mcVersion}</td>
                    <td className="mono" style={{ fontSize: '12px' }}>{s.pluginVersion}</td>
                    <td className="mono" style={{ color: tpsColor(s.tps), fontWeight: 700 }}>
                      {s.isOnline ? (s.tps != null ? Number(s.tps).toFixed(1) : '20.0') : '—'}
                    </td>
                    <td>{s.isOnline ? (s.onlinePlayers ?? 0) : 0}</td>
                    <td>
                      <span className={`badge ${s.status === 'BANNED' ? 'badge-danger' : s.isOnline ? 'badge-green' : 'badge-gray'}`}>
                        {s.status === 'BANNED' ? 'BANNED' : s.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </td>
                    <td>
                      {banningServerId === s.id ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            className="input-field"
                            style={{ padding: '4px 8px', fontSize: '11px', width: '130px' }}
                            placeholder="Reason..."
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                          />
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleBanServer(s.id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setBanningServerId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : s.status === 'BANNED' ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span className="badge badge-danger" style={{ fontSize: '11px' }}>BANNED</span>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleUnbanServer(s.id)}
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                          >
                            Unban
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setBanningServerId(s.id)}
                        >
                          Ban Server
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🖥️</div>
            <h3>No Servers Connected Yet</h3>
            <p>Servers will appear here automatically when they run your Nexora AntiCheat plugin.</p>
          </div>
        )}
      </div>
    </>
  );

  // 4. Server Plugins (Specific user requirement!)
  const renderPlugins = () => {
    const searchLower = pluginSearch.toLowerCase().trim();

    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Inspect Server Plugins</h1>
            <p className="page-desc">View all installed plugins detected on each connected Minecraft server.</p>
          </div>
          <div style={{ minWidth: '260px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="🔍 Search plugins by name..."
              value={pluginSearch}
              onChange={(e) => setPluginSearch(e.target.value)}
            />
          </div>
        </div>

        {servers.length > 0 ? (
          servers.map((s) => {
            const pluginList = Array.isArray(s.plugins) ? s.plugins : [];
            const filteredPlugins = pluginList.filter((p) => {
              const name = typeof p === 'string' ? p : (p.name || '');
              return name.toLowerCase().includes(searchLower);
            });

            return (
              <div className="glass-panel" key={s.id} style={{ marginBottom: '24px' }}>
                <div className="panel-header">
                  <div>
                    <h3 className="panel-title">
                      🖥️ {s.serverName} ({s.ip}:{s.port})
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Minecraft Version: {s.mcVersion || 'Paper'} • Plugin: {s.pluginVersion || '1.0.0'}
                    </div>
                  </div>
                  <div className="badge badge-blue">
                    {pluginList.length} Plugin{pluginList.length !== 1 ? 's' : ''} Detected
                  </div>
                </div>

                {filteredPlugins.length > 0 ? (
                  <div className="grid-4">
                    {filteredPlugins.map((p, idx) => {
                      const pName = typeof p === 'string' ? p : (p.name || 'Plugin');
                      const pVer = typeof p === 'string' ? null : p.version;
                      const isNexora = pName.toLowerCase().includes('nexora');

                      return (
                        <div
                          key={idx}
                          className="plugin-card"
                          style={{
                            borderColor: isNexora ? 'rgba(255, 26, 42, 0.4)' : undefined,
                            background: isNexora ? 'rgba(255, 26, 42, 0.05)' : undefined,
                          }}
                        >
                          <div className="plugin-name">
                            <span>{isNexora ? '🛡️' : '📦'}</span>
                            <span>{pName}</span>
                          </div>
                          <div className="plugin-version">
                            {pVer ? `v${pVer}` : 'Active'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '24px 10px' }}>
                    <p>
                      {searchLower
                        ? `No plugins matching "${pluginSearch}".`
                        : 'No plugin telemetry received yet. Heartbeats will populate the plugin list.'}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="glass-panel empty-state">
            <div className="empty-state-icon">🔌</div>
            <h3>No Servers Connected</h3>
            <p>Connect your Minecraft server to inspect its installed plugins.</p>
          </div>
        )}
      </>
    );
  };

  // 5. Online Players
  const renderPlayers = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Live In-Game Players</h1>
          <p className="page-desc">Every player actively in-game across all connected servers.</p>
        </div>
        <div className="badge badge-green">
          {allOnlinePlayers.length} Active Player{allOnlinePlayers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {actionAlert && (
        <div className={`alert alert-${actionAlert.type}`}>{actionAlert.text}</div>
      )}

      {allOnlinePlayers.length > 0 ? (
        <div className="glass-panel">
          {allOnlinePlayers.map((p, idx) => (
            <div className="player-row" key={idx}>
              <div className="player-identity">
                <img
                  className="player-avatar-large"
                  src={`https://mc-heads.net/avatar/${p.name}/40`}
                  alt={p.name}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div>
                  <div className="player-name">{p.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Playing on {p.serverName} ({p.serverIp})
                  </div>
                </div>
              </div>
              <div className="player-actions">
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => handleKickPlayer(p.name)}
                >
                  ⚡ Kick
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setNewBanPlayer(p.name);
                    setActivePage('bans');
                  }}
                >
                  🔨 Ban
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel empty-state">
          <div className="empty-state-icon">👥</div>
          <h3>No Players Online</h3>
          <p>When players join any Minecraft server running your plugin, they appear here live with Kick & Ban controls.</p>
        </div>
      )}
    </>
  );

  // 6. Violation Logs
  const renderViolations = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Global Violation Logs</h1>
          <p className="page-desc">All anti-cheat checks triggered across every Minecraft server.</p>
        </div>
        <div className="badge badge-yellow">
          {violations.length} Incident{violations.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="glass-panel">
        {violations.length > 0 ? (
          <div className="table-container">
            <table className="nexora-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Server</th>
                  <th>Check</th>
                  <th>VL</th>
                  <th>Details</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr key={v.id}>
                    <td className="player-cell">
                      <img
                        className="player-avatar"
                        src={`https://mc-heads.net/avatar/${v.playerName}/24`}
                        alt={v.playerName}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span>{v.playerName}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {v.serverName}
                    </td>
                    <td>
                      <span className="badge badge-warning">{v.checkId}</span>
                    </td>
                    <td className="mono" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                      +{Math.round(v.vl)}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{v.details}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(v.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No cheat violations flagged yet.</p>
          </div>
        )}
      </div>
    </>
  );

  // 7. Player Bans
  const renderPlayerBans = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Player Bans Management</h1>
          <p className="page-desc">Issue bans or unban players across all servers.</p>
        </div>
      </div>

      {actionAlert && (
        <div className={`alert alert-${actionAlert.type}`}>{actionAlert.text}</div>
      )}

      {/* Manual Ban Form */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 className="panel-title" style={{ marginBottom: '14px' }}>
          🔨 Ban A Player
        </h3>
        <form onSubmit={handleBanPlayer} className="grid-2">
          <input
            type="text"
            className="input-field"
            placeholder="Player username..."
            value={newBanPlayer}
            onChange={(e) => setNewBanPlayer(e.target.value)}
            required
          />
          <input
            type="text"
            className="input-field"
            placeholder="Reason for ban..."
            value={newBanReason}
            onChange={(e) => setNewBanReason(e.target.value)}
          />
          <button type="submit" className="btn btn-danger">
            🔨 Execute Ban
          </button>
        </form>
      </div>

      <div className="glass-panel">
        <h3 className="panel-title" style={{ marginBottom: '14px' }}>
          📋 Ban Records ({playerBans.length})
        </h3>
        {playerBans.length > 0 ? (
          <div className="table-container">
            <table className="nexora-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Server</th>
                  <th>Reason</th>
                  <th>Duration</th>
                  <th>Banned By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {playerBans.map((b) => (
                  <tr key={b.id}>
                    <td className="player-cell">
                      <img
                        className="player-avatar"
                        src={`https://mc-heads.net/avatar/${b.playerName}/24`}
                        alt={b.playerName}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span>{b.playerName}</span>
                    </td>
                    <td>{b.serverName || 'All'}</td>
                    <td>{b.reason}</td>
                    <td>
                      <span className="badge badge-gray">{b.duration}</span>
                    </td>
                    <td>{b.bannedBy || 'Admin'}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(b.bannedAt)}
                    </td>
                    <td>
                      <span className={`badge ${b.status === 'ACTIVE' ? 'badge-danger' : 'badge-green'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      {b.status === 'ACTIVE' ? (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleUnbanPlayer(b.id)}
                        >
                          Unban
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Unbanned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No player bans recorded.</p>
          </div>
        )}
      </div>
    </>
  );

  // 8. Admin Accounts
  const renderAdmins = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Accounts</h1>
          <p className="page-desc">All administrator users authorized on this panel.</p>
        </div>
      </div>

      <div className="glass-panel">
        <div className="table-container">
          <table className="nexora-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Created At</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 700 }}>
                    <span className="player-cell">
                      <span style={{
                        width: '26px', height: '26px', borderRadius: '6px',
                        background: 'var(--primary)', color: '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 800
                      }}>
                        ⚡
                      </span>
                      {a.username}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-danger">ADMINISTRATOR</span>
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {formatDate(a.createdAt)}
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {formatDate(a.lastLogin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const pages = {
    overview: renderOverview,
    downloads: renderDownloads,
    servers: renderServerFleet,
    plugins: renderPlugins,
    players: renderPlayers,
    violations: renderViolations,
    bans: renderPlayerBans,
    admins: renderAdmins,
  };

  return (
    <div className="app-layout">
      {/* Admin Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Bayon Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain', marginRight: '8px' }} />
          <div className="brand-text-box">
            <div className="brand-title">BAYON<span>ADMIN</span></div>
            <div className="brand-subtitle">Fleet Controller</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Management</div>
          {ADMIN_NAV.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activePage === item.key ? 'active' : ''}`}
              onClick={() => setActivePage(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">⚡</div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user?.username || 'Admin'}</div>
              <div className="sidebar-license-preview">ROOT PRIVILEGES</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-full" onClick={onLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Admin Content */}
      <main className="main-content">
        {pages[activePage]?.() ?? renderOverview()}
      </main>
    </div>
  );
}
