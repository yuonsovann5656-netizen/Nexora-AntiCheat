import React, { useState } from 'react';
import { API_BASE } from './apiConfig';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';

// ============================================================
//  Nexora AntiCheat — Root App
//  Handles auth gate → routes to UserDashboard or AdminDashboard
// ============================================================

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nexora_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [tab, setTab] = useState('login');          // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('nexora_session');
    setUser(null);
    setUsername('');
    setPassword('');
    setLicenseKey('');
    setError('');
    setSuccess('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !licenseKey.trim()) {
      setError('All fields are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          licenseKey: licenseKey.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        const session = { ...data.user };
        localStorage.setItem('nexora_session', JSON.stringify(session));
        setUser(session);
      } else {
        setError(data.error || data.message || 'Invalid credentials.');
      }
    } catch {
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !licenseKey.trim()) {
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
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          confirmPassword,
          licenseKey: licenseKey.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (res.ok && (data.success || data.user)) {
        setSuccess('Account created! You can now sign in.');
        setTab('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || data.message || 'Registration failed.');
      }
    } catch {
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Authenticated: route to correct dashboard ----
  if (user) {
    if (user.role === 'ADMIN') {
      return <AdminDashboard user={user} onLogout={handleLogout} />;
    }
    return <UserDashboard user={user} onLogout={handleLogout} />;
  }

  // ---- Auth Gate ----
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">🛡️</div>
          <div className="auth-title">NEXORA ANTICHEAT</div>
          <div className="auth-subtitle">Secure Server Protection Platform</div>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab${tab === 'signup' ? ' active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); setSuccess(''); }}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={tab === 'login' ? handleLogin : handleSignup}>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="input-field"
              type="text"
              placeholder="your_username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </div>

          <div className="form-group">
            <label className="form-label">License Key</label>
            <input
              className="input-field mono"
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="input-field"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'signup' && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={loading}
            style={{ marginTop: '6px' }}
          >
            {loading
              ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              : tab === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '18px' }}>
          You need a valid license key to access the panel.
        </p>
      </div>
    </div>
  );
}
