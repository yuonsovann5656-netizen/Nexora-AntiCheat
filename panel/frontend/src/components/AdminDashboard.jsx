import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../apiConfig';
import KeyGeneratorModal from './KeyGeneratorModal';

const ADMIN_NAV = [
  { key: 'overview', icon: '📊', label: 'Fleet Overview' },
  { key: 'servers', icon: '🖥️', label: 'Server Fleet' },
  { key: 'plugins', icon: '🔌', label: 'Server Plugins' },
  { key: 'users', icon: '👥', label: 'Registered Users' },
  { key: 'licenses', icon: '🔑', label: 'License Keys' },
  { key: 'violations', icon: '🚨', label: 'Violation Logs' },
  { key: 'bans', icon: '🔨', label: 'Player Bans' },
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
  const [users, setUsers] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [violations, setViolations] = useState([]);
  const [playerBans, setPlayerBans] = useState([]);
  const [showKeyGen, setShowKeyGen] = useState(false);
  const [pluginSearch, setPluginSearch] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banningServerId, setBanningServerId] = useState(null);
  const [actionAlert, setActionAlert] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, serversRes, usersRes, licensesRes, violationsRes, bansRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`),
        fetch(`${API_BASE}/api/admin/servers`),
        fetch(`${API_BASE}/api/admin/users`),
        fetch(`${API_BASE}/api/admin/licenses`),
        fetch(`${API_BASE}/api/admin/violations`),
        fetch(`${API_BASE}/api/admin/player-bans`),
      ]);

      const [statsData, serversData, usersData, licensesData, violationsData, bansData] = await Promise.all([
        statsRes.json(),
        serversRes.json(),
        usersRes.json(),
        licensesRes.json(),
        violationsRes.json(),
        bansRes.json(),
      ]);

      setStats(statsData);
      setServers(Array.isArray(serversData) ? serversData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setLicenses(Array.isArray(licensesData) ? licensesData : []);
      setViolations(Array.isArray(violationsData) ? violationsData : []);
      setPlayerBans(Array.isArray(bansData) ? bansData : []);
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
        body: JSON.stringify({ reason: banReason.trim() || 'Administrative fleet ban' }),
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

  const handleToggleLicenseStatus = async (key) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/licenses/${encodeURIComponent(key)}/status`, {
        method: 'POST',
      });
      const data = await res.json();
      setActionAlert({ type: 'success', text: `License ${key} status updated.` });
      fetchData();
      setTimeout(() => setActionAlert(null), 3000);
    } catch {
      setActionAlert({ type: 'error', text: 'Failed to update license status.' });
    }
  };

  const handleResetIp = async (key) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/licenses/${encodeURIComponent(key)}/reset-ip`, {
        method: 'POST',
      });
      const data = await res.json();
      setActionAlert({ type: 'success', text: `IP binding reset for license ${key}.` });
      fetchData();
      setTimeout(() => setActionAlert(null), 3000);
    } catch {
      setActionAlert({ type: 'error', text: 'Failed to reset IP.' });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setActionAlert({ type: 'success', text: `Copied ${text} to clipboard!` });
    setTimeout(() => setActionAlert(null), 2500);
  };

  /* ========================================================
     PAGES RENDERERS
     ======================================================== */

  // 1. Overview
  const renderOverview = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet Overview (Admin Authority)</h1>
          <p className="page-desc">Global network telemetry across all licensed Minecraft servers.</p>
        </div>
        <div className="uptime-badge">
          <div className="uptime-pulse"></div>
          <span>24/7 Licensing Authority Active</span>
        </div>
      </div>

      {actionAlert && (
        <div className={`alert alert-${actionAlert.type}`}>{actionAlert.text}</div>
      )}

      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-label">Total Servers</span>
          <span className="stat-value">{stats?.totalServersHosted ?? stats?.totalServers ?? 0}</span>
          <span className="stat-sub">{stats?.activeServersOnline ?? stats?.onlineServers ?? 0} online now</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Registered Users</span>
          <span className="stat-value" style={{ color: 'var(--blue)' }}>
            {stats?.totalUsers ?? stats?.registeredUsers ?? 0}
          </span>
          <span className="stat-sub">Accounts in Supabase</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Issued Licenses</span>
          <span className="stat-value" style={{ color: 'var(--green)' }}>
            {stats?.totalLicenses ?? stats?.issuedLicenses ?? 0}
          </span>
          <span className="stat-sub">{stats?.bannedLicenses ?? 0} banned</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Active Player Bans</span>
          <span className="stat-value" style={{ color: 'var(--primary)' }}>
            {stats?.totalPlayerBans ?? stats?.activeBans ?? 0}
          </span>
          <span className="stat-sub">{violations.length} violations logged</span>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Violations */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">🚨 Recent Violations Fleet-Wide</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setActivePage('violations')}>
              View All ({violations.length})
            </button>
          </div>
          {violations.length > 0 ? (
            <div className="table-container">
              <table className="nexora-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Server</th>
                    <th>Check</th>
                    <th>VL</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.slice(0, 6).map((v) => (
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
                      <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {v.serverName || 'Minecraft Server'}
                      </td>
                      <td>
                        <span className="badge badge-warning">{v.checkId}</span>
                      </td>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        +{Math.round(v.vl)}
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
              <p>No violations flagged recently.</p>
            </div>
          )}
        </div>

        {/* Server Fleet Quick Status */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">🖥️ Server Fleet Status</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setActivePage('servers')}>
              Manage Fleet ({servers.length})
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
                  {servers.slice(0, 6).map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.serverName}</td>
                      <td className="mono" style={{ color: tpsColor(s.tps) }}>
                        {s.isOnline ? `${(s.tps || 20).toFixed(1)}` : '—'}
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
              <p>No Minecraft servers have connected yet.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // 2. Server Fleet
  const renderServerFleet = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Server Fleet</h1>
          <p className="page-desc">All Minecraft servers licensed with Nexora AntiCheat.</p>
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
                  <th>License Key</th>
                  <th>MC Version</th>
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
                    <td className="mono" style={{ fontSize: '11px' }}>
                      <span
                        onClick={() => copyToClipboard(s.licenseKey)}
                        style={{ cursor: 'pointer', color: 'var(--blue)' }}
                        title="Click to copy"
                      >
                        {s.licenseKey}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>{s.mcVersion}</td>
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
                            placeholder="Ban reason..."
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
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={s.status === 'BANNED'}
                          onClick={() => setBanningServerId(s.id)}
                        >
                          {s.status === 'BANNED' ? 'Banned' : 'Ban Server'}
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
            <h3>No Servers Connected</h3>
            <p>Servers will appear here automatically when they start with the Nexora plugin.</p>
          </div>
        )}
      </div>
    </>
  );

  // 3. Server Plugins (Specific user requirement!)
  const renderPlugins = () => {
    // Filter plugins by search
    const searchLower = pluginSearch.toLowerCase().trim();

    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Server Plugins Detected</h1>
            <p className="page-desc">List of all plugins running on connected Minecraft servers.</p>
          </div>
          <div style={{ minWidth: '260px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="🔍 Filter plugins by name..."
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
                    {pluginList.length} Plugin{pluginList.length !== 1 ? 's' : ''} Installed
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
                        : 'No plugin telemetry reported yet. Ensure server heartbeat sends plugin list.'}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="glass-panel empty-state">
            <div className="empty-state-icon">🔌</div>
            <h3>No Servers Online to Report Plugins</h3>
            <p>Connect your Minecraft server to inspect its installed plugin list.</p>
          </div>
        )}
      </>
    );
  };

  // 4. Registered Users
  const renderUsers = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Registered Users</h1>
          <p className="page-desc">All user accounts registered and stored in Supabase PostgreSQL.</p>
        </div>
        <div className="badge badge-blue">
          {users.length} Registered Account{users.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="glass-panel">
        {users.length > 0 ? (
          <div className="table-container">
            <table className="nexora-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>License Key</th>
                  <th>Role</th>
                  <th>Registered At</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700 }}>
                      <span className="player-cell">
                        <span style={{
                          width: '24px', height: '24px', borderRadius: '6px',
                          background: u.role === 'ADMIN' ? 'var(--primary)' : '#1e2533',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 800
                        }}>
                          {u.username.charAt(0).toUpperCase()}
                        </span>
                        {u.username}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      <span
                        onClick={() => copyToClipboard(u.licenseKey)}
                        style={{ cursor: 'pointer', color: 'var(--blue)' }}
                        title="Click to copy"
                      >
                        {u.licenseKey}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : 'badge-green'}`}>
                        {u.role || 'USER'}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(u.createdAt)}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(u.lastLogin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No user accounts have registered yet.</p>
          </div>
        )}
      </div>
    </>
  );

  // 5. License Keys
  const renderLicenses = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">License Keys Authority</h1>
          <p className="page-desc">Issue, monitor, and revoke buyer server licenses.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowKeyGen(true)}>
          ⚡ + Generate New License
        </button>
      </div>

      {actionAlert && (
        <div className={`alert alert-${actionAlert.type}`}>{actionAlert.text}</div>
      )}

      <div className="glass-panel">
        {licenses.length > 0 ? (
          <div className="table-container">
            <table className="nexora-table">
              <thead>
                <tr>
                  <th>License Key</th>
                  <th>Buyer / Owner</th>
                  <th>Tier</th>
                  <th>Bound IP</th>
                  <th>Max Hosts</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic) => {
                  const isBanned = lic.status === 'BANNED';
                  return (
                    <tr key={lic.key}>
                      <td className="mono" style={{ fontWeight: 700, fontSize: '12px' }}>
                        <span
                          onClick={() => copyToClipboard(lic.key)}
                          style={{ cursor: 'pointer', color: '#fff' }}
                          title="Click to copy key"
                        >
                          📋 {lic.key}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{lic.owner}</div>
                        {lic.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lic.email}</div>}
                      </td>
                      <td>
                        <span className="badge badge-red">{lic.tier}</span>
                      </td>
                      <td className="mono" style={{ fontSize: '12px' }}>
                        {lic.boundIp || <span style={{ color: 'var(--text-dim)' }}>Unbound</span>}
                      </td>
                      <td className="mono">{lic.maxServers || 1}</td>
                      <td>
                        <span className={`badge ${isBanned ? 'badge-danger' : 'badge-green'}`}>
                          {lic.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleResetIp(lic.key)}
                            title="Clear IP binding"
                          >
                            Reset IP
                          </button>
                          <button
                            className={`btn btn-sm ${isBanned ? 'btn-success' : 'btn-danger'}`}
                            onClick={() => handleToggleLicenseStatus(lic.key)}
                          >
                            {isBanned ? 'Unban' : 'Ban'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🔑</div>
            <h3>No Licenses Issued</h3>
            <p>Click "Generate New License" to issue your first buyer license.</p>
          </div>
        )}
      </div>

      <KeyGeneratorModal
        isOpen={showKeyGen}
        onClose={() => setShowKeyGen(false)}
        onCreated={() => fetchData()}
      />
    </>
  );

  // 6. Violation Logs
  const renderViolations = () => (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Global Violation Logs</h1>
          <p className="page-desc">Every detection event flagged across all servers in the fleet.</p>
        </div>
        <div className="badge badge-yellow">
          {violations.length} Total Incidents
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
                    <td>{v.serverName}</td>
                    <td>
                      <span className="badge badge-warning">{v.checkId}</span>
                    </td>
                    <td className="mono" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                      +{Math.round(v.vl)}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{v.details}</td>
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
            <p>No cheat violations recorded across the fleet.</p>
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
          <h1 className="page-title">Global Player Bans</h1>
          <p className="page-desc">Every player ban issued across all Minecraft servers.</p>
        </div>
        <div className="badge badge-red">
          {playerBans.length} Ban{playerBans.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="glass-panel">
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
                  <th>IP Ban</th>
                  <th>Date</th>
                  <th>Status</th>
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
                    <td>{b.serverName || 'Server'}</td>
                    <td>{b.reason}</td>
                    <td>
                      <span className="badge badge-gray">{b.duration}</span>
                    </td>
                    <td>{b.bannedBy || 'Admin'}</td>
                    <td>
                      <span className={`badge ${b.ipBanned ? 'badge-danger' : 'badge-gray'}`}>
                        {b.ipBanned ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {formatDate(b.bannedAt)}
                    </td>
                    <td>
                      <span className={`badge ${b.status === 'ACTIVE' ? 'badge-danger' : 'badge-green'}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No player bans recorded across the fleet.</p>
          </div>
        )}
      </div>
    </>
  );

  const pages = {
    overview: renderOverview,
    servers: renderServerFleet,
    plugins: renderPlugins,
    users: renderUsers,
    licenses: renderLicenses,
    violations: renderViolations,
    bans: renderPlayerBans,
  };

  return (
    <div className="app-layout">
      {/* Admin Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon-box">🛡️</div>
          <div className="brand-text-box">
            <div className="brand-title">NEXORA<span>ADMIN</span></div>
            <div className="brand-subtitle">Fleet Controller</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Fleet Administration</div>
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
              <div className="sidebar-username">{user?.username || 'Administrator'}</div>
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
