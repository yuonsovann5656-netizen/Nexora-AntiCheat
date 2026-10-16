import React, { useState, useEffect } from 'react';
import { API_BASE } from './apiConfig';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [session, setSession] = useState(null);
  const [authTab, setAuthTab] = useState('login');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('nexora_admin_session');
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem('nexora_admin_session');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('nexora_admin_session');
    setSession(null);
  };

  const switchTab = (tab) => {
    setAuthTab(tab);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (authTab === 'login') {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');
        const userSession = data.user || data;
        localStorage.setItem('nexora_admin_session', JSON.stringify(userSession));
        setSession(userSession);
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, confirmPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create admin.');
        setSuccess('Admin account created successfully! Please sign in.');
        switchTab('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // If logged in, show the Admin Dashboard
  if (session) {
    return <AdminDashboard user={session} onLogout={handleLogout} />;
  }

  // Unauthenticated — Clean Admin Login / Account Setup
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-box">🛡️</div>
          <div className="auth-title">
            NEXORA <span>ADMIN</span>
          </div>
          <div className="auth-subtitle">
            Plugin Downloads & Fleet Telemetry Controller
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
            type="button"
          >
            Admin Sign In
          </button>
          <button
            className={`auth-tab ${authTab === 'signup' ? 'active' : ''}`}
            onClick={() => switchTab('signup')}
            type="button"
          >
            Register Admin
          </button>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Admin Username</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {authTab === 'signup' && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '10px' }}
            disabled={loading}
          >
            {loading
              ? 'Authenticating...'
              : authTab === 'login'
                ? '⚡ Access Admin Panel'
                : '✨ Create Admin Account'}
          </button>
        </form>

        <div style={{
          marginTop: '20px',
          padding: '12px 14px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          fontSize: '11.5px',
          color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          💡 Default administrator login: <code>admin</code> / <code>admin</code>
        </div>
      </div>
    </div>
  );
}

export default App;
