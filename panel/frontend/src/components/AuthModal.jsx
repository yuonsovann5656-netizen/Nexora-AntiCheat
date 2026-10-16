import React, { useState } from 'react';
import { API_BASE } from '../apiConfig';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  if (!isOpen) return null;

  const [tab, setTab] = useState('login'); // 'login', 'register', or 'verify'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [issuedCode, setIssuedCode] = useState(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Username/Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
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
      setErrorMsg('Server connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!username.trim() || !email.trim() || !password) {
      setErrorMsg('All fields are required.');
      return;
    }

    if (!email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.requiresVerification) {
          setPendingEmail(email.trim().toLowerCase());
          setIssuedCode(data.verificationCode);
          setTab('verify');
          setSuccessMsg('Account created! Please enter the 6-digit verification code.');
        } else {
          localStorage.setItem('nexora_user', JSON.stringify(data.user));
          onAuthSuccess(data.user);
          onClose();
        }
      } else {
        setErrorMsg(data.error || 'Registration failed.');
      }
    } catch {
      setErrorMsg('Network error while creating account.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!verificationCode.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingEmail || email,
          username: username.trim(),
          code: verificationCode.trim()
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg('Email verified successfully! Logging you in...');
        setTimeout(() => {
          localStorage.setItem('nexora_user', JSON.stringify(data.user));
          onAuthSuccess(data.user);
          onClose();
        }, 800);
      } else {
        setErrorMsg(data.error || 'Invalid verification code.');
      }
    } catch {
      setErrorMsg('Verification failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingEmail || email,
          username: username.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setIssuedCode(data.verificationCode);
        setSuccessMsg('New 6-digit code generated!');
      } else {
        setErrorMsg(data.error || 'Failed to resend code.');
      }
    } catch {
      setErrorMsg('Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        
        {/* Header with official logo */}
        <div style={{ textAlign: 'center', padding: '24px 20px 14px', borderBottom: '1px solid #1a1e29' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <img
              src="/logo.png"
              alt="Nexora Technologies Logo"
              style={{ width: '48px', height: '48px', borderRadius: '10px', boxShadow: '0 0 20px rgba(255, 255, 255, 0.15)' }}
            />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '1px', color: '#fff' }}>
            NEXORA TECHNOLOGIES
          </div>
          <div style={{ fontSize: '11px', color: '#8892a4', letterSpacing: '0.5px', marginTop: '3px' }}>
            SUPABASE AUTHENTICATION & ACCESS GATE
          </div>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '18px',
              background: 'none',
              border: 'none',
              color: '#8892a4',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            Γ£ò
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px 28px' }}>
          
          {tab !== 'verify' && (
            <div className="modal-tabs" style={{ marginBottom: '20px' }}>
              <button
                type="button"
                className={`modal-tab ${tab === 'login' ? 'active' : ''}`}
                onClick={() => { setTab('login'); setErrorMsg(null); setSuccessMsg(null); }}
                style={{ flex: 1, textAlign: 'center' }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`modal-tab ${tab === 'register' ? 'active' : ''}`}
                onClick={() => { setTab('register'); setErrorMsg(null); setSuccessMsg(null); }}
                style={{ flex: 1, textAlign: 'center' }}
              >
                Create Account
              </button>
            </div>
          )}

          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              background: 'rgba(255, 51, 68, 0.12)',
              color: '#ff4d5e',
              border: '1px solid rgba(255, 51, 68, 0.3)'
            }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              {successMsg}
            </div>
          )}

          {/* TAB 1: SIGN IN */}
          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Username or Email</label>
                <input
                  type="text"
                  className="input-field mono"
                  placeholder="admin or user@domain.com"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '14px' }}
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In to Account'}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Desired Username</label>
                <input
                  type="text"
                  className="input-field mono"
                  placeholder="e.g. HypixelDev"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Email Address (For Verification)</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="yourname@domain.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label">Confirm Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '14px' }}
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Register & Send Code'}
              </button>
            </form>
          )}

          {/* TAB 3: VERIFY EMAIL */}
          {tab === 'verify' && (
            <form onSubmit={handleVerifyEmail}>
              <div style={{
                textAlign: 'center',
                padding: '16px',
                background: '#090b10',
                border: '1px solid #1a1e29',
                borderRadius: '8px',
                marginBottom: '18px'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>Γ£ë∩╕Å</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                  Verify Your Email
                </div>
                <div style={{ fontSize: '12px', color: '#8892a4', wordBreak: 'break-all' }}>
                  A 6-digit confirmation code has been assigned to:
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
                  {pendingEmail || email}
                </div>

                {issuedCode && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px dashed #333',
                    borderRadius: '6px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ color: '#8892a4' }}>Dev Code:</span>
                    <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '2px' }}>
                      {issuedCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVerificationCode(issuedCode)}
                      style={{
                        background: '#fff',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Fill
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  className="input-field mono"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  style={{
                    fontSize: '24px',
                    textAlign: 'center',
                    letterSpacing: '8px',
                    fontWeight: 800,
                    padding: '12px'
                  }}
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '14px', marginBottom: '10px' }}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify Email & Enter'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleResendCode}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8892a4',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('login'); setErrorMsg(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8892a4',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Supabase footer pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '22px',
            paddingTop: '16px',
            borderTop: '1px solid #161a24',
            fontSize: '11px',
            color: '#656e80'
          }}>
            <span>≡ƒöÆ Encrypted with PBKDF2-SHA512</span>
            <span>ΓÇó</span>
            <span>ΓÜí Supabase PostgreSQL</span>
          </div>

        </div>
      </div>
    </div>
  );
}
