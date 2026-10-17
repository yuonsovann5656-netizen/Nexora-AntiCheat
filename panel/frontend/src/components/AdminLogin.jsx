import React, { useState } from 'react';
import { API_BASE } from '../apiConfig';
import { Shield, Lock, User, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';

export default function AdminLogin({ onLoginSuccess, onReturnHome }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Username and password are required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        if (data.user.role !== 'ADMIN') {
          setErrorMsg('Access denied: Your account does not possess ADMINISTRATOR privileges.');
          setLoading(false);
          return;
        }

        localStorage.setItem('nexora_user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.error || data.message || 'Authentication failed. Please verify admin credentials.');
      }
    } catch {
      setErrorMsg('Network error connecting to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-box">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-bright)',
            borderRadius: '14px',
            marginBottom: '16px',
            boxShadow: '0 0 25px rgba(255, 255, 255, 0.1)'
          }}>
            <img
              src="/logo.png"
              alt="Nexora Logo"
              style={{ width: '42px', height: '42px', borderRadius: '8px' }}
            />
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '0.8px', marginBottom: '4px' }}>
            NEXORA ADMINISTRATOR PORTAL
          </h2>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            RESTRICTED ACCESS • OPERATOR AUTHENTICATION
          </p>
        </div>

        {errorMsg && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '8px',
            marginBottom: '18px',
            fontSize: '12.5px',
            background: 'rgba(255, 51, 68, 0.12)',
            color: '#ff4d5e',
            border: '1px solid rgba(255, 51, 68, 0.3)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px'
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Admin Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                style={{ marginBottom: 0 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ marginBottom: 0 }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '14px', marginBottom: '16px' }}
          >
            {loading ? 'Verifying Credentials...' : 'Sign In to Admin Panel'}
          </button>
        </form>

        <div style={{ textAlign: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={onReturnHome}
            className="btn-ghost"
            style={{
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              background: 'none',
              border: 'none'
            }}
          >
            <ArrowLeft size={14} />
            <span>Return to Public Marketplace</span>
          </button>
        </div>
      </div>
    </div>
  );
}
