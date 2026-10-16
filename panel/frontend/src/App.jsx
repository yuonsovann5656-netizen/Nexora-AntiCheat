import React, { useState, useEffect } from 'react';
import { API_BASE } from './apiConfig';
import KHQRModal from './components/KHQRModal';
import PluginDetailModal from './components/PluginDetailModal';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';

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
  const [showKHQRModal, setShowKHQRModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState(10.00);
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

  const handleOpenDeposit = (suggestedAmt = 10.00) => {
    setDepositAmount(Number(suggestedAmt) || 10.00);
    setShowKHQRModal(true);
  };

  const handlePurchaseSuccess = (data) => {
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

  return (
    <div>
      {/* Top Sticky Navigation */}
      <header className="site-header">
        <div className="nav-container">
          <div className="brand-logo" onClick={() => { setViewFilter('ALL'); setSelectedCategory('ALL'); }}>
            <div className="brand-icon">⚡</div>
            <div>
              <div className="brand-text">NEXORA</div>
            </div>
            <span className="brand-badge">MARKETPLACE</span>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-link ${viewFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setViewFilter('ALL')}
            >
              Store Catalog
            </button>
            <button
              className={`nav-link ${viewFilter === 'MY_LIBRARY' ? 'active' : ''}`}
              onClick={() => {
                if (!user) {
                  setShowAuthModal(true);
                } else {
                  setViewFilter('MY_LIBRARY');
                }
              }}
            >
              My Library {user && user.purchasedPlugins ? `(${user.purchasedPlugins.length})` : ''}
            </button>
            <button
              className="nav-link"
              onClick={() => {
                if (plugins.length > 0) setSelectedPlugin(plugins[0]);
              }}
            >
              Changelogs
            </button>
            <a
              href="https://github.com/yuonsovann5656-netizen/Nexora-AntiCheat"
              target="_blank"
              rel="noreferrer"
              className="nav-link"
            >
              Source & Docs ↗
            </a>
          </nav>

          <div className="nav-actions">
            {/* Wallet Balance Pill */}
            {user ? (
              <div className="wallet-pill">
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>WALLET:</span>
                <span className="wallet-balance">${Number(user.balance || 0).toFixed(2)}</span>
                <button
                  className="btn-deposit-quick"
                  onClick={() => handleOpenDeposit(10.00)}
                >
                  + KHQR Deposit
                </button>
              </div>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenDeposit(10.00)}
              >
                ⚡ KHQR Deposit
              </button>
            )}

            {/* Notification Bell with Update Badges */}
            <div className="notif-wrapper">
              <button
                className="notif-btn"
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                title="Updates & Changelogs"
              >
                🔔
                {notifications.length > 0 && <span className="notif-dot"></span>}
              </button>

              {showNotifDropdown && (
                <div className="notif-dropdown">
                  <div className="notif-header">LATEST UPDATES & RELEASES</div>
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
                      <div className="notif-desc">{n.summary} • {n.date}</div>
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

            {/* User Profile / Admin / Login */}
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {user.role === 'ADMIN' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: '#fff' }}
                    onClick={() => setShowAdminPanel(true)}
                  >
                    👑 Admin Panel
                  </button>
                )}
                <div style={{ textAlign: 'right', marginRight: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{user.username}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{user.role}</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleLogout}
                  title="Sign Out"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAuthModal(true)}
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="hero-section">
        <div className="hero-tag">
          HIGH-PERFORMANCE MINECRAFT PLUGINS • FOLIA & PAPER READY
        </div>
        <h1 className="hero-title">
          SECURE. OPTIMIZE. ELEVATE.<br />
          YOUR MINECRAFT FLEET.
        </h1>
        <p className="hero-desc">
          Browse enterprise-grade Minecraft server plugins, behavioral anti-cheat systems,
          and moderation tools with instantaneous .JAR delivery and real KHQR deposits.
        </p>
      </section>

      {/* Filter & Search Bar */}
      <div className="filter-bar">
        <div className="category-pills">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => { setSelectedCategory(cat); setViewFilter('ALL'); }}
            >
              {cat === 'ALL' ? 'All Plugins' : cat}
            </button>
          ))}
          {user && (
            <button
              className={`category-pill ${viewFilter === 'MY_LIBRARY' ? 'active' : ''}`}
              onClick={() => setViewFilter(viewFilter === 'MY_LIBRARY' ? 'ALL' : 'MY_LIBRARY')}
              style={{ borderColor: '#fff' }}
            >
              📦 My Purchased Library
            </button>
          )}
        </div>

        <input
          type="text"
          className="search-input"
          placeholder="Search by plugin name, feature, or tag..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Store Catalog Grid */}
      <main className="plugin-grid">
        {filteredPlugins.length > 0 ? (
          filteredPlugins.map(p => {
            const isOwned = user && Array.isArray(user.purchasedPlugins) && user.purchasedPlugins.includes(p.id);
            const isFree = Number(p.price) === 0;

            return (
              <div key={p.id} className="plugin-card">
                <div className="plugin-header">
                  <div className="plugin-icon">{p.icon}</div>
                  <div className="plugin-price-tag">
                    {isFree ? 'FREE' : `$${Number(p.price).toFixed(2)}`}
                  </div>
                </div>

                <h3 className="plugin-name">{p.name}</h3>
                <p className="plugin-tagline">{p.tagline || p.description}</p>

                <div className="plugin-meta">
                  <span className="plugin-rating">⭐ {p.rating || '5.0'}</span>
                  <span>•</span>
                  <span>{p.downloads || 0} downloads</span>
                  <span>•</span>
                  <span className="brand-badge">v{p.version}</span>
                </div>

                <div className="plugin-tags">
                  {(p.tags || []).slice(0, 4).map((t, idx) => (
                    <span key={idx} className="plugin-tag">#{t}</span>
                  ))}
                </div>

                <div className="plugin-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedPlugin(p)}
                  >
                    Details & Reviews
                  </button>

                  {isOwned || isFree ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        window.location.href = `${API_BASE}/api/plugins/${p.id}/download`;
                      }}
                    >
                      ⬇ Download .JAR
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setSelectedPlugin(p)}
                    >
                      Buy Plugin
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
            <h3 style={{ color: '#fff', marginBottom: '8px' }}>No Plugins Found</h3>
            <p>Try adjusting your search query or category filters.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '36px 28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
        <p>NEXORA TECHNOLOGIES • CAMBODIA • KHQR INTEGRATED E-COMMERCE ENGINE</p>
        <p style={{ marginTop: '6px', fontSize: '11px' }}>Paper & Folia are registered trademarks of their respective owners. Nexora AntiCheat runs unencumbered & standalone.</p>
      </footer>

      {/* Modals */}
      <PluginDetailModal
        plugin={selectedPlugin}
        isOpen={Boolean(selectedPlugin)}
        onClose={() => setSelectedPlugin(null)}
        user={user}
        onOpenDeposit={handleOpenDeposit}
        onPurchaseSuccess={handlePurchaseSuccess}
        onOpenLightbox={imgUrl => setLightboxImg(imgUrl)}
      />

      <KHQRModal
        isOpen={showKHQRModal}
        onClose={() => setShowKHQRModal(false)}
        user={user}
        initialAmount={depositAmount}
        onDepositSuccess={() => refreshUserSession()}
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
