import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';

export default function AdminPanel({ isOpen, onClose, user, onRefreshStore }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ totalUsers: 0, totalPlugins: 0, totalDownloads: 0, totalRevenue: 0, pendingDepositsCount: 0 });
  const [deposits, setDeposits] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [users, setUsers] = useState([]);
  const [alertMsg, setAlertMsg] = useState(null);

  // New Plugin Form state
  const [newPluginId, setNewPluginId] = useState('');
  const [newPluginName, setNewPluginName] = useState('');
  const [newPluginPrice, setNewPluginPrice] = useState(9.99);
  const [newPluginTagline, setNewPluginTagline] = useState('');
  const [newPluginDesc, setNewPluginDesc] = useState('');
  const [newPluginVersion, setNewPluginVersion] = useState('1.0.0');
  const [newPluginCategory, setNewPluginCategory] = useState('Utility');

  // Changelog form state
  const [selectedPluginId, setSelectedPluginId] = useState('');
  const [newChangelogVersion, setNewChangelogVersion] = useState('');
  const [newChangelogTitle, setNewChangelogTitle] = useState('');
  const [newChangelogNotes, setNewChangelogNotes] = useState('');

  // JAR Upload form state
  const [uploadPluginId, setUploadPluginId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadJar = async (e) => {
    e.preventDefault();
    if (!uploadPluginId || !uploadFile) {
      setAlertMsg({ type: 'error', text: 'Please select a plugin and choose a .jar file to upload.' });
      return;
    }

    setUploading(true);
    setAlertMsg(null);
    try {
      const formData = new FormData();
      formData.append('jarFile', uploadFile);

      const res = await fetch(`${API_BASE}/api/admin/plugins/${uploadPluginId}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        setUploadFile(null);
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Upload failed.' });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Network error uploading JAR file.' });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, depRes, plugRes, userRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`),
        fetch(`${API_BASE}/api/admin/deposits`),
        fetch(`${API_BASE}/api/plugins`),
        fetch(`${API_BASE}/api/admin/users`)
      ]);
      const [sD, dD, pD, uD] = await Promise.all([
        statsRes.json(),
        depRes.json(),
        plugRes.json(),
        userRes.json()
      ]);
      setStats(sD);
      setDeposits(Array.isArray(dD) ? dD : []);
      setPlugins(Array.isArray(pD) ? pD : []);
      setUsers(Array.isArray(uD) ? uD : []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  const handleApproveDeposit = async (depId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/deposits/${depId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to approve deposit.' });
    }
  };

  const handleRejectDeposit = async (depId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/deposits/${depId}/reject`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        fetchAdminData();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to reject deposit.' });
    }
  };

  const handleCreatePlugin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newPluginId,
          name: newPluginName,
          price: Number(newPluginPrice),
          tagline: newPluginTagline,
          description: newPluginDesc,
          version: newPluginVersion,
          category: newPluginCategory
        })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: `Plugin ${data.plugin.name} created!` });
        setNewPluginId('');
        setNewPluginName('');
        setNewPluginTagline('');
        setNewPluginDesc('');
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to create plugin.' });
    }
  };

  const handleAddChangelog = async (e) => {
    e.preventDefault();
    if (!selectedPluginId) return;

    try {
      const notesArray = newChangelogNotes.split('\n').filter(n => n.trim().length > 0);
      const res = await fetch(`${API_BASE}/api/admin/plugins/${selectedPluginId}/changelog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: newChangelogVersion,
          title: newChangelogTitle,
          notes: notesArray
        })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: `Changelog published for ${data.plugin.name}!` });
        setNewChangelogVersion('');
        setNewChangelogTitle('');
        setNewChangelogNotes('');
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to publish changelog.' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '960px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="brand-badge">ADMIN</span>
            <div className="modal-title">NEXORA PLATFORM ADMINISTRATION</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Admin Navigation Tabs */}
        <div style={{ padding: '0 24px', background: 'var(--bg-secondary)' }}>
          <div className="modal-tabs" style={{ marginBottom: 0 }}>
            <button
              className={`modal-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview & Stats
            </button>
            <button
              className={`modal-tab ${activeTab === 'deposits' ? 'active' : ''}`}
              onClick={() => setActiveTab('deposits')}
            >
              KHQR Deposits ({deposits.filter(d => d.status === 'PENDING').length} Pending)
            </button>
            <button
              className={`modal-tab ${activeTab === 'plugins' ? 'active' : ''}`}
              onClick={() => setActiveTab('plugins')}
            >
              Plugin Management ({plugins.length})
            </button>
            <button
              className={`modal-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Users & Wallets ({users.length})
            </button>
          </div>
        </div>

        <div className="modal-body">
          {alertMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '13px',
              background: alertMsg.type === 'success' ? 'rgba(0, 229, 153, 0.15)' : 'rgba(255, 51, 68, 0.15)',
              color: alertMsg.type === 'success' ? '#00e599' : '#ff4d5e',
              border: `1px solid ${alertMsg.type === 'success' ? 'rgba(0, 229, 153, 0.3)' : 'rgba(255, 51, 68, 0.3)'}`
            }}>
              {alertMsg.text}
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-lbl">Total Verified Revenue</div>
                  <div className="stat-val">${stats.totalRevenue ? stats.totalRevenue.toFixed(2) : '0.00'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-lbl">Pending Deposits</div>
                  <div className="stat-val" style={{ color: stats.pendingDepositsCount > 0 ? '#fff' : 'inherit' }}>
                    {stats.pendingDepositsCount || 0}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-lbl">Total Downloads</div>
                  <div className="stat-val">{stats.totalDownloads || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-lbl">Registered Users</div>
                  <div className="stat-val">{stats.totalUsers || 0}</div>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                RECENT KHQR DEPOSITS
              </h4>
              <table className="tech-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>KHQR Ref</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.slice(0, 5).map(d => (
                    <tr key={d.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{d.username}</td>
                      <td className="mono">${Number(d.amount).toFixed(2)} {d.currency}</td>
                      <td className="mono" style={{ fontSize: '11px' }}>{d.khqrRef}</td>
                      <td>
                        <span className="brand-badge" style={{
                          background: d.status === 'APPROVED' ? 'rgba(0, 229, 153, 0.15)' : d.status === 'REJECTED' ? 'rgba(255, 51, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                          borderColor: d.status === 'APPROVED' ? '#00e599' : d.status === 'REJECTED' ? '#ff4d5e' : '#fff',
                          color: d.status === 'APPROVED' ? '#00e599' : d.status === 'REJECTED' ? '#ff4d5e' : '#fff'
                        }}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        {d.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleApproveDeposit(d.id)}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleRejectDeposit(d.id)}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DEPOSITS TAB */}
          {activeTab === 'deposits' && (
            <div>
              <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                ALL KHQR DEPOSIT REQUESTS
              </h4>
              <table className="tech-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Ref Code</th>
                    <th>Receipt Proof</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map(d => (
                    <tr key={d.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{d.username}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>${Number(d.amount).toFixed(2)} {d.currency}</td>
                      <td className="mono" style={{ fontSize: '11px' }}>{d.khqrRef}</td>
                      <td>
                        {d.receiptImage && d.receiptImage.startsWith('data:') ? (
                          <img
                            src={d.receiptImage}
                            alt="Receipt"
                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => window.open(d.receiptImage)}
                          />
                        ) : d.receiptImage ? (
                          <span className="mono" style={{ fontSize: '11px' }}>{d.receiptImage.substring(0, 16)}...</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: '11px' }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                      <td>
                        <span className="brand-badge" style={{
                          background: d.status === 'APPROVED' ? 'rgba(0, 229, 153, 0.15)' : d.status === 'REJECTED' ? 'rgba(255, 51, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                          borderColor: d.status === 'APPROVED' ? '#00e599' : d.status === 'REJECTED' ? '#ff4d5e' : '#fff',
                          color: d.status === 'APPROVED' ? '#00e599' : d.status === 'REJECTED' ? '#ff4d5e' : '#fff'
                        }}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        {d.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-success btn-sm" onClick={() => handleApproveDeposit(d.id)}>Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleRejectDeposit(d.id)}>Reject</button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'monospace' }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PLUGINS TAB */}
          {activeTab === 'plugins' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Publish Changelog Form */}
                <form onSubmit={handleAddChangelog} className="review-form">
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: '12px' }}>
                    PUBLISH VERSION CHANGELOG & NOTIFICATION
                  </h4>
                  <div style={{ marginBottom: '10px' }}>
                    <label className="form-label">Select Plugin</label>
                    <select
                      className="input-field mono"
                      value={selectedPluginId}
                      onChange={e => setSelectedPluginId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Plugin --</option>
                      {plugins.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Current: v{p.version})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label className="form-label">New Version</label>
                      <input
                        type="text"
                        className="input-field mono"
                        placeholder="e.g. 1.0.1"
                        value={newChangelogVersion}
                        onChange={e => setNewChangelogVersion(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Release Title</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Heuristic Engine Patch"
                        value={newChangelogTitle}
                        onChange={e => setNewChangelogTitle(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label className="form-label">Release Notes (1 per line)</label>
                    <textarea
                      className="input-field mono"
                      style={{ minHeight: '80px', fontSize: '12px' }}
                      placeholder="Added Folia 1.21.4 support&#10;Fixed Speed false positives&#10;Performance improvement"
                      value={newChangelogNotes}
                      onChange={e => setNewChangelogNotes(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm">Publish Update Notification</button>
                </form>

                {/* Create Plugin Form */}
                <form onSubmit={handleCreatePlugin} className="review-form">
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: '12px' }}>
                    ADD NEW PLUGIN TO MARKETPLACE
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label className="form-label">Plugin ID</label>
                      <input
                        type="text"
                        className="input-field mono"
                        placeholder="e.g. nexora-dupe-fix"
                        value={newPluginId}
                        onChange={e => setNewPluginId(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Plugin Name</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Nexora DupeFixer"
                        value={newPluginName}
                        onChange={e => setNewPluginName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label className="form-label">Price (USD)</label>
                      <input
                        type="number"
                        className="input-field mono"
                        placeholder="0.00 for Free"
                        value={newPluginPrice}
                        onChange={e => setNewPluginPrice(e.target.value)}
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Category</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Security / PvP / Utility"
                        value={newPluginCategory}
                        onChange={e => setNewPluginCategory(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label className="form-label">Tagline</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Brief one-line summary"
                      value={newPluginTagline}
                      onChange={e => setNewPluginTagline(e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label className="form-label">Full Description</label>
                    <textarea
                      className="input-field"
                      style={{ minHeight: '60px' }}
                      placeholder="Detailed features..."
                      value={newPluginDesc}
                      onChange={e => setNewPluginDesc(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-secondary btn-sm">Add Plugin</button>
                </form>
              </div>

              {/* Direct Server JAR File Upload Form (No GitHub) */}
              <form onSubmit={handleUploadJar} className="review-form" style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: '12px' }}>
                  📁 UPLOAD PLUGIN .JAR BINARY DIRECTLY TO SERVER STORAGE (NO GITHUB LEAKS)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '12px', alignItems: 'flex-end' }}>
                  <div>
                    <label className="form-label">Target Plugin</label>
                    <select
                      className="input-field mono"
                      value={uploadPluginId}
                      onChange={e => setUploadPluginId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Plugin --</option>
                      {plugins.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Select .JAR / .ZIP File from your PC</label>
                    <input
                      type="file"
                      accept=".jar,.zip"
                      className="input-field"
                      onChange={e => setUploadFile(e.target.files[0])}
                      required
                    />
                  </div>
                  <div>
                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                      {uploading ? 'Uploading...' : '⬆ Upload JAR to Server'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Plugins Table */}
              <table className="tech-table">
                <thead>
                  <tr>
                    <th>Plugin</th>
                    <th>Price</th>
                    <th>Version</th>
                    <th>Unique Downloads</th>
                    <th>File Storage Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plugins.map(p => {
                    const isHosted = p.hasFile || p.id === 'nexora-anticheat';
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.icon} {p.name}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>${Number(p.price).toFixed(2)}</td>
                        <td className="mono">v{p.version}</td>
                        <td className="mono">{p.downloads || 0}</td>
                        <td>
                          <span className="brand-badge" style={{
                            borderColor: isHosted ? '#00e599' : 'rgba(255,255,255,0.2)',
                            color: isHosted ? '#00e599' : 'var(--text-muted)',
                            background: isHosted ? 'rgba(0, 229, 153, 0.1)' : 'transparent'
                          }}>
                            {isHosted ? '✓ Hosted on Server' : 'No File'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setUploadPluginId(p.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            ⬆ Upload New .JAR
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div>
              <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                REGISTERED USER ACCOUNTS & WALLETS
              </h4>
              <table className="tech-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Wallet Balance</th>
                    <th>Library (Owned)</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{u.username}</td>
                      <td>
                        <span className="brand-badge" style={{ borderColor: u.role === 'ADMIN' ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="mono" style={{ fontWeight: 700 }}>${Number(u.balance || 0).toFixed(2)} USD</td>
                      <td className="mono" style={{ fontSize: '11px' }}>
                        {u.purchasedPlugins ? u.purchasedPlugins.length : 0} plugins
                      </td>
                      <td className="mono" style={{ fontSize: '11px' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
