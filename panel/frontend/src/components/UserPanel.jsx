import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';

export default function UserPanel() {
  // Authentication states
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');

  // Active session
  const [userSession, setUserSession] = useState(() => {
    try {
      const saved = localStorage.getItem('nexora_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [portalData, setPortalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Ban Player Form States
  const [banPlayerName, setBanPlayerName] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('PERMANENT');
  const [banIp, setBanIp] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [banMsg, setBanMsg] = useState('');

  // Auto-load portal data when session exists
  useEffect(() => {
    if (!userSession) return;
    loadPortalData();
    const interval = setInterval(loadPortalData, 10000);
    return () => clearInterval(interval);
  }, [userSession]);

  async function loadPortalData() {
    if (!userSession?.licenseKey) return;
    try {
      const res = await fetch(`${API_BASE}/api/user/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: userSession.licenseKey,
          username: userSession.username
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPortalData(data);
      }
    } catch (e) {
      console.error('Error fetching portal data:', e);
    }
  }

  // Handle Login
  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!username.trim() || !password || !licenseKey.trim()) {
      setError('Please fill in Username, Password, and License Key.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          licenseKey: licenseKey.trim().toUpperCase()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUserSession(data.user);
        localStorage.setItem('nexora_user_session', JSON.stringify(data.user));
        setError('');
      } else {
        setError(data.error || 'Login failed. Please check credentials.');
      }
    } catch (err) {
      setError('Cannot connect to panel backend. Ensure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  // Handle Signup
  async function handleSignup(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!username.trim() || !password || !confirmPassword || !licenseKey.trim()) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          confirmPassword,
          licenseKey: licenseKey.trim().toUpperCase()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Account registered successfully! You can now log in.');
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Registration failed.');
      }
    } catch (err) {
      setError('Cannot connect to panel backend. Ensure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  // Handle Logout
  function handleLogout() {
    setUserSession(null);
    setPortalData(null);
    localStorage.removeItem('nexora_user_session');
  }

  // User bans a player on their server
  async function handleBanPlayer(e) {
    e.preventDefault();
    if (!banPlayerName.trim()) return;

    setBanLoading(true);
    setBanMsg('');

    try {
      const res = await fetch(`${API_BASE}/api/user/players/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: userSession.licenseKey,
          username: userSession.username,
          playerName: banPlayerName.trim(),
          reason: banReason.trim(),
          duration: banDuration,
          ipBanned: banIp
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBanMsg(`✅ ${data.message}`);
        setBanPlayerName('');
        setBanReason('');
        loadPortalData();
      } else {
        setBanMsg(`❌ ${data.error || 'Failed to ban player.'}`);
      }
    } catch {
      setBanMsg('❌ Error connecting to server.');
    } finally {
      setBanLoading(false);
    }
  }

  // User unbans a player
  async function handleUnbanPlayer(banId, pName) {
    if (!confirm(`Are you sure you want to unban "${pName}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/user/players/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey: userSession.licenseKey,
          banId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        loadPortalData();
      } else {
        alert(data.error || 'Failed to unban player.');
      }
    } catch {
      alert('Error connecting to backend.');
    }
  }

  // User resets their IP binding
  async function handleResetIp() {
    if (!confirm('Are you migrating your Minecraft server to a new IP or host? Click OK to reset binding.')) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/reset-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: userSession.licenseKey })
      });
      const data = await res.json();
      if (res.ok) {
        setResetMsg(data.message);
        loadPortalData();
      } else {
        setError(data.error || 'Failed to reset IP binding.');
      }
    } catch {
      setError('Failed to contact backend server.');
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // VIEW 1: AUTHENTICATION FORM (LOGIN / SIGNUP)
  // -------------------------------------------------------------
  if (!userSession) {
    return (
      <div style={{ maxWidth: '480px', margin: '40px auto 0' }}>
        <div className="glass-panel" style={{ padding: '32px 28px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              padding: '12px',
              borderRadius: '14px',
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.25)',
              marginBottom: '12px'
            }}>
              <span style={{ fontSize: '28px' }}>🛡️</span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.5px' }}>
              Nexora Client Portal
            </h2>
            <p style={{ fontSize: '13px', color: '#8b94a5', marginTop: '6px' }}>
              Sign in with your license key to manage server protections & player bans
            </p>
          </div>

          {/* Tab Selector: Login vs Sign Up */}
          <div style={{
            display: 'flex',
            background: '#0d1017',
            padding: '4px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid var(--border)'
          }}>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setError(''); setSuccessMsg(''); }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                background: authMode === 'login' ? 'var(--primary)' : 'transparent',
                color: authMode === 'login' ? '#ffffff' : '#8b94a5',
                transition: 'all 0.15s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setError(''); setSuccessMsg(''); }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                background: authMode === 'signup' ? 'var(--primary)' : 'transparent',
                color: authMode === 'signup' ? '#ffffff' : '#8b94a5',
                transition: 'all 0.15s ease'
              }}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#6ee7b7',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {successMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={authMode === 'login' ? handleLogin : handleSignup}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#c9d1d9', marginBottom: '6px' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: '#0a0c10',
                  border: '1px solid var(--border)',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#c9d1d9', marginBottom: '6px' }}>
                License Key
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="NX-XXXX-XXXX-XXXX"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: '#0a0c10',
                  border: '1px solid var(--border)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  letterSpacing: '1px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#c9d1d9', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  background: '#0a0c10',
                  border: '1px solid var(--border)',
                  color: '#ffffff',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {authMode === 'signup' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#c9d1d9', marginBottom: '6px' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    background: '#0a0c10',
                    border: '1px solid var(--border)',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px 0',
                fontSize: '14px',
                fontWeight: '700',
                marginTop: '10px'
              }}
            >
              {loading ? 'Please wait...' : authMode === 'login' ? '🔐 Log In' : '✨ Register Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: LOGGED-IN BUYER DASHBOARD & BAN PLAYER CONTROL
  // -------------------------------------------------------------
  const license = portalData?.license;
  const server = portalData?.server;
  const violations = portalData?.violations || [];
  const playerBans = portalData?.playerBans || [];

  return (
    <div>
      {/* Top Session Bar */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff0000 0%, #aa0000 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px'
          }}>
            👤
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
              Welcome back, <span style={{ color: '#ff4444' }}>{userSession.username}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#8b94a5', fontFamily: 'monospace' }}>
              License: <span style={{ color: '#c9d1d9' }}>{userSession.licenseKey}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{ padding: '8px 14px', fontSize: '12px' }}
        >
          🚪 Sign Out
        </button>
      </div>

      {resetMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10b981',
          color: '#6ee7b7',
          fontSize: '13px',
          marginBottom: '20px'
        }}>
          {resetMsg}
        </div>
      )}

      {/* Grid: Server Status & IP Reset */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {/* Bound Server Stats */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
              🖥️ Bound Minecraft Server
            </h3>
            {server ? (
              <span className={`badge ${server.isOnline ? 'badge-online' : 'badge-offline'}`}>
                {server.isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            ) : (
              <span className="badge badge-pending">NOT CONNECTED</span>
            )}
          </div>

          {server ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b94a5' }}>Server Name:</span>
                <span style={{ fontWeight: '600', color: '#ffffff' }}>{server.serverName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b94a5' }}>Host IP & Port:</span>
                <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{server.ip}:{server.port}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b94a5' }}>Engine Version:</span>
                <span style={{ color: '#c9d1d9' }}>{server.mcVersion}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b94a5' }}>Online Players:</span>
                <span style={{ fontWeight: '700', color: '#10b981' }}>{server.onlinePlayers} players</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8b94a5' }}>Server TPS:</span>
                <span style={{ fontWeight: '700', color: server.tps >= 19 ? '#10b981' : '#f59e0b' }}>
                  {server.tps} TPS
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#8b94a5', fontSize: '13px', lineHeight: '1.6' }}>
              No Minecraft server has connected with this license yet. Install Nexora AntiCheat on your server and enter your key in <code>config.yml</code>.
            </div>
          )}
        </div>

        {/* License & IP Binding Migration */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginBottom: '14px' }}>
            🔒 License & Hardware Binding
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8b94a5' }}>Subscription Tier:</span>
              <span style={{ fontWeight: '700', color: '#ff4444' }}>{license?.tier || 'LIFETIME'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8b94a5' }}>License Status:</span>
              <span className={`badge ${license?.status === 'ACTIVE' ? 'badge-online' : 'badge-offline'}`}>
                {license?.status || 'ACTIVE'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#8b94a5' }}>Bound Host IP:</span>
              <span style={{ fontFamily: 'monospace', color: license?.boundIp ? '#38bdf8' : '#8b94a5' }}>
                {license?.boundIp || 'Unbound (Ready to lock)'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: '12px', color: '#8b94a5', marginBottom: '10px' }}>
              Moving to a new hosting provider or VPS? Reset your IP binding before starting from your new server:
            </p>
            <button
              onClick={handleResetIp}
              disabled={loading}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '13px' }}
            >
              🔄 Reset Server IP Binding
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: PLAYER BAN MANAGEMENT */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#ffffff' }}>
              🔨 Player Ban Control & History
            </h3>
            <p style={{ fontSize: '13px', color: '#8b94a5', marginTop: '4px' }}>
              Remotely ban cheaters and rule-breakers on your Minecraft server
            </p>
          </div>
          <span style={{ fontSize: '13px', color: '#8b94a5', background: '#0a0c10', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
            Active Bans: <strong style={{ color: '#ff4444' }}>{playerBans.filter(b => b.status === 'ACTIVE').length}</strong>
          </span>
        </div>

        {/* Ban Form */}
        <form onSubmit={handleBanPlayer} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          background: '#0a0c10',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#8b94a5', marginBottom: '4px' }}>
              Player Name
            </label>
            <input
              type="text"
              value={banPlayerName}
              onChange={e => setBanPlayerName(e.target.value)}
              placeholder="e.g. BadCheater"
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                background: '#12151d',
                border: '1px solid var(--border)',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#8b94a5', marginBottom: '4px' }}>
              Ban Reason
            </label>
            <input
              type="text"
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              placeholder="e.g. KillAura / Speed Cheating"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                background: '#12151d',
                border: '1px solid var(--border)',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#8b94a5', marginBottom: '4px' }}>
              Duration
            </label>
            <select
              value={banDuration}
              onChange={e => setBanDuration(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                background: '#12151d',
                border: '1px solid var(--border)',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="PERMANENT">Permanent Ban</option>
              <option value="30_DAYS">30 Days</option>
              <option value="7_DAYS">7 Days</option>
              <option value="24_HOURS">24 Hours</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#c9d1d9', marginTop: '16px' }}>
              <input
                type="checkbox"
                checked={banIp}
                onChange={e => setBanIp(e.target.checked)}
                style={{ accentColor: '#ff0000', cursor: 'pointer' }}
              />
              Also Ban Player IP
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              disabled={banLoading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px 0', fontSize: '13px', fontWeight: '700' }}
            >
              {banLoading ? 'Executing...' : '🔨 Ban Player'}
            </button>
          </div>
        </form>

        {banMsg && (
          <div style={{
            fontSize: '13px',
            marginBottom: '16px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: '#0d1017'
          }}>
            {banMsg}
          </div>
        )}

        {/* Banned Players Table */}
        {playerBans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#8b94a5', fontSize: '13px' }}>
            No players currently banned on this server.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#8b94a5', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px' }}>Player</th>
                  <th style={{ padding: '10px 12px' }}>Reason</th>
                  <th style={{ padding: '10px 12px' }}>Duration</th>
                  <th style={{ padding: '10px 12px' }}>IP Ban</th>
                  <th style={{ padding: '10px 12px' }}>Banned By</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {playerBans.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#ffffff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={`https://mc-heads.net/avatar/${encodeURIComponent(b.playerName)}/20`}
                          alt=""
                          style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        {b.playerName}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#c9d1d9' }}>{b.reason}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#f59e0b' }}>{b.duration}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {b.ipBanned ? (
                        <span className="badge badge-offline" style={{ fontSize: '10px' }}>IP BANNED</span>
                      ) : (
                        <span style={{ color: '#8b94a5' }}>No</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#8b94a5' }}>{b.bannedBy}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${b.status === 'ACTIVE' ? 'badge-offline' : 'badge-online'}`} style={{ fontSize: '11px' }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {b.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleUnbanPlayer(b.id, b.playerName)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          Pardon / Unban
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION: VIOLATION HISTORY LOG */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#ffffff' }}>
              🛡️ Live Cheat Violation History
            </h3>
            <p style={{ fontSize: '13px', color: '#8b94a5', marginTop: '4px' }}>
              Real-time anti-cheat detections flagged on your Minecraft server
            </p>
          </div>
          <span style={{ fontSize: '13px', color: '#8b94a5' }}>
            Total Flags: <strong style={{ color: '#ffffff' }}>{violations.length}</strong>
          </span>
        </div>

        {violations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#8b94a5', fontSize: '13px' }}>
            🎉 No cheat violations detected on your server! Everything is clean.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#8b94a5', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px' }}>Player</th>
                  <th style={{ padding: '10px 12px' }}>Check</th>
                  <th style={{ padding: '10px 12px' }}>Violation Level (VL)</th>
                  <th style={{ padding: '10px 12px' }}>Details</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {violations.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#ffffff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={`https://mc-heads.net/avatar/${encodeURIComponent(v.playerName)}/20`}
                          alt=""
                          style={{ width: '20px', height: '20px', borderRadius: '4px' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        {v.playerName}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="badge badge-pending" style={{ fontSize: '11px' }}>
                        {v.checkId}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#ff4444', fontWeight: '700' }}>
                      VL {v.vl}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#8b94a5', fontSize: '12px' }}>{v.details}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#8b94a5', fontSize: '12px' }}>
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION: MINECRAFT CONFIG SNIPPET */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
          📋 Server Configuration (`plugins/NexoraAntiCheat/config.yml`)
        </h4>
        <p style={{ fontSize: '12px', color: '#8b94a5', marginBottom: '12px' }}>
          Paste this block into your Minecraft server configuration to activate protection:
        </p>
        <pre style={{
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
  key: "${userSession.licenseKey}"
  server-name: "${server ? server.serverName : 'My Minecraft Server'}"
  api-url: "${typeof window !== 'undefined' ? window.location.origin : 'https://your-panel.onrender.com'}"
  heartbeat-interval-seconds: 60`}
        </pre>
      </div>
    </div>
  );
}
