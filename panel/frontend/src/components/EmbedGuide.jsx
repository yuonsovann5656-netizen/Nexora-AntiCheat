import React, { useState } from 'react';
import { API_BASE } from '../apiConfig';

export default function EmbedGuide() {
  const [copied, setCopied] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [loading, setLoading] = useState(false);

  const panelOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-panel.onrender.com';

  async function handleDemoGenerate(e) {
    e.preventDefault();
    if (!buyerName.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/admin/licenses/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: buyerName,
          email: buyerEmail,
          tier: 'LIFETIME',
          maxServers: 1
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedKey(data.license.key);
      }
    } catch (e) {
      alert('Error connecting to panel backend.');
    } finally {
      setLoading(false);
    }
  }

  const embedCodeSnippet = `<!-- Nexora AntiCheat Website Key Generator Widget -->
<div id="nexora-license-widget" style="max-width: 480px; background: #12151d; border: 1px solid #ff0000; padding: 24px; border-radius: 12px; color: #fff; font-family: sans-serif;">
  <h3 style="color: #ff0000; margin-bottom: 8px;">🛡️ Get Nexora AntiCheat License</h3>
  <p style="font-size: 13px; color: #8b94a5; margin-bottom: 16px;">Instant license key issuance for your Minecraft server.</p>
  
  <form id="nexora-form" onsubmit="generateKey(event)">
    <input id="nexora-name" type="text" placeholder="Server Name / Owner" required style="width: 100%; padding: 10px; margin-bottom: 10px; background: #0a0c10; border: 1px solid #232836; color: #fff; border-radius: 6px;" />
    <input id="nexora-email" type="email" placeholder="Email Address" required style="width: 100%; padding: 10px; margin-bottom: 14px; background: #0a0c10; border: 1px solid #232836; color: #fff; border-radius: 6px;" />
    <button type="submit" style="width: 100%; background: #ff0000; color: #fff; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">⚡ Generate Instant License</button>
  </form>

  <div id="nexora-result" style="display: none; margin-top: 16px; padding: 12px; background: #181d27; border-radius: 6px; text-align: center;">
    <div style="font-size: 12px; color: #10b981;">License Activated!</div>
    <div id="nexora-key-display" style="font-family: monospace; font-size: 16px; font-weight: bold; color: #ff0000; margin-top: 6px;"></div>
  </div>
</div>

<script>
async function generateKey(e) {
  e.preventDefault();
  const name = document.getElementById('nexora-name').value;
  const email = document.getElementById('nexora-email').value;
  
  const res = await fetch('${panelOrigin}/api/admin/licenses/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: name, email: email, tier: 'LIFETIME', maxServers: 1 })
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById('nexora-key-display').innerText = data.license.key;
    document.getElementById('nexora-result').style.display = 'block';
  }
}
</script>`;

  function copyCode() {
    navigator.clipboard.writeText(embedCodeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
      {/* Column 1: Live Interactive Widget Demo */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ff0000', marginBottom: '8px' }}>
          🌐 Website Buyer Checkout Form (Live Preview)
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          This is the exact form your buyers see on your store/website to get their license key.
        </p>

        <form onSubmit={handleDemoGenerate} style={{ background: '#0a0c10', padding: '20px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              SERVER NAME / OWNER NAME
            </label>
            <input
              type="text"
              className="input-dark"
              placeholder="e.g. PixelMC Network"
              value={buyerName}
              onChange={e => setBuyerName(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>
              BUYER EMAIL ADDRESS
            </label>
            <input
              type="email"
              className="input-dark"
              placeholder="buyer@domain.com"
              value={buyerEmail}
              onChange={e => setBuyerEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-red" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Activating License...' : '⚡ Generate Instant Key'}
          </button>
        </form>

        {generatedKey && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            padding: '16px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#10b981', fontWeight: '700', fontSize: '13px' }}>
              ✓ License Generated Successfully!
            </div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: '800', color: '#ff0000', marginTop: '8px' }}>
              {generatedKey}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Paste this key into your Minecraft server config.yml to begin protection.
            </div>
          </div>
        )}
      </div>

      {/* Column 2: Code Snippet to Copy */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
            📋 Copy HTML / React Embed Code
          </h3>
          <button onClick={copyCode} className="btn-secondary" style={{ fontSize: '12px' }}>
            {copied ? '✓ Copied Code!' : '📋 Copy Embed Code'}
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Drop this HTML / JS snippet into your WordPress, Tebex, CraftingStore, or custom React website:
        </p>

        <pre className="mono" style={{
          background: '#0a0c10',
          border: '1px solid var(--border)',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#38bdf8',
          maxHeight: '340px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          {embedCodeSnippet}
        </pre>
      </div>
    </div>
  );
}
