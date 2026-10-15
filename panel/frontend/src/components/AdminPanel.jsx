import React, { useState, useEffect } from 'react';
import KeyGeneratorModal from './KeyGeneratorModal';
import { API_BASE } from '../apiConfig';

export default function AdminPanel() {
  const [stats, setStats] = useState({
    totalServersHosted: 0,
    activeServersOnline: 0,
    totalLicenses: 0,
    bannedLicenses: 0,
    totalUsers: 0,
    totalPlayerBans: 0,
    totalViolations: 0
  });

  const [servers, setServers] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('servers'); // 'servers', 'users', 'licenses'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 8000); // Live poll every 8s
    return () => clearInterval(timer);
  }, []);

  async function fetchData() {
    try {
      const [statsRes, serversRes, licensesRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`),
        fetch(`${API_BASE}/api/admin/servers`),
        fetch(`${API_BASE}/api/admin/licenses`),
        fetch(`${API_BASE}/api/admin/users`)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (serversRes.ok) setServers(await serversRes.json());
      if (licensesRes.ok) setLicenses(await licensesRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleBanServer(serverId, serverName) {
    const reason = prompt(`Enter ban reason for server "${serverName}":`, 'Terms of Service violation / Chargeback');
    if (reason === null) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/servers/${serverId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        alert(`Server "${serverName}" and its license key have been banned.`);
        fetchData();
      }
    } catch (e) {
      alert('Failed to ban server.');
    }
  }

  async function handleToggleLicenseStatus(key, currentStatus) {
    const newStatus = currentStatus === 'BANNED' ? 'ACTIVE' : 'BANNED';
    let reason = null;
    if (newStatus === 'BANNED') {
      reason = prompt('Enter ban reason for this license key:', 'Unauthorized redistribution or chargeback');
      if (reason === null) return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/licenses/${encodeURIComponent(key)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, reason })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      alert('Failed to update license status.');
    }
  }

  async function handleResetIp(key) {
    if (!confirm(`Reset bound IP for key ${key}? The user will be able to bind from a new server IP.`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/licenses/${encodeURIComponent(key)}/reset-ip`, {
        method: 'POST'
      });
      if (res.ok) {
        alert('Server IP binding has been reset.');
        fetchData();
      }
    } catch (e) {
      alert('Failed to reset IP.');
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  return (
    <div>
      {/* Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div className="glass-panel stat-card">
          <div style={{ fontSize: '13px', color: '#8b94a5', marginBottom: '6px' }}>Total Servers Hosted</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#ffffff' }}>
            {stats.totalServersHosted}
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
            {stats.activeServersOnline} online now
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div style={{ fontSize: '13px', color: '#8b94a5', marginBottom: '6px' }}>Registered Users</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#38bdf8' }}>
            {stats.totalUsers}
          </div>
          <div style={{ fontSize: '12px', color: '#8b94a5', marginTop: '4px' }}>
            Synced in Supabase
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div style={{ fontSize: '13px', color: '#8b94a5', marginBottom: '6px' }}>Active Player Bans</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#ff4444' }}>
            {stats.totalPlayerBans}
          </div>
          <div style={{ fontSize: '12px', color: '#8b94a5', marginTop: '4px' }}>
            Controlled by users
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div style={{ fontSize: '13px', color: '#8b94a5', marginBottom: '6px' }}>Issued Licenses</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#f59e0b' }}>
            {stats.totalLicenses}
          </div>
          <div style={{ fontSize: '12px', color: stats.bannedLicenses > 0 ? '#ef4444' : '#8b94a5', marginTop: '4px' }}>
            {stats.bannedLicenses} banned
          </div>
        </div>
      </div>

      {/* Tabs and Actions Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '18px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('servers')}
            className={`btn ${activeTab === 'servers' ? 'btn-primary' : 'btn-secondary'}`}
          >
            🖥️ Connected Servers ({servers.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          >
            👥 Registered Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            className={`btn ${activeTab === 'licenses' ? 'btn-primary' : 'btn-secondary'}`}
          >
            🔑 License Keys ({licenses.length})
          </button>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
        >
          ➕ Generate New License
        </button>
      </div>

      {/* TAB 1: CONNECTED SERVERS */}
      {activeTab === 'servers' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          {servers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8b94a5' }}>
              No Minecraft servers have connected yet. Run the plugin on a server with a valid license key.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: '#8b94a5' }}>
                    <th style={{ padding: '14px 18px' }}>Server Name</th>
                    <th style={{ padding: '14px 18px' }}>Host IP : Port</th>
                    <th style={{ padding: '14px 18px' }}>License Key</th>
                    <th style={{ padding: '14px 18px' }}>TPS</th>
                    <th style={{ padding: '14px 18px' }}>Players</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {servers.map(server => (
                    <tr key={server.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: '600', color: '#ffffff' }}>
                        {server.serverName}
                        <div style={{ fontSize: '11px', color: '#8b94a5' }}>{server.mcVersion}</div>
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#38bdf8' }}>
                        {server.ip}:{server.port}
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#8b94a5' }}>
                        {server.licenseKey}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: '700', color: server.tps >= 19.5 ? '#10b981' : '#f59e0b' }}>
                        {server.tps}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#ffffff' }}>
                        {server.onlinePlayers}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className={`badge ${server.status === 'BANNED' ? 'badge-offline' : (server.isOnline ? 'badge-online' : 'badge-offline')}`}>
                          {server.status === 'BANNED' ? 'BANNED' : (server.isOnline ? 'ONLINE' : 'OFFLINE')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        {server.status !== 'BANNED' ? (
                          <button
                            onClick={() => handleBanServer(server.id, server.serverName)}
                            className="btn btn-secondary"
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', padding: '6px 12px', fontSize: '12px' }}
                          >
                            Ban Server
                          </button>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>REVOKED</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REGISTERED USERS (FROM SUPABASE) */}
      {activeTab === 'users' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          {users.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8b94a5' }}>
              No users registered in Supabase yet. Users register through the Client Portal.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: '#8b94a5' }}>
                    <th style={{ padding: '14px 18px' }}>Username</th>
                    <th style={{ padding: '14px 18px' }}>Bound License Key</th>
                    <th style={{ padding: '14px 18px' }}>Role</th>
                    <th style={{ padding: '14px 18px' }}>Registered At</th>
                    <th style={{ padding: '14px 18px' }}>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '14px 18px', fontWeight: '700', color: '#ffffff' }}>
                        👤 {u.username}
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: '#38bdf8' }}>
                        {u.licenseKey}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="badge badge-pending" style={{ fontSize: '11px' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#8b94a5' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#8b94a5' }}>
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ISSUED LICENSES */}
      {activeTab === 'licenses' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          {licenses.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8b94a5' }}>
              No licenses created yet. Click "Generate New License" above to create one.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: '#8b94a5' }}>
                    <th style={{ padding: '14px 18px' }}>License Key</th>
                    <th style={{ padding: '14px 18px' }}>Owner</th>
                    <th style={{ padding: '14px 18px' }}>Tier</th>
                    <th style={{ padding: '14px 18px' }}>Bound IP</th>
                    <th style={{ padding: '14px 18px' }}>Status</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map(lic => (
                    <tr key={lic.key} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: '700', color: '#ffffff' }}>
                        {lic.key}
                        <button
                          onClick={() => copyToClipboard(lic.key)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            marginLeft: '8px',
                            color: copiedKey === lic.key ? '#10b981' : '#8b94a5'
                          }}
                          title="Copy Key"
                        >
                          {copiedKey === lic.key ? '✓' : '📋'}
                        </button>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#c9d1d9' }}>
                        {lic.owner}
                        {lic.email && <div style={{ fontSize: '11px', color: '#8b94a5' }}>{lic.email}</div>}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ fontWeight: '600', color: '#ff4444' }}>{lic.tier}</span>
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: lic.boundIp ? '#38bdf8' : '#8b94a5' }}>
                        {lic.boundIp || 'Unbound'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className={`badge ${lic.status === 'ACTIVE' ? 'badge-online' : 'badge-offline'}`}>
                          {lic.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleResetIp(lic.key)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Reset IP lock"
                          >
                            Reset IP
                          </button>
                          <button
                            onClick={() => handleToggleLicenseStatus(lic.key, lic.status)}
                            className="btn btn-secondary"
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              color: lic.status === 'ACTIVE' ? '#ef4444' : '#10b981',
                              borderColor: lic.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'
                            }}
                          >
                            {lic.status === 'ACTIVE' ? 'Ban' : 'Unban'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* License Key Generator Modal */}
      <KeyGeneratorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => fetchData()}
      />
    </div>
  );
}
