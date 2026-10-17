import React, { useState, useEffect } from 'react';
import { API_BASE } from './apiConfig';
import PluginDetailModal from './components/PluginDetailModal';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import AccountSettingsModal from './components/AccountSettingsModal';
import PluginDetailPage from './components/PluginDetailPage';
import {
  Shield, Sword, Settings, Package, Plug,
  Star, Download, Tag, Bell, Wallet,
  Crown, BookOpen, Store, LogOut, User,
  ChevronRight, Search, CheckCircle, AlertCircle,
  Share2, ExternalLink
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('bayon_user') || localStorage.getItem('nexora_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentPath, setCurrentPath] = useState(() => {
    return (window.location.pathname || '/').toLowerCase();
  });

  const [plugins, setPlugins] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Modals & Popups
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [viewFilter, setViewFilter] = useState('ALL'); // 'ALL' or 'MY_LIBRARY'

  useEffect(() => {
    fetchPlugins();
    fetchNotifications();
    if (user) {
      refreshUserSession();
    }

    const handlePopState = () => {
      const pathname = (window.location.pathname || '/').toLowerCase();
      setCurrentPath(pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Deep linking: Auto-open modal if URL has ?plugin=plugin-id and not on /detail-plugin
  useEffect(() => {
    if (plugins.length > 0 && currentPath !== '/detail-plugin') {
      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get('plugin');
      if (targetId) {
        const found = plugins.find(p => p.id === targetId);
        if (found) {
          setSelectedPlugin(found);
        }
      }
    }
  }, [plugins, currentPath]);

  const handleSharePlugin = (plugin) => {
    if (!plugin) return;
    const shareUrl = `${window.location.origin}/detail-plugin?plugin=${encodeURIComponent(plugin.id)}`;
    
    if (navigator.share) {
      navigator.share({
        title: `${plugin.name} - Bayon Technologies`,
        text: `${plugin.name}: ${plugin.tagline}`,
        url: shareUrl,
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setToastMsg(`Copied share link for ${plugin.name}!`);
        setTimeout(() => setToastMsg(null), 3500);
      }).catch(() => {
        prompt('Copy plugin link:', shareUrl);
      });
    } else {
      prompt('Copy plugin link:', shareUrl);
    }
  };

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    const pathname = (path.split('?')[0] || '/').toLowerCase();
    setCurrentPath(pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        localStorage.setItem('bayon_user', JSON.stringify(freshUser));
        localStorage.setItem('nexora_user', JSON.stringify(freshUser));
      }
    } catch (err) {
      console.error('Failed to refresh user session:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bayon_user');
    localStorage.removeItem('nexora_user');
    setUser(null);
    setShowAdminPanel(false);
    setViewFilter('ALL');
  };

  const handlePurchaseSuccess = () => {
    refreshUserSession();
    fetchPlugins();
  };

  // -------------------------------------------------------------
  // DEDICATED /admin-panel PAGE ROUTE
  // -------------------------------------------------------------
  if (currentPath === '/admin-panel' || currentPath === '/admin') {
    if (user && user.role === 'ADMIN') {
      return (
        <AdminPanel
          isOpen={true}
          isStandalone={true}
          user={user}
          onNavigateHome={() => navigateTo('/')}
          onLogout={() => {
            handleLogout();
            navigateTo('/');
          }}
          onRefreshStore={() => {
            fetchPlugins();
            fetchNotifications();
            refreshUserSession();
          }}
        />
      );
    }

    return (
      <AdminLogin
        onLoginSuccess={(freshAdmin) => {
          setUser(freshAdmin);
          refreshUserSession();
        }}
        onReturnHome={() => navigateTo('/')}
      />
    );
  }

  // -------------------------------------------------------------
  // DEDICATED /detail-plugin PAGE ROUTE
  // -------------------------------------------------------------
  if (currentPath === '/detail-plugin') {
    const urlParams = new URLSearchParams(window.location.search);
    const targetId = urlParams.get('plugin');
    const detailPlugin = (targetId ? plugins.find(p => p.id === targetId) : null) || selectedPlugin || plugins[0];

    return (
      <PluginDetailPage
        plugin={detailPlugin}
        plugins={plugins}
        user={user}
        onNavigateHome={() => navigateTo('/')}
        onOpenAuth={() => setShowAuthModal(true)}
        onPurchaseSuccess={handlePurchaseSuccess}
        onOpenLightbox={imgUrl => setLightboxImg(imgUrl)}
        onSharePlugin={handleSharePlugin}
      />
    );
  }

  // -------------------------------------------------------------
  // PUBLIC STORE CATALOG VIEW (/)
  // -------------------------------------------------------------

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
              alt="Bayon Technologies Logo"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 0 14px rgba(255, 255, 255, 0.18)'
              }}
            />
            <div>
              <div className="brand-text">BAYON</div>
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
                    style={{ borderColor: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => navigateTo('/admin-panel')}
                    title="Open Standalone Admin Portal"
                  >
                    <Crown size={13} /> Admin Panel
                  </button>
                )}
                <button
                  onClick={() => setShowAccountSettings(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Account Settings & Profile"
                >
                  <img
                    src={`https://mc-heads.net/avatar/${encodeURIComponent(user.username)}/32`}
                    alt={user.username}
                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{user.username}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{user.role}</div>
                  </div>
                </button>
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
              alt="Bayon Logo"
              style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'contain', boxShadow: '0 0 25px rgba(255, 255, 255, 0.2)' }}
            />
            <span className="badge badge-green" style={{ fontSize: '11px', letterSpacing: '1px' }}>
              POWERED BY SHOTDI • 24/7 ONLINE
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '7px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        title="Share plugin link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSharePlugin(plugin);
                        }}
                      >
                        <Share2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '7px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        title="Open Dedicated Full Page"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateTo(`/detail-plugin?plugin=${encodeURIComponent(plugin.id)}`);
                        }}
                      >
                        <ExternalLink size={13} />
                      </button>
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
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '40px 28px', marginTop: '50px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo.png" alt="Bayon Logo" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
                BAYON TECHNOLOGIES
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Powered by ShotDi Core · Private Binary Infrastructure
              </div>
            </div>
          </div>

          {/* Social Media Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href="https://discord.gg"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                textDecoration: 'none',
                transition: 'color 0.2s',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#5865F2'; e.currentTarget.style.borderColor = 'rgba(88,101,242,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Discord</span>
            </a>

            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                textDecoration: 'none',
                transition: 'color 0.2s',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#FF0000'; e.currentTarget.style.borderColor = 'rgba(255,0,0,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span>YouTube</span>
            </a>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                textDecoration: 'none',
                transition: 'color 0.2s',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </a>

            <a
              href="https://t.me"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                textDecoration: 'none',
                transition: 'color 0.2s',
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#229ED9'; e.currentTarget.style.borderColor = 'rgba(34,158,217,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.536-.196 1.006.128.832.942z"/>
              </svg>
              <span>Telegram</span>
            </a>

            <button
              onClick={() => navigateTo('/admin-panel')}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'var(--text-muted)',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontFamily: 'inherit',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
            >
              <Crown size={12} />
              <span>Operator</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PluginDetailModal
        plugin={selectedPlugin}
        isOpen={Boolean(selectedPlugin)}
        onClose={() => setSelectedPlugin(null)}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onPurchaseSuccess={handlePurchaseSuccess}
        onOpenLightbox={imgUrl => setLightboxImg(imgUrl)}
        onSharePlugin={handleSharePlugin}
        onOpenDetailPage={(p) => {
          setSelectedPlugin(null);
          navigateTo(`/detail-plugin?plugin=${encodeURIComponent(p.id)}`);
        }}
      />

      <AccountSettingsModal
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
        user={user}
        onUpdateUser={(updatedUser) => {
          setUser(updatedUser);
          localStorage.setItem('bayon_user', JSON.stringify(updatedUser));
          localStorage.setItem('nexora_user', JSON.stringify(updatedUser));
        }}
        onLogout={handleLogout}
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

      {/* Fullscreen Lightbox for Review Images */}
      {lightboxImg && (
        <div className="lightbox-overlay" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Enlarged preview" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Floating Share / Alert Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#00e599',
          color: '#050505',
          padding: '12px 20px',
          borderRadius: '8px',
          fontWeight: 700,
          fontSize: '13px',
          boxShadow: '0 8px 30px rgba(0, 229, 153, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 9999
        }}>
          <CheckCircle size={16} />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
