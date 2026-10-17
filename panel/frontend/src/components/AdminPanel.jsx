import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';
import {
  X, LayoutDashboard, Package, Users,
  Download, MessageSquare, Star, Trash2,
  CheckCircle, AlertCircle, RefreshCw, Upload,
  Plus, Check, ArrowRight, Shield, Zap,
  ExternalLink, Search, UserCheck, DollarSign,
  Store, LogOut, ThumbsUp, Edit
} from 'lucide-react';

export default function AdminPanel({
  isOpen = true,
  onClose,
  user,
  onRefreshStore,
  isStandalone = false,
  onNavigateHome,
  onLogout
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'plugins', 'users', 'reviews', 'downloads'
  const [stats, setStats] = useState({ totalUsers: 0, verifiedUsers: 0, unverifiedUsers: 0, totalPlugins: 0, totalDownloads: 0, totalReviews: 0 });
  const [plugins, setPlugins] = useState([]);
  const [users, setUsers] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [alertMsg, setAlertMsg] = useState(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [selectedReviewImage, setSelectedReviewImage] = useState(null);

  // New Plugin Form state
  const [newPluginId, setNewPluginId] = useState('');
  const [newPluginName, setNewPluginName] = useState('');
  const [newPluginPrice, setNewPluginPrice] = useState(9.99);
  const [newPluginTagline, setNewPluginTagline] = useState('');
  const [newPluginDesc, setNewPluginDesc] = useState('');
  const [newPluginVersion, setNewPluginVersion] = useState('1.0.0');
  const [newPluginCategory, setNewPluginCategory] = useState('Security');
  const [newPluginLogo, setNewPluginLogo] = useState('');
  const [newPluginBanner, setNewPluginBanner] = useState('');

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
  const [grantPluginId, setGrantPluginId] = useState('bayon-anticheat');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, plugRes, userRes, dlRes, revRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats`),
        fetch(`${API_BASE}/api/plugins`),
        fetch(`${API_BASE}/api/admin/users`),
        fetch(`${API_BASE}/api/admin/downloads`),
        fetch(`${API_BASE}/api/admin/reviews`)
      ]);
      const [sD, pD, uD, dD, rD] = await Promise.all([
        statsRes.json(),
        plugRes.json(),
        userRes.json(),
        dlRes.json(),
        revRes.json()
      ]);
      setStats(sD || {});
      setPlugins(Array.isArray(pD) ? pD : []);
      setUsers(Array.isArray(uD) ? uD : []);
      setDownloads(Array.isArray(dD) ? dD : []);
      setReviews(Array.isArray(rD) ? rD : []);

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
          category: newPluginCategory,
          logoUrl: newPluginLogo,
          bannerUrl: newPluginBanner
        })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: `Plugin "${newPluginName}" saved successfully!` });
        setNewPluginId('');
        setNewPluginName('');
        setNewPluginTagline('');
        setNewPluginDesc('');
        setNewPluginLogo('');
        setNewPluginBanner('');
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to save plugin.' });
    }
  };

  const handleEditPlugin = (p) => {
    setNewPluginId(p.id);
    setNewPluginName(p.name);
    setNewPluginPrice(p.price || 0);
    setNewPluginTagline(p.tagline || '');
    setNewPluginDesc(p.description || '');
    setNewPluginVersion(p.version || '1.0.0');
    setNewPluginCategory(p.category || 'Security');
    setNewPluginLogo(p.logoUrl || (p.id === 'bayon-anticheat' ? '/logo.png' : ''));
    setNewPluginBanner(p.bannerUrl || (Array.isArray(p.screenshots) && p.screenshots.length > 0 ? p.screenshots[0] : ''));
    setAlertMsg({ type: 'success', text: `Loaded "${p.name}" into editor below. Update details and click Save.` });
  };

  const handleDeletePlugin = async (pluginId, pluginName) => {
    if (!window.confirm(`Are you sure you want to permanently remove product "${pluginName}" (${pluginId}) from the store catalog? This will delete its file and remove it from the catalog.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/plugins/${pluginId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlertMsg({ type: 'success', text: data.message || `Product "${pluginName}" removed.` });
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to remove plugin.' });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Network error deleting plugin product.' });
    }
  };

  const handleRenameCategory = async (oldName) => {
    const newName = window.prompt(`Rename category "${oldName}" to:`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/categories/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: newName.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to rename category.' });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Network error renaming category.' });
    }
  };

  const handleDeleteCategory = async (catName) => {
    if (!window.confirm(`Delete category "${catName}"? All plugins in this category will be reassigned to "General".`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/categories/${encodeURIComponent(catName)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to delete category.' });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Network error deleting category.' });
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

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this community review?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${reviewId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: 'Review removed and rating recalculated.' });
        fetchAdminData();
        if (onRefreshStore) onRefreshStore();
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to delete review.' });
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (!reviewSearch.trim()) return true;
    const q = reviewSearch.toLowerCase();
    return (
      (r.username || '').toLowerCase().includes(q) ||
      (r.comment || '').toLowerCase().includes(q) ||
      (r.pluginName || '').toLowerCase().includes(q) ||
      (r.pluginId || '').toLowerCase().includes(q)
    );
  });

  const content = (
    <div
      className={isStandalone ? "admin-standalone-page" : "modal-card"}
      onClick={e => e.stopPropagation()}
      style={isStandalone ? {} : {
        maxWidth: '1240px',
        width: '96%',
        height: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 70px rgba(0, 0, 0, 0.95)'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 28px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/logo.png"
            alt="Bayon Logo"
            style={{ width: '42px', height: '42px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>BAYON ADMINISTRATOR PANEL</span>
              <span className="badge badge-red" style={{ fontSize: '10px' }}>ROOT ACCESS</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span>Server Local Storage</span>
              <span>•</span>
              <span>Powered by ShotDi</span>
              <span>•</span>
              <span>Zero License Enforcement</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchAdminData}
            className="btn btn-secondary btn-sm"
            title="Refresh admin telemetry"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

          {isStandalone && onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="btn btn-secondary btn-sm"
              title="Return to Public Store Catalog"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Store size={14} />
              <span>Back to Store</span>
            </button>
          )}

          {isStandalone && onLogout && (
            <button
              onClick={onLogout}
              className="btn btn-danger btn-sm"
              title="Sign Out of Admin Panel"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          )}

          {!isStandalone && onClose && (
            <button
              className="modal-close"
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        background: '#07090e',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 28px',
        overflowX: 'auto',
        flexShrink: 0
      }}>
        <button
          className={`modal-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => { setActiveTab('overview'); setAlertMsg(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <LayoutDashboard size={15} />
          <span>Overview</span>
        </button>
        <button
          className={`modal-tab ${activeTab === 'plugins' ? 'active' : ''}`}
          onClick={() => { setActiveTab('plugins'); setAlertMsg(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Package size={15} />
          <span>Plugin Hosting & Products</span>
        </button>
        <button
          className={`modal-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => { setActiveTab('users'); setAlertMsg(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Users size={15} />
          <span>User Accounts ({users.length})</span>
        </button>
        <button
          className={`modal-tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => { setActiveTab('reviews'); setAlertMsg(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <MessageSquare size={15} />
          <span>Real Reviews & Feedback ({reviews.length})</span>
        </button>
        <button
          className={`modal-tab ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => { setActiveTab('downloads'); setAlertMsg(null); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Download size={15} />
          <span>Download Audit Logs ({downloads.length})</span>
        </button>
      </div>

      {/* Body Content */}
      <div
        className="modal-body"
        style={{
          padding: '24px 28px',
          flex: 1,
          overflowY: 'auto',
          maxWidth: isStandalone ? '1300px' : 'none',
          margin: isStandalone ? '0 auto' : 0,
          width: isStandalone ? '100%' : 'auto'
        }}
      >
        
        {alertMsg && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '13px',
            background: alertMsg.type === 'success' ? 'rgba(0, 229, 153, 0.12)' : 'rgba(255, 51, 68, 0.12)',
            color: alertMsg.type === 'success' ? '#00e599' : '#ff4d5e',
            border: `1px solid ${alertMsg.type === 'success' ? 'rgba(0, 229, 153, 0.3)' : 'rgba(255, 51, 68, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>{alertMsg.text}</span>
            <button
              onClick={() => setAlertMsg(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* TAB 1: FLEET OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="stat-card">
                <div className="stat-lbl">Registered Users</div>
                <div className="stat-val">{stats.totalUsers || 0}</div>
                <div style={{ fontSize: '11px', color: '#00e599', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={12} />
                  <span>{stats.verifiedUsers || 0} Verified</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-lbl">Pending Verification</div>
                <div className="stat-val" style={{ color: '#fbbf24' }}>{stats.unverifiedUsers || 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  <span>Awaiting email check</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-lbl">Active Store Plugins</div>
                <div className="stat-val">{stats.totalPlugins || 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Hosted in server local storage
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-lbl">Real Unique Downloads</div>
                <div className="stat-val">{stats.totalDownloads || 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  1 account per file counted
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-lbl">Community Reviews</div>
                <div className="stat-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{reviews.length}</span>
                  <Star size={18} fill="currentColor" style={{ color: '#facc15' }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Real player feedback & telemetry
                </div>
              </div>
            </div>

            {/* Per-Plugin Real Downloads Overview Table with Remove Action */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={16} />
                  <span>Real Unique Downloads Per Plugin</span>
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Total Catalog: {plugins.length} Products
                </span>
              </div>

              <div className="table-container">
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>Plugin Name</th>
                      <th>Category</th>
                      <th>Version</th>
                      <th>Unique Account Downloads</th>
                      <th>Pricing</th>
                      <th>Direct Download Endpoint</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plugins.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700, color: '#fff' }}>{p.name}</td>
                        <td><span className="badge badge-blue">{p.category}</span></td>
                        <td className="mono">v{p.version}</td>
                        <td>
                          <span style={{ fontWeight: 800, color: '#00e599', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                            {p.downloads || 0}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>accounts</span>
                        </td>
                        <td className="mono">{Number(p.price) === 0 ? 'FREE' : `$${Number(p.price).toFixed(2)}`}</td>
                        <td>
                          <code style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                            /api/plugins/{p.id}/download
                          </code>
                        </td>
                        <td>
                          <button
                            onClick={() => handleDeletePlugin(p.id, p.name)}
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title={`Remove product ${p.name}`}
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Security & System Info */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} />
                <span>Deployment Architecture & 24/7 Service</span>
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                All plugin binaries are stored directly on private server storage (`storage/plugins/`). When users click Download, files are streamed directly via secure Node.js streams without exposing your GitHub repository. The 24/7 background keep-alive ping ensures continuous active online service.
              </p>
              <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                <span>Storage: storage/plugins/</span>
                <span>•</span>
                <span>Engine: Powered by ShotDi Core</span>
                <span>•</span>
                <span>Keep-Alive: Active (8-min self-ping)</span>
                <span>•</span>
                <span>Auth: Salted PBKDF2</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLUGINS & JAR UPLOAD */}
        {activeTab === 'plugins' && (
          <div>
            {/* Category Management Bar */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                    Category Manager
                  </h4>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Rename or remove store categories across all products
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {[...new Set(plugins.map(p => p.category || 'General'))].map(cat => {
                  const count = plugins.filter(p => (p.category || 'General').toLowerCase() === cat.toLowerCase()).length;
                  return (
                    <div
                      key={cat}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-bright)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#fff' }}>{cat}</span>
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({count})</span>
                      <button
                        type="button"
                        onClick={() => handleRenameCategory(cat)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#00e599',
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: '0 4px',
                          textDecoration: 'underline'
                        }}
                        title={`Rename category ${cat}`}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff4d5e',
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: '0 4px'
                        }}
                        title={`Delete category ${cat}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Catalog Management: Current Products & Remove action */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={16} />
                    <span>Current Products Catalog & Product Removal</span>
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Manage published plugins. Removing a product removes it from the catalog, deletes its reviews, and removes its JAR file.
                  </p>
                </div>
                <span className="badge badge-green">{plugins.length} Active Products</span>
              </div>

              <div className="table-container">
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Slug (ID)</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Version</th>
                      <th>Downloads</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plugins.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#fff' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.tagline}</div>
                        </td>
                        <td className="mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{p.id}</td>
                        <td><span className="badge badge-blue">{p.category}</span></td>
                        <td className="mono" style={{ fontWeight: 700 }}>{Number(p.price) === 0 ? 'FREE' : `$${Number(p.price).toFixed(2)}`}</td>
                        <td className="mono">v{p.version}</td>
                        <td className="mono">{p.downloads || 0}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleEditPlugin(p)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title={`Edit details, logo and images for ${p.name}`}
                            >
                              <Edit size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => { setUploadPluginId(p.id); setSelectedPluginId(p.id); }}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', padding: '4px 8px' }}
                              title="Select for JAR upload"
                            >
                              <Upload size={12} />
                            </button>
                            <button
                              onClick={() => handleDeletePlugin(p.id, p.name)}
                              className="btn btn-danger btn-sm"
                              style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title={`Permanently remove product ${p.name}`}
                            >
                              <Trash2 size={12} />
                              <span>Remove</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* JAR Binary Uploader */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} />
                <span>Upload Local Plugin Binary (.jar)</span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Directly upload compiled JAR artifacts to private disk storage. Replaces the file served when users download this plugin.
              </p>

              <form onSubmit={handleUploadJar} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '12px', alignItems: 'flex-end' }}>
                <div>
                  <label className="form-label">Target Plugin</label>
                  <select
                    className="input-field"
                    value={uploadPluginId}
                    onChange={e => setUploadPluginId(e.target.value)}
                  >
                    {plugins.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Select .jar File from Computer</label>
                  <input
                    type="file"
                    accept=".jar,.zip"
                    className="input-field"
                    style={{ padding: '7px 12px' }}
                    onChange={e => setUploadFile(e.target.files[0])}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || !uploadFile}
                  style={{ height: '42px', marginBottom: '12px' }}
                >
                  {uploading ? 'Uploading...' : 'Save to Server Disk'}
                </button>
              </form>
            </div>

            {/* Create Plugin Form */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} />
                <span>Register New Plugin into Store Catalog</span>
              </h3>

              <form onSubmit={handleCreatePlugin}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label className="form-label">Plugin ID (slug)</label>
                    <input
                      className="input-field mono"
                      placeholder="e.g. bayon-dupe-fixer"
                      value={newPluginId}
                      onChange={e => setNewPluginId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Display Name</label>
                    <input
                      className="input-field"
                      placeholder="e.g. Bayon Dupe Fixer"
                      value={newPluginName}
                      onChange={e => setNewPluginName(e.target.value)}
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
                      <option value="Combat">Combat</option>
                      <option value="Administration">Administration</option>
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
                    />
                  </div>
                  <div>
                    <label className="form-label">Version</label>
                    <input
                      className="input-field mono"
                      value={newPluginVersion}
                      onChange={e => setNewPluginVersion(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label className="form-label">Plugin Logo URL</label>
                    <input
                      className="input-field"
                      placeholder="e.g. /logo.png or https://.../icon.png"
                      value={newPluginLogo}
                      onChange={e => setNewPluginLogo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Detail / Banner Preview Image URL</label>
                    <input
                      className="input-field"
                      placeholder="e.g. https://images.unsplash.com/... (shown on card & detail)"
                      value={newPluginBanner}
                      onChange={e => setNewPluginBanner(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">Short Tagline</label>
                  <input
                    className="input-field"
                    placeholder="One sentence description for the store card"
                    value={newPluginTagline}
                    onChange={e => setNewPluginTagline(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Full Product Description</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '90px' }}
                    placeholder="Detailed features, Folia support, permissions, commands, heuristic checks..."
                    value={newPluginDesc}
                    onChange={e => setNewPluginDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    {plugins.some(p => p.id === newPluginId) ? 'Save & Update Plugin Details' : 'Create Plugin Entry'}
                  </button>
                  {newPluginId && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setNewPluginId('');
                        setNewPluginName('');
                        setNewPluginTagline('');
                        setNewPluginDesc('');
                        setNewPluginLogo('');
                        setNewPluginBanner('');
                      }}
                    >
                      Clear Form
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Publish Changelog */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} />
                <span>Publish New Changelog & Release Announcement</span>
              </h3>

              <form onSubmit={handleAddChangelog}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', marginBottom: '12px' }}>
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
                    <label className="form-label">Release Version</label>
                    <input
                      className="input-field mono"
                      placeholder="e.g. 1.3.1"
                      value={newChangelogVersion}
                      onChange={e => setNewChangelogVersion(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Release Title</label>
                    <input
                      className="input-field"
                      placeholder="e.g. Folia 1.21.4 Compatibility Patch"
                      value={newChangelogTitle}
                      onChange={e => setNewChangelogTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Release Notes (one bullet per line)</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '80px' }}
                    placeholder="Fixed False Positive on Elytra glide&#10;Added Paper Folia region scheduler&#10;Reduced memory footprint by 15%"
                    value={newChangelogNotes}
                    onChange={e => setNewChangelogNotes(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-sm">
                  Publish Release & Push Notification
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: USER ACCOUNTS & VERIFICATION */}
        {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Total registered accounts: <strong style={{ color: '#fff' }}>{users.length}</strong> (Verified: <strong style={{ color: '#00e599' }}>{users.filter(u => u.emailVerified).length}</strong>)
              </div>
            </div>

            <div className="table-container">
              <table className="tech-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Verification</th>
                    <th>Role</th>
                    <th>Balance</th>
                    <th>Library</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700, color: '#fff' }}>{u.username}</td>
                      <td className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email || '—'}</td>
                      <td>
                        {u.emailVerified ? (
                          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={11} /> VERIFIED
                          </span>
                        ) : (
                          <span className="badge badge-yellow" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={11} /> UNVERIFIED
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleRole(u.id, u.role)}
                          className={`badge ${u.role === 'ADMIN' ? 'badge-red' : 'badge-blue'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="Click to toggle role"
                        >
                          {u.role}
                        </button>
                      </td>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        ${Number(u.balance || 0).toFixed(2)}
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {(u.purchasedPlugins || []).length} owned
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleToggleVerifyEmail(u.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                          >
                            {u.emailVerified ? 'Unverify' : 'Verify'}
                          </button>
                          <button
                            onClick={() => handleAdjustBalance(u.id, 25)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            title="Add $25 to balance"
                          >
                            +$25
                          </button>
                          <button
                            onClick={() => handleGrantPlugin(u.id, grantPluginId)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            title={`Grant ${grantPluginId}`}
                          >
                            Grant AntiCheat
                          </button>
                          {u.username !== 'admin' && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="btn btn-danger btn-sm"
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                            >
                              <Trash2 size={12} />
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

        {/* TAB 4: REAL REVIEWS & COMMUNITY FEEDBACK */}
        {activeTab === 'reviews' && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                  Community Reviews & Telemetry Feedback
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Real ratings, feedback comments, and proof screenshots submitted by players and server owners.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search reviews by user or plugin..."
                    value={reviewSearch}
                    onChange={e => setReviewSearch(e.target.value)}
                    style={{ paddingLeft: '32px', marginBottom: 0, minWidth: '260px' }}
                  />
                </div>
              </div>
            </div>

            {filteredReviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <MessageSquare size={36} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>No Reviews Found</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Reviews posted by customers via the plugin detail page will appear here.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {filteredReviews.map(r => (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      {/* Header: User + Plugin Badge */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{r.username}</div>
                          <span className="badge badge-blue" style={{ fontSize: '10px', marginTop: '4px' }}>
                            {r.pluginName || r.pluginId}
                          </span>
                        </div>
                        
                        <button
                          onClick={() => handleDeleteReview(r.id)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 8px' }}
                          title="Delete / Moderate Review"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Star Rating */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '10px' }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star
                            key={s}
                            size={14}
                            fill={s <= r.rating ? '#facc15' : 'none'}
                            style={{ color: s <= r.rating ? '#facc15' : '#374151' }}
                          />
                        ))}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', fontFamily: 'var(--font-mono)' }}>
                          {r.rating}.0 / 5.0
                        </span>
                      </div>

                      {/* Comment text */}
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                        "{r.comment}"
                      </p>

                      {/* Attached Image Thumbnail */}
                      {r.imageUrl && (
                        <div style={{ marginBottom: '12px' }}>
                          <img
                            src={r.imageUrl}
                            alt="Review proof"
                            onClick={() => setSelectedReviewImage(r.imageUrl)}
                            style={{
                              width: '100%',
                              maxHeight: '140px',
                              objectFit: 'cover',
                              borderRadius: '6px',
                              border: '1px solid var(--border-bright)',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', textAlign: 'right' }}>
                            Click image to enlarge
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{
                      paddingTop: '10px',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>{new Date(r.createdAt || Date.now()).toLocaleDateString()}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#00e599' }}>
                          <ThumbsUp size={11} /> {r.likes || 0}
                        </span>
                      </div>
                      <span style={{ color: '#00e599' }}>Verified Customer</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DOWNLOAD AUDIT LOGS */}
        {activeTab === 'downloads' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Total logged downloads: <strong style={{ color: '#fff' }}>{downloads.length}</strong>
              </div>
            </div>

            {downloads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                No download events recorded yet.
              </div>
            ) : (
              <div className="table-container">
                <table className="tech-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Plugin</th>
                      <th>User Account / IP</th>
                      <th>Client IP</th>
                      <th>User Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downloads.map(d => (
                      <tr key={d.id}>
                        <td className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(d.timestamp).toLocaleString()}
                        </td>
                        <td>
                          <span className="badge badge-blue">{d.pluginId}</span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>
                          {d.account ? d.account.replace(/^user_/, '@') : 'anonymous'}
                        </td>
                        <td className="mono" style={{ fontSize: '12px' }}>{d.ip}</td>
                        <td style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.userAgent}
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

      {/* Lightbox for review screenshots */}
      {selectedReviewImage && (
        <div
          className="lightbox-overlay"
          onClick={() => setSelectedReviewImage(null)}
          style={{ zIndex: 3000 }}
        >
          <img
            src={selectedReviewImage}
            alt="Enlarged screenshot"
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );

  if (isStandalone) {
    return content;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      {content}
    </div>
  );
}
