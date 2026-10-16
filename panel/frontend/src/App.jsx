import React, { useState, useEffect } from 'react';
import { API_BASE } from './apiConfig';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [session, setSession] = useState(null);
  const [authTab, setAuthTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('nexora_session');
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem('nexora_session');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('nexora_session');
    setSession(null);
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setLicenseKey('');
    setError('');
    setSuccess('');
  };

  const switchTab = (tab) => {
    setAuthTab(tab);
    resetForm();
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
          body: JSON.stringify({ username, password, licenseKey }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Login failed');
        const userSession = data.user || data;
        localStorage.setItem('nexora_session', JSON.stringify(userSession));
        setSession(userSession);
      } else {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, confirmPassword, licenseKey }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Signup failed');
        setSuccess('Account created successfully! Please sign in with your credentials.');
        switchTab('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // If authenticated, render role-specific dashboard
  if (session) {
    if (session.role === 'ADMIN') {
      return <AdminDashboard user={session} onLogout={handleLogout} />;
    }
    return <UserDashboard user={session} onLogout={handleLogout} />;
  }

  // Unauthenticated — Only Login/Signup page displays
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-box">🛡️</div>
          <div className="auth-title">
            NEXORA <span>ANTICHEAT</span>
          </div>
          <div className="auth-subtitle">
            Secure Cloud Licensing & Fleet Control Platform
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${authTab === 'signup' ? 'active' : ''}`}
            onClick={() => switchTab('signup')}
            type="button"
          >
            Create Account
          </button>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. ServerOwner"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">License Key</label>
            <input
              type="text"
              className="input-field input-mono"
              placeholder="NX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Enter your password"
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
                placeholder="Repeat your password"
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
                ? '⚡ Access Dashboard'
                : '✨ Register New Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
