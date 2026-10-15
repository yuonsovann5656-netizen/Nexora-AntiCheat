import React, { useState, useEffect } from 'react';
import AdminPanel from './components/AdminPanel';
import UserPanel from './components/UserPanel';
import EmbedGuide from './components/EmbedGuide';
import { API_BASE } from './apiConfig';

export default function App() {
  const [currentView, setCurrentView] = useState('user'); // Default to 'user' client portal
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`);
      setBackendOnline(res.ok);
    } catch (e) {
      setBackendOnline(false);
    }
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 60px' }}>
      {/* Top Header & Branding */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '20px',
        marginBottom: '28px',
        borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ff0000 0%, #880000 100%)',
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            boxShadow: '0 0 20px rgba(255, 0, 0, 0.4)'
          }}>
            🛡️
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#ff0000' }}>NEXORA</span> ANTICHEAT
              <span style={{ fontSize: '11px', background: 'rgba(255, 0, 0, 0.15)', color: '#ff0000', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,0,0,0.3)' }}>
                PANEL v1.0
              </span>
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              License Authority • Minecraft Server Fleet & AntiCheat Telemetry Dashboard
            </p>
          </div>
        </div>

        {/* View Switcher Tabs & Backend Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            background: 'var(--bg-card)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border)'
          }}>
            <button
              onClick={() => setCurrentView('admin')}
              style={{
                background: currentView === 'admin' ? '#ff0000' : 'transparent',
                color: currentView === 'admin' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              👑 Admin Panel
            </button>
            <button
              onClick={() => setCurrentView('user')}
              style={{
                background: currentView === 'user' ? '#ff0000' : 'transparent',
                color: currentView === 'user' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              👤 Buyer / User Portal
            </button>
            <button
              onClick={() => setCurrentView('embed')}
              style={{
                background: currentView === 'embed' ? '#ff0000' : 'transparent',
                color: currentView === 'embed' ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🔌 Website Embed
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: backendOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${backendOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: backendOnline ? '#10b981' : '#ef4444'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: backendOnline ? '#10b981' : '#ef4444',
              boxShadow: backendOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444'
            }}></span>
            {backendOnline ? 'API Connected' : 'API Offline'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {currentView === 'admin' && <AdminPanel />}
        {currentView === 'user' && <UserPanel />}
        {currentView === 'embed' && <EmbedGuide />}
      </main>
    </div>
  );
}
