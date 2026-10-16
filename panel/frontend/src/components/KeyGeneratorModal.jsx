import React, { useState } from 'react';
import { API_BASE } from '../apiConfig';

/**
 * KeyGeneratorModal
 * Opens when admin clicks "Generate New License" in AdminDashboard.
 * Posts to /api/admin/licenses/create and shows the result.
 */
export default function KeyGeneratorModal({ isOpen, onClose, onCreated }) {
  const [tier, setTier] = useState('STANDARD');
  const [ownerNote, setOwnerNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/licenses/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, ownerNote: ownerNote.trim() }),
      });
      const data = await res.json();
      if (res.ok && (data.key || data.licenseKey)) {
        setResult(data.key || data.licenseKey);
        if (onCreated) onCreated();
      } else {
        setError(data.error || data.message || 'Failed to generate license key.');
      }
    } catch {
      setError('Network error. Check backend connection.');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    setOwnerNote('');
    setTier('STANDARD');
    onClose();
  };

  const copyKey = () => {
    if (result) navigator.clipboard.writeText(result);
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">🔑 Generate License Key</span>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="alert alert-error">{error}</div>}

          {result ? (
            <div>
              <div className="alert alert-success" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>✅ License key generated!</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>{result}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={copyKey} style={{ flex: 1 }}>
                  📋 Copy Key
                </button>
                <button className="btn btn-secondary" onClick={handleClose} style={{ flex: 1 }}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label className="form-label">License Tier</label>
                <select
                  className="input-field"
                  value={tier}
                  onChange={e => setTier(e.target.value)}
                >
                  <option value="STANDARD">Standard</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Owner / Note (optional)</label>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Player123's server"
                  value={ownerNote}
                  onChange={e => setOwnerNote(e.target.value)}
                />
              </div>

              <div className="modal-footer" style={{ padding: 0, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={generating}>
                  {generating
                    ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    : '⚡ Generate Key'
                  }
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
