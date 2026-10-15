import React, { useState, useEffect } from 'react';
import KeyGeneratorModal from './KeyGeneratorModal';
import { API_BASE } from '../apiConfig';

export default function AdminPanel() {
  const [stats, setStats] = useState({
    totalServersHosted: 0,
    activeServersOnline: 0,
    totalLicenses: 0,
    bannedLicenses: 0,
    totalViolations: 0
  });

  const [servers, setServers] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [activeTab, setActiveTab] = useState('servers'); // 'servers' or 'licenses'
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
      const [statsRes, serversRes, licensesRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`),
        fetch(`${API_BASE}/api/admin/servers`),
        fetch(`${API_BASE}/api/admin/licenses`)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (serversRes.ok) setServers(await serversRes.json());
      if (licensesRes.ok) setLicenses(await licensesRes.json());
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

  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  return (
    <div>
      {/* Top Banner Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            🖥️ Servers Hosted
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '6px', color: '#ffffff' }}>
            {stats.totalServersHosted}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--green)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
            {stats.activeServersOnline} Online Right Now
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            🔑 Total Licenses Issued
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '6px', color: '#ff0000' }}>
            {stats.totalLicenses}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Single-host verified keys
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            🚫 Banned / Suspended Keys
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '6px', color: stats.bannedLicenses > 0 ? '#ef4444' : '#10b981' }}>
            {stats.bannedLicenses}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Plugins auto-disable on remote hosts
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            🛡️ Violations Intercepted
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '6px', color: '#f59e0b' }}>
            {stats.totalViolations}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Synchronized telemetry
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('servers')}
            style={{
              background: activeTab === 'servers' ? 'rgba(255, 0, 0, 0.15)' : 'transparent',
              color: activeTab === 'servers' ? '#ff0000' : 'var(--text-muted)',
              border: `1px solid ${activeTab === 'servers' ? '#ff0000' : 'var(--border)'}`,
              padding: '8px 18px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🖥️ Active Minecraft Servers ({servers.length})
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            style={{
              background: activeTab === 'licenses' ? 'rgba(255, 0, 0, 0.15)' : 'transparent',
              color: activeTab === 'licenses' ? '#ff0000' : 'var(--text-muted)',
              border: `1px solid ${activeTab === 'licenses' ? '#ff0000' : 'var(--border)'}`,
              padding: '8px 18px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔑 License Keys ({licenses.length})
          </button>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn-red">
          <span>+</span> Generate New Key
        </button>
      </div>

      {/* View 1: Active Servers Fleet */}
      {activeTab === 'servers' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table className="nexora-table">
            <thead>
              <tr>
                <th>Server Name</th>
                <th>Host IP & Port</th>
                <th>Minecraft / Platform</th>
                <th>Online Players</th>
                <th>TPS</th>
                <th>Status</th>
                <th>Last Ping</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No Minecraft servers connected yet. Start a server with a valid license key to appear here!
                  </td>
                </tr>
              ) : (
                servers.map(server => (
                  <tr key={server.id}>
                    <td>
                      <div style={{ fontWeight: '600', color: '#ffffff' }}>{server.serverName}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Key: {server.licenseKey}
                      </div>
                    </td>
                    <td>
                      <span className="mono" style={{ background: '#181d27', padding: '3px 7px', borderRadius: '4px', fontSize: '12px' }}>
                        {server.ip}:{server.port}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px' }}>{server.mcVersion}</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>v{server.pluginVersion}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', color: '#38bdf8' }}>
                        👤 {server.onlinePlayers}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: '700',
                        color: server.tps >= 19.0 ? '#10b981' : server.tps >= 16.0 ? '#f59e0b' : '#ef4444'
                      }}>
                        {server.tps ? server.tps.toFixed(1) : '20.0'}
                      </span>
                    </td>
                    <td>
                      {server.status === 'BANNED' ? (
                        <span className="badge-banned">BANNED</span>
                      ) : server.isOnline ? (
                        <span className="badge-online">
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
                          ONLINE
                        </span>
                      ) : (
                        <span className="badge-offline">OFFLINE</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {formatTimeAgo(server.lastHeartbeat)}
                    </td>
                    <td>
                      {server.status !== 'BANNED' ? (
                        <button
                          onClick={() => handleBanServer(server.id, server.serverName)}
                          className="btn-danger-outline"
                          title="Instantly disables the plugin on this server and bans the license key"
                        >
                          🚫 Ban Server
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>Banned</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View 2: License Keys Management */}
      {activeTab === 'licenses' && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table className="nexora-table">
            <thead>
              <tr>
                <th>License Key</th>
                <th>Owner / Buyer</th>
                <th>Bound Server IP</th>
                <th>Tier</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map(lic => (
                <tr key={lic.key}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mono" style={{ fontWeight: '700', color: '#ff0000', fontSize: '13px' }}>
                        {lic.key}
                      </span>
                      <button
                        onClick={() => copyToClipboard(lic.key)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: copiedKey === lic.key ? '#10b981' : 'var(--text-muted)',
                          fontSize: '12px'
                        }}
                        title="Copy license key to clipboard"
                      >
                        {copiedKey === lic.key ? '✓ Copied!' : '📋'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{lic.owner}</div>
                    {lic.email && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{lic.email}</div>}
                  </td>
                  <td>
                    {lic.boundIp ? (
                      <span className="mono" style={{ background: '#181d27', padding: '3px 7px', borderRadius: '4px', fontSize: '12px', color: '#38bdf8' }}>
                        🔒 {lic.boundIp}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--green)', fontStyle: 'italic' }}>
                        Unbound (Ready for first host)
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>{lic.tier}</span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString() : 'Permanent (Lifetime)'}
                  </td>
                  <td>
                    {lic.status === 'ACTIVE' ? (
                      <span className="badge-active">ACTIVE</span>
                    ) : (
                      <span className="badge-banned" title={lic.banReason || 'Banned'}>
                        {lic.status}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleToggleLicenseStatus(lic.key, lic.status)}
                        className="btn-secondary"
                        style={{
                          fontSize: '12px',
                          padding: '4px 10px',
                          color: lic.status === 'ACTIVE' ? '#ef4444' : '#10b981'
                        }}
                      >
                        {lic.status === 'ACTIVE' ? 'Ban' : 'Unban'}
                      </button>

                      {lic.boundIp && (
                        <button
                          onClick={() => handleResetIp(lic.key)}
                          className="btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                          title="Unbind IP address so buyer can move hosting"
                        >
                          Reset IP
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for key generation */}
      <KeyGeneratorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={newLicense => {
          fetchData();
        }}
      />
    </div>
  );
}
