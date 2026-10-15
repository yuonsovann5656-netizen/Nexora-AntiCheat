import React, { useState } from 'react';
import { API_BASE } from '../apiConfig';

export default function KeyGeneratorModal({ isOpen, onClose, onCreated }) {
  const [owner, setOwner] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState('LIFETIME');
  const [durationDays, setDurationDays] = useState('30');
  const [maxServers, setMaxServers] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!owner.trim()) {
      setError('Buyer / Owner name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/licenses/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          email,
          tier,
          durationDays: tier === 'CUSTOM' ? durationDays : undefined,
          maxServers: Number(maxServers)
        })
      });

      const data = await res.json();
      if (data.success) {
        onCreated(data.license);
        onClose();
      } else {
        setError(data.error || 'Failed to generate key.');
      }
    } catch (err) {
      setError('Cannot connect to panel backend. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '520px',
        width: '100%',
        padding: '28px',
        position: 'relative',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ff0000', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔑 Generate Nexora License Key
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Creates a cryptographically unique key for a server buyer with strict host limits.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '22px',
            cursor: 'pointer'
          }}>✕</button>
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              BUYER / CUSTOMER NAME *
            </label>
            <input
              type="text"
              className="input-dark"
              placeholder="e.g. Hypixel Network LLC or player name"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              BUYER EMAIL ADDRESS
            </label>
            <input
              type="email"
              className="input-dark"
              placeholder="e.g. admin@network.net"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                LICENSE DURATION / TIER
              </label>
              <select
                className="input-dark"
                value={tier}
                onChange={e => setTier(e.target.value)}
              >
                <option value="LIFETIME">Lifetime (No Expiry)</option>
                <option value="1_YEAR">1 Year (365 Days)</option>
                <option value="30_DAYS">30 Days (Monthly)</option>
                <option value="CUSTOM">Custom Days</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                MAX SERVERS ALLOWED
              </label>
              <select
                className="input-dark"
                value={maxServers}
                onChange={e => setMaxServers(e.target.value)}
              >
                <option value="1">1 Server (Single Hosting)</option>
                <option value="2">2 Servers (Network Dual)</option>
                <option value="5">5 Servers (BungeeCord Fleet)</option>
              </select>
            </div>
          </div>

          {tier === 'CUSTOM' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
                CUSTOM DURATION IN DAYS
              </label>
              <input
                type="number"
                min="1"
                className="input-dark"
                value={durationDays}
                onChange={e => setDurationDays(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-red" disabled={loading}>
              {loading ? 'Generating...' : '⚡ Generate Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
