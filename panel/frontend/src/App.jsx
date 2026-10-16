import React, { useState, useEffect } from 'react';
import { API_BASE } from './apiConfig';
import PluginDetailModal from './components/PluginDetailModal';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import {
  Shield, Sword, Settings, Package, Plug,
  Star, Download, Tag, Bell, Wallet,
  Crown, BookOpen, Store, LogOut, User,
  ChevronRight, Search, CheckCircle, AlertCircle,
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nexora_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [plugins, setPlugins] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Popups
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [viewFilter, setViewFilter] = useState('ALL'); // 'ALL' or 'MY_LIBRARY'

  useEffect(() => {
    fetchPlugins();
    fetchNotifications();
    if (user) {
      refreshUserSession();
    }
  }, []);

  const fetchPlugins = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plugins`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlugins(data);
      }
    } catch (err) {
      console.error('Failed to load plugins:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const refreshUserSession = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/me?username=${encodeURIComponent(user.username)}`);
      if (res.ok) {
        const freshUser = await res.json();
        setUser(freshUser);
        localStorage.setItem('nexora_user', JSON.stringify(freshUser));
      }
    } catch (err) {
      console.error('Failed to refresh user session:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nexora_user');
    setUser(null);
    setShowAdminPanel(false);
    setViewFilter('ALL');
  };

  const handlePurchaseSuccess = () => {
    refreshUserSession();
    fetchPlugins();
  };

  // Filter plugins by search, category, and Library view
  const filteredPlugins = plugins.filter(p => {
    if (viewFilter === 'MY_LIBRARY') {
      if (!user || !user.purchasedPlugins || !user.purchasedPlugins.includes(p.id)) {
        return false;
      }
    }

    if (selectedCategory !== 'ALL' && p.category.toUpperCase() !== selectedCategory.toUpperCase()) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchTagline = (p.tagline || '').toLowerCase().includes(q);
      const matchTags = (p.tags || []).some(t => t.toLowerCase().includes(q));
      return matchName || matchTagline || matchTags;
    }

    return true;
  });

  const categories = ['ALL', 'Security', 'Administration', 'Combat', 'Bundle'];

  // Lucide icon map by category
  const CATEGORY_ICONS = {
    security:       <Shield size={20} />,
    administration: <Settings size={20} />,
    combat:         <Sword size={20} />,
    bundle:         <Package size={20} />,
    default:        <Plug size={20} />,
  };
  const getPluginIcon = (plugin) => {
    const key = (plugin.category || '').toLowerCase();
    return CATEGORY_ICONS[key] || CATEGORY_ICONS.default;
  };

  return (
    <div>
      {/* Top Sticky Navigation */}
      <header className="site-header">
        <div className="nav-container">
          <div className="brand-logo" onClick={() => { setViewFilter('ALL'); setSelectedCategory('ALL'); }}>
            <img
              src="/logo.png"
              alt="Nexora Technologies Logo"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                objectFit: 'cover',
                boxShadow: '0 0 14px rgba(255, 255, 255, 0.18)'
              }}
            />
            <div>
              <div className="brand-text">NEXORA</div>
              <div style={{ fontSize: '9px', letterSpacing: '1px', color: '#8892a4', lineHeight: 1 }}>
                TECHNOLOGIES
              </div>
            </div>
            <span className="brand-badge">MARKETPLACE</span>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-link ${viewFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setViewFilter('ALL')}
            >
              <Store size={15} /> Store Catalog
            </button>
            <button
              className={`nav-link ${viewFilter === 'MY_LIBRARY' ? 'active' : ''}`}
              onClick={() => {
                if (!user) { setShowAuthModal(true); }
                else { setViewFilter('MY_LIBRARY'); }
              }}
            >
              <BookOpen size={15} /> My Library {user && user.purchasedPlugins ? `(${user.purchasedPlugins.length})` : ''}
            </button>
            <button
              className="nav-link"
              onClick={() => { if (plugins.length > 0) setSelectedPlugin(plugins[0]); }}
            >
              <Tag size={15} /> Changelogs
            </button>
          </nav>

          <div className="nav-actions">
            {/* Wallet Balance Pill */}
            {user && (
              <div className="wallet-pill">
                <Wallet size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="wallet-balance">${Number(user.balance || 0).toFixed(2)}</span>
                {user.emailVerified ? (
                  <span className="badge badge-green" style={{ fontSize: '10px', padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <CheckCircle size={10} /> VERIFIED
                  </span>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="badge badge-yellow"
                    style={{ fontSize: '10px', padding: '2px 7px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    title="Click to verify email"
                  >
                    <AlertCircle size={10} /> VERIFY
                  </button>
                )}
              </div>
            )}

            {/* Notification Bell */}
            <div className="notif-wrapper">
              <button
                className="notif-btn"
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                title="Updates & Changelogs"
              >
                <Bell size={16} />
                {notifications.length > 0 && <span className="notif-dot"></span>}
              </button>

              {showNotifDropdown && (
                <div className="notif-dropdown">
                  <div className="notif-header">LATEST RELEASES & UPDATES</div>
                  {notifications.slice(0, 4).map(n => (
                    <div
                      key={n.id}
                      className="notif-item"
                      onClick={() => {
                        const target = plugins.find(p => p.id === n.pluginId);
                        if (target) setSelectedPlugin(target);
                        setShowNotifDropdown(false);
                      }}
                    >
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-desc">{n.summary} · {n.date}</div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: '11px', padding: '4px' }}
                      onClick={() => setShowNotifDropdown(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User / Admin / Login */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {user.role === 'ADMIN' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: '#fff', fontWeight: 700 }}
                    onClick={() => setShowAdminPanel(true)}
                  >
                    <Crown size={13} /> Admin Panel
                  </button>
                )}
                <div style={{ textAlign: 'right', marginRight: '2px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{user.username}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{user.role}</div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleLogout}
                  title="Sign Out"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAuthModal(true)}
              >
                <User size={14} /> Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Showcase Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '14px' }}>
            <img
              src="/logo.png"
              alt="Nexora Logo"
              style={{ width: '40px', height: '40px', borderRadius: '10px', boxShadow: '0 0 25px rgba(255, 255, 255, 0.2)' }}
            />
            <span className="badge badge-green" style={{ fontSize: '11px', letterSpacing: '1px' }}>
              POWERED BY SUPABASE POSTGRESQL
            </span>
          </div>

          <h1 className="hero-title">
            ENTERPRISE MINECRAFT SOFTWARE
          </h1>
          <p className="hero-subtitle">
            Zero-restriction high-performance security plugins. Built for Folia, Paper & Purpur with local server binary hosting.
          </p>

          {/* Search bar */}
          <div className="hero-search-wrapper">
            <input
              type="text"
              className="hero-search-input"
              placeholder="Search plugins, heuristic vectors, folia tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Main Marketplace Content */}
      <main className="marketplace-container">
        
        {/* Category Filter Pills */}
        <div className="category-filter-bar">
          <div className="category-pills">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="plugin-count-label">
            Showing {filteredPlugins.length} {filteredPlugins.length === 1 ? 'Plugin' : 'Plugins'}
          </div>
        </div>

        {/* Plugin Grid */}
        {filteredPlugins.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <Package size={40} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="empty-state-title">No Plugins Found</div>
            <div className="empty-state-desc">
              {viewFilter === 'MY_LIBRARY'
                ? "You haven't acquired any plugins in your library yet."
                : 'No plugins match your search criteria.'}
            </div>
            {viewFilter === 'MY_LIBRARY' && (
              <button
                className="btn btn-secondary"
                style={{ marginTop: '16px' }}
                onClick={() => setViewFilter('ALL')}
              >
                Browse Store Catalog
              </button>
            )}
          </div>
        ) : (
          <div className="plugin-grid">
            {filteredPlugins.map(plugin => {
              const isOwned = user && Array.isArray(user.purchasedPlugins) && user.purchasedPlugins.includes(plugin.id);
              const isFree = Number(plugin.price) === 0;

              return (
                <div
                  key={plugin.id}
                  className="plugin-card"
                  onClick={() => setSelectedPlugin(plugin)}
                >
                  <div className="plugin-card-header">
                    <span className="plugin-icon">{getPluginIcon(plugin)}</span>
                    <span className="badge badge-blue">{plugin.category}</span>
                  </div>

                  <h3 className="plugin-title">{plugin.name}</h3>
                  <p className="plugin-tagline">{plugin.tagline}</p>

                  <div className="plugin-tags">
                    {(plugin.tags || []).slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="plugin-tag">#{tag}</span>
                    ))}
                  </div>

                  <div className="plugin-stats-row">
                    <span className="plugin-stat">
                      <Star size={12} fill="currentColor" style={{ color: '#facc15' }} />
                      <strong>{plugin.rating || '5.0'}</strong>
                    </span>
                    <span className="plugin-stat">
                      <Download size={12} />
                      <strong>{plugin.downloads || 0}</strong> dl
                    </span>
                    <span className="plugin-stat mono">
                      v{plugin.version}
                    </span>
                  </div>

                  <div className="plugin-card-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="plugin-price-tag">
                        {isFree ? 'FREE' : `$${Number(plugin.price).toFixed(2)}`}
                      </span>
                      {isOwned && (
                        <span className="badge badge-green" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <CheckCircle size={10} /> OWNED
                        </span>
                      )}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlugin(plugin);
                      }}
                    >
                      {isOwned || isFree ? 'Download' : 'View & Get'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals */}
      <PluginDetailModal
        plugin={selectedPlugin}
        isOpen={Boolean(selectedPlugin)}
        onClose={() => setSelectedPlugin(null)}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onPurchaseSuccess={handlePurchaseSuccess}
        onOpenLightbox={imgUrl => setLightboxImg(imgUrl)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={freshUser => {
          setUser(freshUser);
          refreshUserSession();
          fetchPlugins();
        }}
      />

      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
        user={user}
        onRefreshStore={() => {
          fetchPlugins();
          fetchNotifications();
          refreshUserSession();
        }}
      />

      {/* Fullscreen Lightbox for Review Images */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Enlarged preview" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
