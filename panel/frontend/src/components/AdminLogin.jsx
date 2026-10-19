import React, { useState } from 'react';
import { API_BASE } from '../apiConfig';
import { ShieldAlert, Lock, ArrowLeft, AlertCircle, KeyRound, CheckCircle } from 'lucide-react';

export default function AdminLogin({ onLoginSuccess, onReturnHome }) {
  // Security Code Gate: require security passcode first
  const [securityUnlocked, setSecurityUnlocked] = useState(false);
  const [securityCode, setSecurityCode] = useState('');
  const [securityError, setSecurityError] = useState(null);

  // Admin login credentials
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleVerifySecurityCode = (e) => {
    e.preventDefault();
    setSecurityError(null);
    const cleanCode = securityCode.trim();

    // Accepted security codes: 777777, bayon2026, bayon_root, or admin
    if (cleanCode === '777777' || cleanCode.toLowerCase() === 'bayon2026' || cleanCode.toLowerCase() === 'bayon_root') {
      setSecurityUnlocked(true);
    } else {
      setSecurityError('Invalid security access key. Access prohibited.');
    }
  };

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
          setErrorMsg('Access denied: Account lacks required permissions.');
          setLoading(false);
          return;
        }

        localStorage.setItem('bayon_user', JSON.stringify(data.user));
        localStorage.setItem('nexora_user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      } else {
        setErrorMsg(data.error || data.message || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      setErrorMsg('Network error connecting to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 1: Security Code Gate
  if (!securityUnlocked) {
    return (
      <div className="admin-login-wrapper">
        <div className="admin-login-box">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-bright)',
              marginBottom: '14px'
            }}>
              <ShieldAlert size={28} style={{ color: '#fff' }} />
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '0.8px', marginBottom: '6px' }}>
              RESTRICTED SECURITY GATE
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              This system endpoint is protected. Please enter the authorized master security code to unlock.
            </p>
          </div>

          {securityError && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '18px',
              fontSize: '12.5px',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{securityError}</span>
            </div>
          )}

          <form onSubmit={handleVerifySecurityCode}>
            <div style={{ marginBottom: '20px' }}>
              <label className="form-label">Master Security Passcode</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter security passcode..."
                  value={securityCode}
                  onChange={e => setSecurityCode(e.target.value)}
                  autoFocus
                  style={{
                    letterSpacing: '3px',
                    fontFamily: 'var(--font-mono)',
                    textAlign: 'center',
                    fontSize: '16px'
                  }}
                />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
                Default security master key: <span style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>777777</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px', marginBottom: '16px' }}
            >
              <KeyRound size={16} /> Unlock Gateway
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

  // STEP 2: Authenticated Login Screen (After Security Passcode is passed)
  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-box">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px'
          }}>
            <img
              src="/logo.png"
              alt="Bayon Logo"
              style={{ width: '56px', height: '56px', objectFit: 'contain' }}
            />
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '0.8px', marginBottom: '4px' }}>
            BAYON SYSTEM CONSOLE
          </h2>
          <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            OPERATOR AUTHENTICATION
          </p>
        </div>

        {errorMsg && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '8px',
            marginBottom: '18px',
            fontSize: '12.5px',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.3)',
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
            <label className="form-label">Operator Username</label>
            <input
              type="text"
              className="input-field"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '14px', marginBottom: '16px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In to Console'}
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
