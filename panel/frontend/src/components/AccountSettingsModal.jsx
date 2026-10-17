import React, { useState } from 'react';
import { API_BASE } from '../apiConfig';
import {
  X, User, Mail, Lock, Shield, CheckCircle,
  AlertCircle, KeyRound, Sparkles, LogOut
} from 'lucide-react';

export default function AccountSettingsModal({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onLogout
}) {
  if (!isOpen || !user) return null;

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'email', 'password'
  
  // Change Email state
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setEmailMsg({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setEmailLoading(true);
    setEmailMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/user/change-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          newEmail: newEmail.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailMsg({ type: 'success', text: 'Email updated successfully!' });
        setNewEmail('');
        if (onUpdateUser) {
          onUpdateUser({ ...user, email: data.email });
        }
      } else {
        setEmailMsg({ type: 'error', text: data.error || 'Failed to update email.' });
      }
    } catch {
      setEmailMsg({ type: 'error', text: 'Network connection error.' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPwMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (newPassword.length < 5) {
      setPwMsg({ type: 'error', text: 'New password must be at least 5 characters.' });
      return;
    }

    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/user/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          currentPassword,
          newPassword
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPwMsg({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwMsg({ type: 'error', text: data.error || 'Failed to change password.' });
      }
    } catch {
      setPwMsg({ type: 'error', text: 'Network connection error.' });
    } finally {
      setPwLoading(false);
    }
  };

  const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(user.username)}/70`;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-box glass-panel"
        style={{ maxWidth: '480px', width: '92%', padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={18} style={{ color: '#00e599' }} />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
                ACCOUNT SETTINGS
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Manage your credentials and ShotDi profile
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-close"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab selection */}
        <div style={{
          display: 'flex',
          background: '#090c12',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 16px'
        }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'profile' ? '2px solid #00e599' : '2px solid transparent',
              color: activeTab === 'profile' ? '#fff' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <User size={14} /> Profile
          </button>
          <button
            onClick={() => setActiveTab('email')}
            style={{
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'email' ? '2px solid #00e599' : '2px solid transparent',
              color: activeTab === 'email' ? '#fff' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Mail size={14} /> Change Email
          </button>
          <button
            onClick={() => setActiveTab('password')}
            style={{
              padding: '12px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'password' ? '2px solid #00e599' : '2px solid transparent',
              color: activeTab === 'password' ? '#fff' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <KeyRound size={14} /> Change Password
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px' }}>
          
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                marginBottom: '20px'
              }}>
                <img
                  src={avatarUrl}
                  alt={user.username}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '8px',
                    border: '2px solid #00e599',
                    boxShadow: '0 0 15px rgba(0, 229, 153, 0.2)'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                    {user.username}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span className={`badge ${user.role === 'ADMIN' ? 'badge-red' : 'badge-blue'}`}>
                      {user.role}
                    </span>
                    {user.emailVerified ? (
                      <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={10} /> VERIFIED
                      </span>
                    ) : (
                      <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={10} /> UNVERIFIED
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Registered Email</span>
                  <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>{user.email || 'None configured'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Owned Software</span>
                  <span style={{ fontSize: '12px', color: '#00e599', fontWeight: 700 }}>
                    {(user.purchasedPlugins || []).length} Plugins
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Security Architecture</span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: 'var(--font-mono)' }}>ShotDi 24/7 Shield</span>
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => setActiveTab('email')}
                >
                  <Mail size={13} /> Update Email
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => setActiveTab('password')}
                >
                  <KeyRound size={13} /> Update Password
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CHANGE EMAIL */}
          {activeTab === 'email' && (
            <form onSubmit={handleChangeEmail}>
              {emailMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  background: emailMsg.type === 'success' ? 'rgba(0, 229, 153, 0.15)' : 'rgba(255, 51, 68, 0.15)',
                  color: emailMsg.type === 'success' ? '#00e599' : '#ff4d5e',
                  border: `1px solid ${emailMsg.type === 'success' ? 'rgba(0, 229, 153, 0.3)' : 'rgba(255, 51, 68, 0.3)'}`
                }}>
                  {emailMsg.text}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Current Email</label>
                <input
                  type="text"
                  className="input-field"
                  disabled
                  value={user.email || 'No email attached'}
                  style={{ opacity: 0.6 }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label className="form-label">New Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="Enter your new email address"
                  className="input-field"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={emailLoading}
              >
                {emailLoading ? 'Saving...' : 'Update Email Address'}
              </button>
            </form>
          )}

          {/* TAB 3: CHANGE PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword}>
              {pwMsg && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  background: pwMsg.type === 'success' ? 'rgba(0, 229, 153, 0.15)' : 'rgba(255, 51, 68, 0.15)',
                  color: pwMsg.type === 'success' ? '#00e599' : '#ff4d5e',
                  border: `1px solid ${pwMsg.type === 'success' ? 'rgba(0, 229, 153, 0.3)' : 'rgba(255, 51, 68, 0.3)'}`
                }}>
                  {pwMsg.text}
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  className="input-field"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label className="form-label">New Password (min 5 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  className="input-field"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  className="input-field"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={pwLoading}
              >
                {pwLoading ? 'Changing Password...' : 'Change Password'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
