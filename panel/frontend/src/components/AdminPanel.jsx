import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';

export default function AdminPanel({ isOpen, onClose, user, onRefreshStore }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'plugins', 'users', 'downloads'
  const [stats, setStats] = useState({ totalUsers: 0, verifiedUsers: 0, unverifiedUsers: 0, totalPlugins: 0, totalDownloads: 0 });
  const [plugins, setPlugins] = useState([]);
  const [users, setUsers] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [alertMsg, setAlertMsg] = useState(null);

  // New Plugin Form state
  const [newPluginId, setNewPluginId] = useState('');
  const [newPluginName, setNewPluginName] = useState('');
  const [newPluginPrice, setNewPluginPrice] = useState(9.99);
  const [newPluginTagline, setNewPluginTagline] = useState('');
  const [newPluginDesc, setNewPluginDesc] = useState('');
  const [newPluginVersion, setNewPluginVersion] = useState('1.0.0');
  const [newPluginCategory, setNewPluginCategory] = useState('Security');

  // Changelog form state
  const [selectedPluginId, setSelectedPluginId] = useState('');
  const [newChangelogVersion, setNewChangelogVersion] = useState('');
  const [newChangelogTitle, setNewChangelogTitle] = useState('');
  const [newChangelogNotes, setNewChangelogNotes] = useState('');

  // JAR Upload form state
  const [uploadPluginId, setUploadPluginId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Balance adjust modal/state
  const [selectedUser, setSelectedUser] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState(25);
  const [grantPluginId, setGrantPluginId] = useState('nexora-anticheat');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, plugRes, userRes, dlRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`),
        fetch(`${API_BASE}/api/plugins`),
        fetch(`${API_BASE}/api/admin/users`),
        fetch(`${API_BASE}/api/admin/downloads`)
      ]);
      const [sD, pD, uD, dD] = await Promise.all([
        statsRes.json(),
        plugRes.json(),
        userRes.json(),
        dlRes.json()
      ]);
      setStats(sD);
      setPlugins(Array.isArray(pD) ? pD : []);
      setUsers(Array.isArray(uD) ? uD : []);
      setDownloads(Array.isArray(dD) ? dD : []);
      if (pD && pD.length > 0 && !uploadPluginId) {
        setUploadPluginId(pD[0].id);
        setSelectedPluginId(pD[0].id);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

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

  const handleCreatePlugin = async (e) => {
    e.preventDefault();
    if (!newPluginId || !newPluginName) {
      setAlertMsg({ type: 'error', text: 'ID and Name are required.' });
      return;
    }

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
        setAlertMsg({ type: 'success', text: `Plugin "${newPluginName}" created successfully!` });
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
    if (!selectedPluginId || !newChangelogTitle || !newChangelogNotes) {
      setAlertMsg({ type: 'error', text: 'Please fill in all changelog fields.' });
      return;
    }

    try {
      const notesArray = newChangelogNotes.split('\n').map(n => n.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/api/admin/plugins/${selectedPluginId}/changelog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: newChangelogVersion || '1.0.1',
          title: newChangelogTitle,
          notes: notesArray
        })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: 'Changelog published successfully!' });
        setNewChangelogTitle('');
        setNewChangelogNotes('');
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to publish changelog.' });
    }
  };

  // Toggle or force verify email
  const handleToggleVerifyEmail = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        fetchAdminData();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to update email verification.' });
    }
  };

  // Adjust user balance
  const handleAdjustBalance = async (userId, addAmount) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addAmount })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        fetchAdminData();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to update balance.' });
    }
  };

  // Toggle user role
  const handleToggleRole = async (userId, currentRole) => {
    const nextRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        fetchAdminData();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to update role.' });
    }
  };

  // Grant plugin to user
  const handleGrantPlugin = async (userId, pluginId) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/grant-plugin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        fetchAdminData();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to grant plugin.' });
    }
  };

  // Delete user account
  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user account "${username}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: `User ${username} deleted.` });
        fetchAdminData();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to delete user.' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '980px', width: '95%' }}>
        
        {/* Header with official logo */}
        <div className="modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid #1a1e29', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png" alt="Nexora Logo" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
                NEXORA ADMINISTRATOR PANEL
              </div>
              <div style={{ fontSize: '11px', color: '#8892a4' }}>
                Server Local Storage • Supabase PostgreSQL • Zero License Lock
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} style={{ fontSize: '18px', background: 'none', border: 'none', color: '#8892a4', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', background: '#090b10', borderBottom: '1px solid #1a1e29', padding: '0 24px' }}>
          <button
            className={`modal-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setAlertMsg(null); }}
            style={{ padding: '14px 20px', border: 'none', background: 'none', color: activeTab === 'overview' ? '#fff' : '#8892a4', fontWeight: 600, borderBottom: activeTab === 'overview' ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }}
          >
            📊 Fleet Overview
          </button>
          <button
            className={`modal-tab ${activeTab === 'plugins' ? 'active' : ''}`}
            onClick={() => { setActiveTab('plugins'); setAlertMsg(null); }}
            style={{ padding: '14px 20px', border: 'none', background: 'none', color: activeTab === 'plugins' ? '#fff' : '#8892a4', fontWeight: 600, borderBottom: activeTab === 'plugins' ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }}
          >
            📦 Plugin Hosting & Upload
          </button>
          <button
            className={`modal-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => { setActiveTab('users'); setAlertMsg(null); }}
            style={{ padding: '14px 20px', border: 'none', background: 'none', color: activeTab === 'users' ? '#fff' : '#8892a4', fontWeight: 600, borderBottom: activeTab === 'users' ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }}
          >
            👥 User Accounts & Verification ({users.length})
          </button>
          <button
            className={`modal-tab ${activeTab === 'downloads' ? 'active' : ''}`}
            onClick={() => { setActiveTab('downloads'); setAlertMsg(null); }}
            style={{ padding: '14px 20px', border: 'none', background: 'none', color: activeTab === 'downloads' ? '#fff' : '#8892a4', fontWeight: 600, borderBottom: activeTab === 'downloads' ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }}
          >
            📥 Download Audit Logs ({downloads.length})
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px', maxHeight: '72vh', overflowY: 'auto' }}>
          
          {alertMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '13px',
              background: alertMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 51, 68, 0.12)',
              color: alertMsg.type === 'success' ? '#34d399' : '#ff4d5e',
              border: `1px solid ${alertMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 51, 68, 0.3)'}`
            }}>
              {alertMsg.text}
            </div>
          )}

          {/* TAB 1: FLEET OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card" style={{ background: '#0e1017', border: '1px solid #1a1e29', padding: '18px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#8892a4', marginBottom: '6px' }}>TOTAL USERS</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff' }}>{stats.totalUsers || 0}</div>
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
                    ✓ {stats.verifiedUsers || 0} Verified
                  </div>
                </div>

                <div className="stat-card" style={{ background: '#0e1017', border: '1px solid #1a1e29', padding: '18px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#8892a4', marginBottom: '6px' }}>VERIFICATION PENDING</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#fbbf24' }}>{stats.unverifiedUsers || 0}</div>
                  <div style={{ fontSize: '11px', color: '#8892a4', marginTop: '4px' }}>Awaiting email check</div>
                </div>

                <div className="stat-card" style={{ background: '#0e1017', border: '1px solid #1a1e29', padding: '18px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#8892a4', marginBottom: '6px' }}>TOTAL PLUGINS</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff' }}>{stats.totalPlugins || 0}</div>
                  <div style={{ fontSize: '11px', color: '#8892a4', marginTop: '4px' }}>Hosted on disk</div>
                </div>

                <div className="stat-card" style={{ background: '#0e1017', border: '1px solid #1a1e29', padding: '18px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#8892a4', marginBottom: '6px' }}>UNIQUE DOWNLOADS</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff' }}>{stats.totalDownloads || 0}</div>
                  <div style={{ fontSize: '11px', color: '#8892a4', marginTop: '4px' }}>Per-account deduplicated</div>
                </div>
              </div>

              {/* Supabase status block */}
              <div style={{
                background: '#0e1017',
                border: '1px solid #1a1e29',
                borderRadius: '8px',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ fontSize: '24px' }}>⚡</div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                      Supabase Cloud Database & Authentication
                    </div>
                    <div style={{ fontSize: '12px', color: '#8892a4' }}>
                      Realtime synchronization active with automatic schema migration and PBKDF2 encryption.
                    </div>
                  </div>
                </div>
                <span className="badge badge-green" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                  CONNECTED
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PLUGIN HOSTING & JAR UPLOAD */}
          {activeTab === 'plugins' && (
            <div>
              {/* Direct JAR Upload Block */}
              <div style={{
                background: '#0e1017',
                border: '1px solid #1a1e29',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                  UPLOAD .JAR BINARY (SERVER STORAGE)
                </div>
                <div style={{ fontSize: '12px', color: '#8892a4', marginBottom: '16px' }}>
                  Upload binaries directly to server private storage (<code style={{ color: '#fff' }}>storage/plugins/</code>). Completely avoids GitHub repository and release links.
                </div>

                <form onSubmit={handleUploadJar} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '220px' }}>
                    <label className="form-label">Select Plugin</label>
                    <select
                      className="input-field"
                      value={uploadPluginId}
                      onChange={e => setUploadPluginId(e.target.value)}
                      required
                    >
                      {plugins.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: '2', minWidth: '240px' }}>
                    <label className="form-label">Choose .jar File</label>
                    <input
                      type="file"
                      accept=".jar,.zip"
                      className="input-field"
                      onChange={e => setUploadFile(e.target.files[0])}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploading}
                    style={{ height: '42px', padding: '0 24px', fontWeight: 700 }}
                  >
                    {uploading ? 'Uploading to Server...' : 'Upload .JAR'}
                  </button>
                </form>
              </div>

              {/* Published Plugins Table */}
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                CURRENT STORE CATALOG ({plugins.length})
              </div>
              <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table className="nexora-table">
                  <thead>
                    <tr>
                      <th>Plugin</th>
                      <th>Category</th>
                      <th>Version</th>
                      <th>Price</th>
                      <th>Downloads</th>
                      <th>Storage Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plugins.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: '#8892a4' }}>{p.id}</div>
                        </td>
                        <td>
                          <span className="badge badge-blue">{p.category}</span>
                        </td>
                        <td className="mono">{p.version}</td>
                        <td className="mono" style={{ color: '#fff', fontWeight: 700 }}>
                          ${Number(p.price || 0).toFixed(2)}
                        </td>
                        <td className="mono" style={{ color: '#fff' }}>{p.downloads || 0}</td>
                        <td>
                          <span className="badge badge-green">LOCAL DISK</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Changelog Form */}
              <div style={{
                background: '#0e1017',
                border: '1px solid #1a1e29',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                  PUBLISH UPDATE CHANGELOG
                </div>
                <div style={{ fontSize: '12px', color: '#8892a4', marginBottom: '16px' }}>
                  Adds an update notification to the user navbar bell and modal history.
                </div>

                <form onSubmit={handleAddChangelog}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label className="form-label">Plugin</label>
                      <select
                        className="input-field"
                        value={selectedPluginId}
                        onChange={e => setSelectedPluginId(e.target.value)}
                      >
                        {plugins.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Version</label>
                      <input
                        type="text"
                        className="input-field mono"
                        placeholder="1.0.1"
                        value={newChangelogVersion}
                        onChange={e => setNewChangelogVersion(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Title / Release Headline</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Heuristic Optimization"
                        value={newChangelogTitle}
                        onChange={e => setNewChangelogTitle(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label className="form-label">Release Notes (One item per line)</label>
                    <textarea
                      className="input-field mono"
                      rows={3}
                      placeholder="- Added Folia async packet pipeline&#10;- Fixed Reach raytrace false-positive on ping spike"
                      value={newChangelogNotes}
                      onChange={e => setNewChangelogNotes(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-secondary" style={{ fontWeight: 600 }}>
                    Publish Changelog
                  </button>
                </form>
              </div>

              {/* Add New Plugin Form */}
              <div style={{
                background: '#0e1017',
                border: '1px solid #1a1e29',
                borderRadius: '8px',
                padding: '20px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                  CREATE NEW PLUGIN PRODUCT
                </div>
                <form onSubmit={handleCreatePlugin}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label className="form-label">Plugin ID</label>
                      <input
                        type="text"
                        className="input-field mono"
                        placeholder="nexora-exploit-guard"
                        value={newPluginId}
                        onChange={e => setNewPluginId(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Display Name</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Nexora ExploitGuard"
                        value={newPluginName}
                        onChange={e => setNewPluginName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Category</label>
                      <select
                        className="input-field"
                        value={newPluginCategory}
                        onChange={e => setNewPluginCategory(e.target.value)}
                      >
                        <option value="Security">Security</option>
                        <option value="Administration">Administration</option>
                        <option value="Combat">Combat</option>
                        <option value="Utility">Utility</option>
                        <option value="Bundle">Bundle</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Price (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field mono"
                        value={newPluginPrice}
                        onChange={e => setNewPluginPrice(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <label className="form-label">Tagline</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="High-Performance Crash & Exploit Mitigator"
                      value={newPluginTagline}
                      onChange={e => setNewPluginTagline(e.target.value)}
                    />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label className="form-label">Description</label>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Detailed features, Folia support, permissions..."
                      value={newPluginDesc}
                      onChange={e => setNewPluginDesc(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary">
                    Create Plugin Entry
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: USER ACCOUNTS & EMAIL VERIFICATION */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                    REGISTERED USERS & VERIFICATION GATE
                  </div>
                  <div style={{ fontSize: '12px', color: '#8892a4' }}>
                    Manage user roles, verify emails with 1-click, top up wallet balances, or grant plugin access.
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={fetchAdminData} style={{ fontSize: '12px' }}>
                  ↻ Refresh
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="nexora-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email & Status</th>
                      <th>Role</th>
                      <th>Balance</th>
                      <th>Owned Plugins</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{u.username}</div>
                          <div style={{ fontSize: '10px', color: '#656e80' }}>ID: {u.id}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px', color: '#fff', marginBottom: '4px' }}>
                            {u.email || '<No Email>'}
                          </div>
                          {u.emailVerified ? (
                            <span className="badge badge-green" style={{ fontSize: '10px', padding: '2px 8px' }}>
                              VERIFIED ✓
                            </span>
                          ) : (
                            <span className="badge badge-yellow" style={{ fontSize: '10px', padding: '2px 8px' }}>
                              UNVERIFIED ⚠️
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'ADMIN' ? 'badge-red' : 'badge-blue'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="mono" style={{ color: '#fff', fontWeight: 700 }}>
                          ${Number(u.balance || 0).toFixed(2)}
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#8892a4' }}>
                            {(u.purchasedPlugins || []).length} plugins
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {/* Toggle email verification */}
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleToggleVerifyEmail(u.id)}
                              style={{
                                fontSize: '11px',
                                padding: '4px 8px',
                                borderColor: u.emailVerified ? '#333' : '#10b981',
                                color: u.emailVerified ? '#8892a4' : '#34d399'
                              }}
                              title="Toggle Email Verification"
                            >
                              {u.emailVerified ? 'Unverify' : '✓ Verify'}
                            </button>

                            {/* Add balance */}
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleAdjustBalance(u.id, 25.00)}
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                              title="Add $25 to user balance"
                            >
                              +$25
                            </button>

                            {/* Grant AntiCheat plugin */}
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleGrantPlugin(u.id, 'nexora-anticheat')}
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                              title="Grant AntiCheat plugin"
                            >
                              +AntiCheat
                            </button>

                            {/* Toggle Admin role */}
                            {u.username.toLowerCase() !== 'admin' && (
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleToggleRole(u.id, u.role)}
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                              >
                                {u.role === 'ADMIN' ? 'Demote' : 'Make Admin'}
                              </button>
                            )}

                            {/* Delete User */}
                            {u.username.toLowerCase() !== 'admin' && (
                              <button
                                className="btn btn-danger"
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DOWNLOAD AUDIT LOGS */}
          {activeTab === 'downloads' && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                UNIQUE DOWNLOAD AUDIT TRAIL
              </div>
              <div style={{ fontSize: '12px', color: '#8892a4', marginBottom: '16px' }}>
                Every download is uniquely deduplicated per user account per plugin file.
              </div>

              {downloads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8892a4', background: '#0e1017', borderRadius: '8px' }}>
                  No downloads recorded yet in this session.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="nexora-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Plugin ID</th>
                        <th>IP Address</th>
                        <th>Date & Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {downloads.map((d, idx) => (
                        <tr key={idx}>
                          <td className="mono" style={{ color: '#fff', fontWeight: 700 }}>{d.account}</td>
                          <td>
                            <span className="badge badge-blue">{d.pluginId}</span>
                          </td>
                          <td className="mono" style={{ color: '#8892a4' }}>{d.ip}</td>
                          <td style={{ color: '#8892a4', fontSize: '12px' }}>
                            {new Date(d.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
