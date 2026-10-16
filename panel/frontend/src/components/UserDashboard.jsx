import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../apiConfig';

const NAV_ITEMS = [
  { key: 'dashboard', icon: '⚡', label: 'Overview' },
  { key: 'players', icon: '👥', label: 'Online Players' },
  { key: 'bans', icon: '🔨', label: 'Ban Manager' },
  { key: 'kick', icon: '👢', label: 'Kick Player' },
  { key: 'log', icon: '📋', label: 'Activity Log' },
  { key: 'connection', icon: '🌐', label: 'Server Connection' },
  { key: 'info', icon: 'ℹ️', label: 'Server Info' },
];

function truncate(str, len = 18) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

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

export default function UserDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(true);

  /* Ban form state */
  const [banPlayerName, setBanPlayerName] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('PERMANENT');
  const [banIp, setBanIp] = useState(false);
  const [banMsg, setBanMsg] = useState(null);
  const [banSubmitting, setBanSubmitting] = useState(false);

  /* Kick form state */
  const [kickPlayerName, setKickPlayerName] = useState('');
  const [kickReason, setKickReason] = useState('');
  const [kickMsg, setKickMsg] = useState(null);
  const [kickSubmitting, setKickSubmitting] = useState(false);

  /* Action feedback */
  const [actionMsg, setActionMsg] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  /* Fetch portal data */
  const fetchPortal = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/user/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: user.licenseKey, username: user.username }),
      });
      const data = await res.json();
      setPortalData(data);
    } catch (err) {
      console.warn('Portal refresh warning:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user.licenseKey, user.username]);

  useEffect(() => {
    fetchPortal();
    const interval = setInterval(fetchPortal, 8000);
    return () => clearInterval(interval);
  }, [fetchPortal]);

  /* Handle Ban */
  const handleBan = async (e) => {
    e.preventDefault();
    if (!banPlayerName.trim()) return;
    setBanMsg(null);
    setBanSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/players/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: user.licenseKey,
          username: user.username,
          playerName: banPlayerName.trim(),
          reason: banReason.trim() || 'Violating server rules / AntiCheat detection',
          duration: banDuration,
          ipBanned: banIp,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBanMsg({ type: 'success', text: `Player "${banPlayerName}" has been banned.` });
        setBanPlayerName('');
        setBanReason('');
        setBanDuration('PERMANENT');
        setBanIp(false);
        fetchPortal();
      } else {
        setBanMsg({ type: 'error', text: data.error || data.message || 'Ban failed.' });
      }
    } catch {
      setBanMsg({ type: 'error', text: 'Network error connecting to backend.' });
    } finally {
      setBanSubmitting(false);
    }
  };

  /* Handle Unban */
  const handleUnban = async (banId) => {
    try {
      const res = await fetch(`${API_BASE}/api/user/players/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: user.licenseKey, banId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg({ type: 'success', text: data.message || 'Player unbanned.' });
        fetchPortal();
      } else {
        setActionMsg({ type: 'error', text: data.error || 'Failed to unban player.' });
      }
      setTimeout(() => setActionMsg(null), 4000);
    } catch {
      setActionMsg({ type: 'error', text: 'Network connection failed.' });
    }
  };

  /* Handle Kick */
  const handleKick = async (e) => {
    e.preventDefault();
    if (!kickPlayerName.trim()) return;
    setKickMsg(null);
    setKickSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/players/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: user.licenseKey,
          playerName: kickPlayerName.trim(),
          reason: kickReason.trim() || 'Kicked by server administrator',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKickMsg({ type: 'success', text: `Kick signal sent for player "${kickPlayerName}".` });
        setKickPlayerName('');
        setKickReason('');
        fetchPortal();
      } else {
        setKickMsg({ type: 'error', text: data.error || 'Kick failed.' });
      }
    } catch {
      setKickMsg({ type: 'error', text: 'Network error connecting to backend.' });
    } finally {
      setKickSubmitting(false);
    }
  };

  /* Handle Reset IP */
  const handleResetIp = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/user/reset-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: user.licenseKey }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMsg({ type: 'success', text: data.message });
        fetchPortal();
      } else {
        setActionMsg({ type: 'error', text: data.error || 'Failed to reset IP binding.' });
      }
      setTimeout(() => setActionMsg(null), 5000);
    } catch {
      setActionMsg({ type: 'error', text: 'Network error.' });
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(user.licenseKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const server = portalData?.server;
  const license = portalData?.license;
  const violations = portalData?.violations || [];
  const bans = portalData?.playerBans || [];
  const isOnline = server?.isOnline || false;
  const onlineNames = Array.isArray(portalData?.onlinePlayerNames) ? portalData.onlinePlayerNames : [];
  const onlineCount = isOnline ? (onlineNames.length > 0 ? onlineNames.length : (server?.onlinePlayers || 0)) : 0;
  const apiUrl = window.location.origin;

  const configSnippet = `# ==========================================
# NEXORA ANTICHEAT SERVER CONFIGURATION
# ==========================================
license:
  key: "${user.licenseKey}"
  api-url: "${apiUrl}"
  heartbeat-interval-seconds: 60
  report-violations: true
  enforce-bans: true
`;

  const copyConfig = () => {
    navigator.clipboard.writeText(configSnippet);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  /* ========================================================
     PAGES RENDERERS
     ======================================================== */

  // 1. Dashboard Overview
  const renderDashboard = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-desc">Real-time telemetry and protection control for your Minecraft server.</p>
        </div>
        <div className="uptime-badge">
          <span className={`status-dot ${isOnline ? 'status-dot-online' : 'status-dot-offline'}`}></span>
          <span>{isOnline ? 'SERVER ONLINE' : 'SERVER OFFLINE'}</span>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-label">Online Players</span>
          <span className="stat-value" style={{ color: onlineCount > 0 ? 'var(--green)' : '#fff' }}>
            {onlineCount}
          </span>
          <span className="stat-sub">Active in-game now</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Active Bans</span>
          <span className="stat-value" style={{ color: 'var(--primary)' }}>
            {bans.filter(b => b.status === 'ACTIVE').length}
          </span>
          <span className="stat-sub">{bans.length} total recorded</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Violations</span>
          <span className="stat-value" style={{ color: 'var(--yellow)' }}>
            {violations.length}
          </span>
          <span className="stat-sub">Cheat checks flagged</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Server Performance</span>
          <span className="stat-value" style={{ color: tpsColor(server?.tps) }}>
            {isOnline ? `${(server?.tps || 20.0).toFixed(1)} TPS` : 'OFFLINE'}
          </span>
          <span className="stat-sub">{server?.mcVersion || 'Paper / Folia'}</span>
        </div>
      </div>

      <div className="grid-2">
        {/* Quick Online Players Preview */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">👥 In-Game Players</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('players')}>
              View All ({onlineCount})
            </button>
          </div>
          {onlineNames.length > 0 ? (
            onlineNames.slice(0, 5).map((name) => (
              <div className="player-row" key={name}>
                <div className="player-identity">
                  <img
                    className="player-avatar"
                    src={`https://mc-heads.net/avatar/${name}/28`}
                    alt={name}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <span className="player-name">{name}</span>
                </div>
                <div className="player-actions">
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={() => { setKickPlayerName(name); setActiveTab('kick'); }}
                  >
                    Kick
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => { setBanPlayerName(name); setActiveTab('bans'); }}
                  >
                    Ban
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <p>{isOnline ? 'No players currently online on your server.' : 'Server is offline. Start your server to see players.'}</p>
            </div>
          )}
        </div>

        {/* Quick Recent Violations */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">🚨 Recent Violations</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab('log')}>
              Full Log ({violations.length})
            </button>
          </div>
          {violations.length > 0 ? (
            <div className="table-container">
              <table className="nexora-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Check</th>
                    <th>VL</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.slice(0, 5).map((v) => (
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
                      <td>
                        <span className="badge badge-warning">{v.checkId}</span>
                      </td>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        +{Math.round(v.vl)}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {formatDate(v.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <p>No cheat violations flagged yet. Server is clean!</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // 2. Online Players
  const renderOnlinePlayers = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">See Players In Game</h1>
          <p className="page-desc">Live real-time roster of players actively connected to your server.</p>
        </div>
        <div className="badge badge-green">
          {onlineCount} Player{onlineCount !== 1 ? 's' : ''} Online
        </div>
      </div>

      {onlineNames.length > 0 ? (
        <div className="glass-panel">
          {onlineNames.map((name) => (
            <div className="player-row" key={name}>
              <div className="player-identity">
                <img
                  className="player-avatar-large"
                  src={`https://mc-heads.net/avatar/${name}/40`}
                  alt={name}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div>
                  <div className="player-name">{name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Connected to {server?.serverName || 'Minecraft Server'}
                  </div>
                </div>
              </div>
              <div className="player-actions">
                <button
                  className="btn btn-warning btn-sm"
                  onClick={() => {
                    setKickPlayerName(name);
                    setActiveTab('kick');
                  }}
                >
                  ⚡ Kick Player
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    setBanPlayerName(name);
                    setActiveTab('bans');
                  }}
                >
                  🔨 Ban Player
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel empty-state">
          <div className="empty-state-icon">👥</div>
          <h3>No Players Online</h3>
          <p style={{ maxWidth: '420px', margin: '0 auto 16px' }}>
            {isOnline
              ? 'Your server is connected and ready. Players joining your Minecraft server will automatically appear here with full action controls.'
              : 'Your server is currently offline. Start your server and connect the NexoraAntiCheat plugin to monitor online players.'}
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('connection')}>
            🌐 View Server Connection Settings
          </button>
        </div>
      )}
    </>
  );

  // 3. Ban Manager
  const renderBanManager = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ban Manager</h1>
          <p className="page-desc">Issue bans to rulebreakers and manage existing ban records.</p>
        </div>
      </div>

      {actionMsg && (
        <div className={`alert alert-${actionMsg.type}`}>{actionMsg.text}</div>
      )}

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 className="panel-title" style={{ marginBottom: '16px' }}>
          🔨 Ban A Player
        </h3>
        {banMsg && (
          <div className={`alert alert-${banMsg.type}`}>{banMsg.text}</div>
        )}
        <form onSubmit={handleBan}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Player Username *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Cheater123"
                value={banPlayerName}
                onChange={(e) => setBanPlayerName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ban Duration</label>
              <select
                className="select-field"
                value={banDuration}
                onChange={(e) => setBanDuration(e.target.value)}
              >
                <option value="PERMANENT">Permanent (Forever)</option>
                <option value="30_DAYS">30 Days (1 Month)</option>
                <option value="7_DAYS">7 Days (1 Week)</option>
                <option value="24_HOURS">24 Hours (1 Day)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reason for Ban</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Using Fly/Speed hacks, Disrespect, Griefing"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={banIp}
                onChange={(e) => setBanIp(e.target.checked)}
              />
              <span>Block IP address (prevent ban evasion)</span>
            </label>

            <button type="submit" className="btn btn-danger" disabled={banSubmitting}>
              {banSubmitting ? 'Banning...' : '🔨 Execute Ban'}
            </button>
          </div>
        </form>
      </div>

      {/* Ban History Table */}
      <div className="glass-panel">
        <h3 className="panel-title" style={{ marginBottom: '16px' }}>
          📋 Ban History ({bans.length})
        </h3>
        {bans.length > 0 ? (
          <div className="table-container">
            <table className="nexora-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Reason</th>
                  <th>Duration</th>
                  <th>IP Ban</th>
                  <th>Banned By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bans.map((b) => (
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
                    <td>{b.reason}</td>
                    <td>
                      <span className="badge badge-gray">{b.duration}</span>
                    </td>
                    <td>
                      <span className={`badge ${b.ipBanned ? 'badge-danger' : 'badge-gray'}`}>
                        {b.ipBanned ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td>{b.bannedBy || 'Owner'}</td>
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
                          onClick={() => handleUnban(b.id)}
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
            <p>No players have been banned yet.</p>
          </div>
        )}
      </div>
    </>
  );

  // 4. Kick Player
  const renderKickPlayer = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kick Player</h1>
          <p className="page-desc">Immediately disconnect a player from your server.</p>
        </div>
      </div>

      <div className="glass-panel" style={{ maxWidth: '640px' }}>
        <h3 className="panel-title" style={{ marginBottom: '16px' }}>
          👢 Dispatch Kick Command
        </h3>
        {kickMsg && (
          <div className={`alert alert-${kickMsg.type}`}>{kickMsg.text}</div>
        )}

        <form onSubmit={handleKick}>
          <div className="form-group">
            <label className="form-label">Player Username *</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Alex"
              value={kickPlayerName}
              onChange={(e) => setKickPlayerName(e.target.value)}
              required
            />
            {onlineNames.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>Online now:</span>
                {onlineNames.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => setKickPlayerName(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Kick Reason</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Please check your network connection / AFK"
              value={kickReason}
              onChange={(e) => setKickReason(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-warning" disabled={kickSubmitting}>
            {kickSubmitting ? 'Sending Kick...' : '👢 Kick Player Immediately'}
          </button>
        </form>
      </div>
    </>
  );

  // 5. Activity Log (Player Violations)
  const renderActivityLog = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Player AntiCheat Log</h1>
          <p className="page-desc">Comprehensive log of cheat detection events flagged by Nexora AntiCheat.</p>
        </div>
        <div className="badge badge-yellow">
          {violations.length} Event{violations.length !== 1 ? 's' : ''} Logged
        </div>
      </div>

      <div className="glass-panel">
        {violations.length > 0 ? (
          <div className="table-container">
            <table className="nexora-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Detection Check</th>
                  <th>Violation Level (VL)</th>
                  <th>Incident Details</th>
                  <th>Timestamp</th>
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
                      <span style={{ fontWeight: 700 }}>{v.playerName}</span>
                    </td>
                    <td>
                      <span className="badge badge-warning">{v.checkId}</span>
                    </td>
                    <td className="mono" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                      +{Math.round(v.vl)} VL
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {v.details || 'Movement / Combat check triggered'}
                    </td>
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
            <div className="empty-state-icon">🛡️</div>
            <h3>Zero Violations Flagged</h3>
            <p>Your server is currently clean or no cheat checks have triggered yet.</p>
          </div>
        )}
      </div>
    </>
  );

  // 6. Server Connection
  const renderServerConnection = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Connect IP Server IP Port</h1>
          <p className="page-desc">Link your Minecraft server to your Nexora AntiCheat license.</p>
        </div>
      </div>

      {actionMsg && (
        <div className={`alert alert-${actionMsg.type}`}>{actionMsg.text}</div>
      )}

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="glass-panel">
          <h3 className="panel-title" style={{ marginBottom: '16px' }}>
            🌐 Connection Status
          </h3>
          <div className="info-row">
            <span className="info-label">Server IP Address</span>
            <span className="info-value mono">{server?.ip || 'Waiting for heartbeat...'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Server Port</span>
            <span className="info-value mono">{server?.port || '25565'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Bound Host IP</span>
            <span className="info-value mono">{license?.boundIp || '(Unbound — will bind to first host)'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Connection Status</span>
            <span className="info-value">
              <span className={`badge ${isOnline ? 'badge-green' : 'badge-red'}`}>
                {isOnline ? 'ONLINE & PROTECTED' : 'NOT CONNECTED'}
              </span>
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Nexora API Endpoint</span>
            <span className="info-value mono" style={{ fontSize: '12px' }}>{apiUrl}</span>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleResetIp}>
              🔄 Reset Bound IP (Migrate Hosting)
            </button>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Click if you moved your server to a new VPS or host.
            </p>
          </div>
        </div>

        <div className="glass-panel">
          <h3 className="panel-title" style={{ marginBottom: '16px' }}>
            🔑 Your License Key
          </h3>
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            padding: '16px',
            borderRadius: '10px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>LICENSE KEY</div>
            <div className="mono" style={{ fontSize: '17px', fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>
              {user.licenseKey}
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={copyKey}>
            {copiedKey ? '✅ Copied to Clipboard!' : '📋 Copy License Key'}
          </button>
        </div>
      </div>

      {/* Plugin Configuration Guide */}
      <div className="glass-panel">
        <div className="panel-header">
          <h3 className="panel-title">📄 Plugin config.yml Setup</h3>
          <button className="btn btn-secondary btn-sm" onClick={copyConfig}>
            {copiedConfig ? '✅ Copied!' : '📋 Copy Configuration'}
          </button>
        </div>
        <p className="page-desc" style={{ marginBottom: '12px' }}>
          Paste this snippet into <code>plugins/NexoraAntiCheat/config.yml</code> on your Minecraft server:
        </p>
        <pre className="code-block">{configSnippet}</pre>
      </div>
    </>
  );

  // 7. Server Info
  const renderServerInfo = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Have Information</h1>
          <p className="page-desc">Hardware, platform, and license telemetry reported by your server.</p>
        </div>
      </div>

      <div className="uptime-banner">
        <div className="uptime-badge">
          <div className="uptime-pulse"></div>
          <span>24/7 Nexora Fleet Server Running</span>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Always-on Background Monitoring
        </span>
      </div>

      <div className="grid-2">
        <div className="glass-panel">
          <h3 className="panel-title" style={{ marginBottom: '16px' }}>
            🖥️ Server Diagnostics
          </h3>
          <div className="info-row">
            <span className="info-label">Server Name</span>
            <span className="info-value">{server?.serverName || 'Minecraft Server'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Minecraft Core / Platform</span>
            <span className="info-value mono">{server?.mcVersion || 'Paper 1.20+'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Nexora Plugin Version</span>
            <span className="info-value mono">{server?.pluginVersion || 'v1.0.0'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Server Performance (TPS)</span>
            <span className="info-value mono" style={{ color: tpsColor(server?.tps) }}>
              {isOnline ? `${(server?.tps || 20.0).toFixed(1)} / 20.0` : '—'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Connected Players</span>
            <span className="info-value">{onlineCount}</span>
          </div>
          <div className="info-row">
            <span className="info-label">First Seen Online</span>
            <span className="info-value" style={{ fontSize: '12px' }}>{formatDate(server?.firstSeen)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Last Heartbeat Ping</span>
            <span className="info-value" style={{ fontSize: '12px' }}>{formatDate(server?.lastHeartbeat)}</span>
          </div>
        </div>

        <div className="glass-panel">
          <h3 className="panel-title" style={{ marginBottom: '16px' }}>
            📜 License Information
          </h3>
          <div className="info-row">
            <span className="info-label">Registered Owner</span>
            <span className="info-value">{license?.owner || user.username}</span>
          </div>
          <div className="info-row">
            <span className="info-label">License Tier</span>
            <span className="info-value">
              <span className="badge badge-red">{license?.tier || 'LIFETIME'}</span>
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">License Status</span>
            <span className="info-value">
              <span className={`badge ${license?.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}`}>
                {license?.status || 'ACTIVE'}
              </span>
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Max Allowed Servers</span>
            <span className="info-value mono">{license?.maxServers || 1} Host</span>
          </div>
          <div className="info-row">
            <span className="info-label">Expires At</span>
            <span className="info-value">{license?.expiresAt ? formatDate(license.expiresAt) : 'Never (Lifetime)'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Database Provider</span>
            <span className="info-value" style={{ color: 'var(--green)' }}>Supabase PostgreSQL</span>
          </div>
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="glass-panel empty-state">
          <div className="empty-state-icon">⏳</div>
          <h3>Loading telemetry...</h3>
        </div>
      );
    }
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'players': return renderOnlinePlayers();
      case 'bans': return renderBanManager();
      case 'kick': return renderKickPlayer();
      case 'log': return renderActivityLog();
      case 'connection': return renderServerConnection();
      case 'info': return renderServerInfo();
      default: return renderDashboard();
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon-box">🛡️</div>
          <div className="brand-text-box">
            <div className="brand-title">NEXORA<span>AC</span></div>
            <div className="brand-subtitle">Buyer Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Management</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-username">{user.username}</div>
              <div className="sidebar-license-preview">{truncate(user.licenseKey, 14)}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-full" onClick={onLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}
