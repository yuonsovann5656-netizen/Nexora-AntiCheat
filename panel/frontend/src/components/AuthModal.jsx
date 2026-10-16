import React, { useState } from 'react';
import { API_BASE } from '../apiConfig';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  if (!isOpen) return null;

  const [tab, setTab] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Username and password are required.');
      return;
    }

    if (tab === 'register' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    const endpoint = tab === 'login' ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/register`;
    const payload = tab === 'login' ? { username, password } : { username, email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('nexora_user', JSON.stringify(data.user));
        onAuthSuccess(data.user);
        onClose();
      } else {
        setErrorMsg(data.error || 'Authentication failed.');
      }
    } catch {
      setErrorMsg('Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div className="modal-title">NEXORA ACCOUNT</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-tabs" style={{ marginBottom: '20px' }}>
            <button
              type="button"
              className={`modal-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setErrorMsg(null); }}
              style={{ flex: 1, textAlign: 'center' }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`modal-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setErrorMsg(null); }}
              style={{ flex: 1, textAlign: 'center' }}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              background: 'rgba(255, 51, 68, 0.15)',
              color: '#ff4d5e',
              border: '1px solid rgba(255, 51, 68, 0.3)'
            }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
              <label className="form-label">Username</label>
              <input
                type="text"
                className="input-field mono"
                placeholder="Enter username..."
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>

            {tab === 'register' && (
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Email (Optional)</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {tab === 'register' && (
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : (tab === 'login' ? 'Sign In' : 'Register Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
