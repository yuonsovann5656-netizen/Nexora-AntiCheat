import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';

export default function KHQRModal({ isOpen, onClose, user, onDepositSuccess, initialAmount = 10.00 }) {
  if (!isOpen) return null;

  const [amount, setAmount] = useState(initialAmount);
  const [currency, setCurrency] = useState('USD');
  const [khqrData, setKhqrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [receiptImage, setReceiptImage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Generate KHQR whenever amount or currency changes
  useEffect(() => {
    generateKHQR(amount, currency);
  }, [amount, currency]);

  const generateKHQR = async (amt, curr) => {
    if (!amt || Number(amt) <= 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/wallet/deposit/khqr/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          currency: curr,
          username: user ? user.username : 'Guest'
        })
      });
      const data = await res.json();
      if (data.success) {
        setKhqrData(data);
      }
    } catch (err) {
      console.error('Failed to generate KHQR:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRef = () => {
    if (!khqrData) return;
    navigator.clipboard.writeText(khqrData.refCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!user) {
      setStatusMessage({ type: 'error', text: 'Please sign in to submit a deposit request.' });
      return;
    }
    if (!khqrData) return;

    setSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/wallet/deposit/khqr/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          amount: khqrData.amount,
          currency: khqrData.currency,
          refCode: khqrData.refCode,
          receiptImage: receiptImage,
          txHash: txHash
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Deposit submitted! Your balance will update once approved by admin.' });
        if (onDepositSuccess) onDepositSuccess(data.deposit);
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to submit deposit.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error submitting payment proof.' });
    } finally {
      setSubmitting(false);
    }
  };

  const qrImageUrl = khqrData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(khqrData.khqrString)}`
    : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title">DEPOSIT FUNDS VIA KHQR</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Quick Amount Selectors */}
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label">Select Amount (USD)</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[5, 10, 20, 50, 100].map(val => (
                <button
                  key={val}
                  type="button"
                  className={`category-pill ${amount === val ? 'active' : ''}`}
                  onClick={() => setAmount(val)}
                  style={{ padding: '6px 14px' }}
                >
                  ${val}.00
                </button>
              ))}
            </div>
            <input
              type="number"
              className="input-field mono"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              placeholder="Or enter custom amount..."
              min="1"
              step="any"
            />
          </div>

          {/* Bakong KHQR Card */}
          <div className="khqr-card">
            <div className="khqr-header">
              KHQR
            </div>
            <div className="khqr-body">
              <div className="khqr-merchant">NEXORA TECHNOLOGIES</div>
              <div className="khqr-amount">${Number(amount || 0).toFixed(2)} USD</div>

              <div className="khqr-qr-wrap">
                {loading ? (
                  <div style={{ color: '#888', fontSize: '13px', fontFamily: 'monospace' }}>Generating KHQR...</div>
                ) : (
                  <img src={qrImageUrl} alt="Bakong KHQR Code" className="khqr-qr-img" />
                )}
              </div>

              {khqrData && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <div className="khqr-ref">{khqrData.refCode}</div>
                  <button
                    type="button"
                    onClick={handleCopyRef}
                    style={{ background: '#eee', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontFamily: 'monospace' }}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              )}

              <p className="khqr-footer-note">
                Scan with Bakong, ABA Mobile, ACLEDA, Wing, or any Cambodian Mobile Banking App.
              </p>
            </div>
          </div>

          {/* Payment Proof Submission Form */}
          <form onSubmit={handleSubmitProof} style={{ marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', marginBottom: '12px', color: '#fff' }}>
              CONFIRM PAYMENT
            </h4>

            {statusMessage && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '6px',
                marginBottom: '14px',
                fontSize: '13px',
                background: statusMessage.type === 'success' ? 'rgba(0, 229, 153, 0.15)' : 'rgba(255, 51, 68, 0.15)',
                color: statusMessage.type === 'success' ? '#00e599' : '#ff4d5e',
                border: `1px solid ${statusMessage.type === 'success' ? 'rgba(0, 229, 153, 0.3)' : 'rgba(255, 51, 68, 0.3)'}`
              }}>
                {statusMessage.text}
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <label className="form-label">Transaction Reference or Receipt Screenshot</label>
              <input
                type="text"
                className="input-field mono"
                placeholder="Paste transaction hash / reference..."
                value={txHash}
                onChange={e => setTxHash(e.target.value)}
              />

              <div className="image-upload-box">
                <input
                  type="file"
                  id="receipt-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
                <label htmlFor="receipt-upload" style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  📁 {receiptImage ? 'Change Receipt Screenshot' : 'Upload Bank Transfer Screenshot'}
                </label>
                {receiptImage && (
                  <div className="image-preview-wrap">
                    <img src={receiptImage} alt="Receipt Preview" className="image-preview" />
                    <button type="button" className="btn-remove-img" onClick={() => setReceiptImage('')}>✕</button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Payment Proof'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
