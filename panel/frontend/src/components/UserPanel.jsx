import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';

export default function UserPanel() {
  const [licenseKeyInput, setLicenseKeyInput] = useState('NX-DEMO-2026-KEY1');
  const [activeSession, setActiveSession] = useState(null);
  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  useEffect(() => {
    // If there's an active session, poll every 10 seconds
    if (!activeSession) return;
    loadPortalData(activeSession);
    const interval = setInterval(() => loadPortalData(activeSession), 10000);
    return () => clearInterval(interval);
  }, [activeSession]);

  async function handleLogin(e) {
    if (e) e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setLoading(true);
    setError('');
    setResetMsg('');

    try {
      const res = await fetch(`${API_BASE}/api/user/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: licenseKeyInput.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        setActiveSession(licenseKeyInput.trim());
        setPortalData(data);
      } else {
        setError(data.error || 'Invalid license key.');
      }
    } catch (err) {
      setError('Cannot connect to panel backend. Make sure the panel server is running.');
    } finally {
      setLoading(false);
    }
  }

  async function loadPortalData(key) {
    try {
      const res = await fetch(`${API_BASE}/api/user/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      if (res.ok) {
        const data = await res.json();
        setPortalData(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleResetIp() {
    if (!confirm('Are you migrating your Minecraft server to a new IP or host? Click OK to reset binding.')) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/reset-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: activeSession })
      });
      const data = await res.json();
      if (res.ok) {
        setResetMsg(data.message);
        loadPortalData(activeSession);
      } else {
        setError(data.error || 'Failed to reset IP.');
      }
    } catch (e) {
      setError('Network error while resetting IP.');
    } finally {
      setLoading(false);
    }
  }

  // Not logged in view
  if (!activeSession || !portalData) {
    return (
      <div style={{ maxWidth: '480px', margin: '40px auto' }}>
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>👤</div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#ff0000' }}>
              Buyer & Server Owner Portal
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
              Enter your Nexora License Key to monitor your server telemetry, violation history, and manage IP host bindings.
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
                YOUR NEXORA LICENSE KEY
              </label>
              <input
                type="text"
                className="input-dark mono"
                style={{ fontSize: '15px', fontWeight: '600', letterSpacing: '0.05em' }}
                placeholder="NX-XXXX-XXXX-XXXX"
                value={licenseKeyInput}
                onChange={e => setLicenseKeyInput(e.target.value)}
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                Hint: Use default demo key <strong style={{ color: '#ff0000' }}>NX-DEMO-2026-KEY1</strong> to test!
              </span>
            </div>

            <button type="submit" className="btn-red" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
              {loading ? 'Authenticating...' : '🚀 Access Buyer Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { license, server, violations } = portalData;

  return (
    <div>
      {/* Buyer Header Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff' }}>
              Welcome back, <span style={{ color: '#ff0000' }}>{license.owner}</span>
            </h2>
            {license.status === 'ACTIVE' ? (
              <span className="badge-active">LICENSE ACTIVE</span>
            ) : (
              <span className="badge-banned">{license.status}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span>Key: <strong className="mono" style={{ color: '#ffffff' }}>{license.key}</strong></span>
            <span>Tier: <strong style={{ color: '#ffffff' }}>{license.tier}</strong></span>
            <span>Expires: <strong style={{ color: '#ffffff' }}>{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : 'Lifetime'}</strong></span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleResetIp} className="btn-secondary" title="Clears bound IP so you can migrate to a new server">
            🔄 Reset Server IP Binding
          </button>
          <button onClick={() => { setActiveSession(null); setPortalData(null); }} className="btn-secondary">
            Log Out
          </button>
        </div>
      </div>

      {resetMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '20px'
        }}>
          ✓ {resetMsg}
        </div>
      )}

      {/* Grid: Server Telemetry + Plugin Config Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Card 1: Bound Server Live Status */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>
              🖥️ Bound Minecraft Server
            </h3>
            {server && server.isOnline ? (
              <span className="badge-online">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
                ONLINE
              </span>
            ) : (
              <span className="badge-offline">OFFLINE</span>
            )}
          </div>

          {server ? (
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#ff0000', marginBottom: '4px' }}>
                {server.serverName}
              </div>
              <div className="mono" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                IP: {server.ip}:{server.port}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#181d27', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Online Players</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                    {server.onlinePlayers}
                  </div>
                </div>

                <div style={{ background: '#181d27', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Server TPS</div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: server.tps >= 19.0 ? '#10b981' : server.tps >= 16.0 ? '#f59e0b' : '#ef4444',
                    marginTop: '2px'
                  }}>
                    {server.tps ? server.tps.toFixed(1) : '20.0'}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Platform: <span style={{ color: '#ffffff' }}>{server.mcVersion}</span> • Nexora v{server.pluginVersion}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No server has connected with this key yet.<br />
              Paste this key in your server's <code style={{ color: '#ff0000' }}>config.yml</code> and start Paper!
            </div>
          )}
        </div>

        {/* Card 2: Server config.yml Snippet */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>
            ⚙️ Server Configuration Snippet
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Paste this snippet into your server's <code style={{ color: '#ff0000' }}>plugins/NexoraAntiCheat/config.yml</code>:
          </p>

          <pre className="mono" style={{
            background: '#0a0c10',
            border: '1px solid var(--border)',
            padding: '14px',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#38bdf8',
            overflowX: 'auto'
          }}>
{`license:
  enabled: true
  key: "${license.key}"
  server-name: "${server ? server.serverName : 'My Minecraft Server'}"
  api-url: "${typeof window !== 'undefined' ? window.location.origin : 'https://your-panel.onrender.com'}"
  heartbeat-interval-seconds: 60`}
          </pre>
        </div>
      </div>

      {/* Recent Violation Logs Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>
            🛡️ Live Telemetry & AntiCheat Violations Log
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Auto-synced from your server
          </span>
        </div>

        <table className="nexora-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Player</th>
              <th>Check Flagged</th>
              <th>VL (Severity)</th>
              <th>Detection Details</th>
            </tr>
          </thead>
          <tbody>
            {violations.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No cheat violations detected on your server recently. Clean gameplay!
                </td>
              </tr>
            ) : (
              violations.map(viol => (
                <tr key={viol.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {new Date(viol.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ fontWeight: '700', color: '#ffffff' }}>
                    {viol.playerName}
                  </td>
                  <td>
                    <span style={{ color: '#f59e0b', fontWeight: '600' }}>
                      {viol.checkId}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: '#ef4444', fontWeight: '700' }}>
                      VL {viol.vl}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {viol.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
