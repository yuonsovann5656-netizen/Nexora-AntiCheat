import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';

export default function PluginDetailModal({
  plugin,
  isOpen,
  onClose,
  user,
  onOpenDeposit,
  onPurchaseSuccess,
  onOpenLightbox
}) {
  if (!isOpen || !plugin) return null;

  const [activeTab, setActiveTab] = useState('overview');
  const [reviews, setReviews] = useState([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviewImage, setReviewImage] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [buying, setBuying] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  const isOwned = user && Array.isArray(user.purchasedPlugins) && user.purchasedPlugins.includes(plugin.id);
  const isFree = Number(plugin.price) === 0;

  useEffect(() => {
    fetchReviews();
  }, [plugin.id]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plugins/${plugin.id}/reviews`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setReviews(data);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      setAlertMsg({ type: 'error', text: 'Please sign in to post a review.' });
      return;
    }
    if (!newComment.trim()) return;

    setSubmittingReview(true);
    try {
      const res = await fetch(`${API_BASE}/api/plugins/${plugin.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          rating: newRating,
          comment: newComment,
          imageUrl: reviewImage
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewComment('');
        setReviewImage('');
        fetchReviews();
        setAlertMsg({ type: 'success', text: 'Review published successfully!' });
        setTimeout(() => setAlertMsg(null), 3000);
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Failed to post review.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleBuy = async () => {
    if (!user) {
      setAlertMsg({ type: 'error', text: 'Please sign in or create an account to purchase.' });
      return;
    }

    if (user.balance < plugin.price) {
      // Prompt KHQR deposit
      onOpenDeposit(plugin.price);
      return;
    }

    setBuying(true);
    setAlertMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/plugins/${plugin.id}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMsg({ type: 'success', text: 'Purchase confirmed! Starting direct download...' });
        if (onPurchaseSuccess) onPurchaseSuccess(data);
        // Trigger download
        window.location.href = `${API_BASE}/api/plugins/${plugin.id}/download`;
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to complete purchase.' });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Network error executing purchase.' });
    } finally {
      setBuying(false);
    }
  };

  const handleDownloadJar = () => {
    window.location.href = `${API_BASE}/api/plugins/${plugin.id}/download`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>{plugin.icon}</span>
            <div>
              <div className="modal-title" style={{ fontSize: '18px' }}>{plugin.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                v{plugin.version} • {plugin.category} • {plugin.supportedVersions}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab Selector */}
        <div style={{ padding: '0 24px', background: 'var(--bg-secondary)' }}>
          <div className="modal-tabs" style={{ marginBottom: 0 }}>
            <button
              className={`modal-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`modal-tab ${activeTab === 'changelog' ? 'active' : ''}`}
              onClick={() => setActiveTab('changelog')}
            >
              Changelog & Updates ({plugin.changelogs ? plugin.changelogs.length : 0})
            </button>
            <button
              className={`modal-tab ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              Reviews & Feedback ({reviews.length})
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
              <p style={{ fontSize: '15px', color: '#fff', lineHeight: 1.6, marginBottom: '20px' }}>
                {plugin.description}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="stat-card">
                  <div className="stat-lbl">Rating</div>
                  <div className="stat-val" style={{ fontSize: '20px' }}>⭐ {plugin.rating || '5.0'} / 5.0</div>
                </div>
                <div className="stat-card">
                  <div className="stat-lbl">Downloads</div>
                  <div className="stat-val" style={{ fontSize: '20px' }}>{plugin.downloads || 0}+</div>
                </div>
                <div className="stat-card">
                  <div className="stat-lbl">Architecture</div>
                  <div className="stat-val" style={{ fontSize: '16px' }}>Paper, Purpur, Folia</div>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Tags & Categories
              </h4>
              <div className="plugin-tags" style={{ marginBottom: '24px' }}>
                {(plugin.tags || []).map((t, idx) => (
                  <span key={idx} className="plugin-tag">#{t}</span>
                ))}
              </div>

              {plugin.screenshots && plugin.screenshots.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Gallery & Screenshots
                  </h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {plugin.screenshots.map((s, idx) => (
                      <img
                        key={idx}
                        src={s}
                        alt="Screenshot"
                        style={{ width: '140px', height: '90px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-bright)', cursor: 'pointer' }}
                        onClick={() => onOpenLightbox(s)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CHANGELOG TAB */}
          {activeTab === 'changelog' && (
            <div>
              {plugin.changelogs && plugin.changelogs.length > 0 ? (
                plugin.changelogs.map((cl, idx) => (
                  <div key={idx} style={{
                    borderLeft: '2px solid #fff',
                    paddingLeft: '16px',
                    marginBottom: '24px',
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span className="brand-badge">v{cl.version}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{cl.date}</span>
                    </div>
                    <h4 style={{ fontSize: '15px', color: '#fff', marginBottom: '8px' }}>{cl.title}</h4>
                    <ul style={{ paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                      {(cl.notes || []).map((note, nIdx) => (
                        <li key={nIdx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                  No changelog entries published yet.
                </div>
              )}
            </div>
          )}

          {/* REVIEWS & FEEDBACK TAB */}
          {activeTab === 'reviews' && (
            <div>
              {/* Write Review Form */}
              <form onSubmit={handleSubmitReview} className="review-form">
                <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: '12px' }}>
                  WRITE A REVIEW & FEEDBACK
                </h4>

                <div style={{ marginBottom: '10px' }}>
                  <label className="form-label">Your Rating</label>
                  <div className="star-rating">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        className={`star ${star <= newRating ? 'active' : ''}`}
                        onClick={() => setNewRating(star)}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label className="form-label">Review Comment</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Share your experience, performance feedback, or suggestions..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                </div>

                {/* Screenshot / Image Upload */}
                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label">Attach Screenshot / Image (Optional)</label>
                  <div className="image-upload-box">
                    <input
                      type="file"
                      id="review-img-upload"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageUpload}
                    />
                    <label htmlFor="review-img-upload" style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      📷 {reviewImage ? 'Change Image Attachment' : 'Upload Proof / Telemetry / Game Screenshot'}
                    </label>
                    {reviewImage && (
                      <div className="image-preview-wrap">
                        <img src={reviewImage} alt="Attachment" className="image-preview" />
                        <button type="button" className="btn-remove-img" onClick={() => setReviewImage('')}>✕</button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-secondary btn-sm"
                  disabled={submittingReview}
                >
                  {submittingReview ? 'Submitting...' : 'Post Feedback'}
                </button>
              </form>

              {/* Reviews List */}
              <div>
                <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                  COMMUNITY REVIEWS ({reviews.length})
                </h4>
                {reviews.length > 0 ? (
                  reviews.map(r => (
                    <div key={r.id} className="review-card">
                      <div className="review-author">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="review-username">{r.username}</span>
                          <span style={{ color: '#fff', fontSize: '12px' }}>
                            {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                          </span>
                        </div>
                        <span className="review-date">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="review-comment">{r.comment}</p>
                      {r.imageUrl && (
                        <img
                          src={r.imageUrl}
                          alt="Review attachment"
                          className="review-image-thumb"
                          onClick={() => onOpenLightbox(r.imageUrl)}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No reviews yet. Be the first to review this plugin!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Purchase & Download Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PRICE</div>
            <div className="plugin-price-tag" style={{ fontSize: '22px' }}>
              {isFree ? 'FREE' : `$${Number(plugin.price).toFixed(2)}`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {isOwned || isFree ? (
              <button className="btn btn-primary" onClick={handleDownloadJar}>
                ⬇ Download {plugin.jarFileName || 'Plugin.jar'}
              </button>
            ) : (
              user && user.balance >= plugin.price ? (
                <button className="btn btn-primary" onClick={handleBuy} disabled={buying}>
                  {buying ? 'Processing...' : `Buy with Balance ($${user.balance.toFixed(2)})`}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => onOpenDeposit(plugin.price)}
                >
                  ⚡ Deposit via KHQR to Buy (${plugin.price})
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
