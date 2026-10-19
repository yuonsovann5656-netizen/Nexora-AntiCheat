import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';
import {
  X, Star, Download, Check,
  AlertTriangle, Shield, Sword, Settings,
  Package, Plug, Share2, ThumbsUp, ExternalLink
} from 'lucide-react';

const CATEGORY_ICONS = {
  security:       <Shield size={24} />,
  administration: <Settings size={24} />,
  combat:         <Sword size={24} />,
  bundle:         <Package size={24} />,
  default:        <Plug size={24} />,
};

function getCategoryIcon(cat) {
  const key = (cat || '').toLowerCase();
  return CATEGORY_ICONS[key] || CATEGORY_ICONS.default;
}

export default function PluginDetailModal({
  plugin,
  isOpen,
  onClose,
  user,
  onOpenAuth,
  onPurchaseSuccess,
  onOpenLightbox,
  onSharePlugin,
  onOpenDetailPage
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

  const isVerified = user && (user.emailVerified === true || user.role === 'ADMIN');
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

  // No file upload needed — users paste image URLs directly

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      setAlertMsg({ type: 'error', text: 'Please sign in to post a review.' });
      return;
    }

    if (!newComment.trim()) {
      setAlertMsg({ type: 'error', text: 'Please enter a review comment.' });
      return;
    }

    setSubmittingReview(true);
    setAlertMsg(null);

    try {
      const res = await fetch(`${API_BASE}/api/plugins/${plugin.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          rating: newRating,
          comment: newComment.trim(),
          imageUrl: reviewImage
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAlertMsg({ type: 'success', text: 'Review published successfully!' });
        setNewComment('');
        setReviewImage('');
        fetchReviews();
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to submit review.' });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Network error submitting review.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleLikeReview = async (reviewId) => {
    try {
      const res = await fetch(`${API_BASE}/api/plugins/${plugin.id}/reviews/${reviewId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user ? user.username : '' })
      });
      const data = await res.json();
      if (data.success) {
        setReviews(prev => prev.map(rev => {
          if (rev.id === reviewId) {
            return {
              ...rev,
              likes: data.likes,
              likedBy: data.likedBy
            };
          }
          return rev;
        }));
      }
    } catch (err) {
      console.error('Failed to like review:', err);
    }
  };

  const handleBuy = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    if (!isVerified) {
      setAlertMsg({
        type: 'error',
        text: 'Your email address is not verified yet. Please click your account badge to verify before purchasing or downloading plugins.'
      });
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

      if (res.ok && data.success) {
        setAlertMsg({ type: 'success', text: data.message });
        if (onPurchaseSuccess) onPurchaseSuccess();
        setTimeout(() => {
          handleDownloadJar();
        }, 800);
      } else {
        setAlertMsg({
          type: 'error',
          text: data.error || data.message || 'Transaction could not be completed.'
        });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setBuying(false);
    }
  };

  const handleDownloadJar = () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    window.location.href = `${API_BASE}/api/plugins/${plugin.id}/download?username=${encodeURIComponent(user.username)}`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-bright)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              overflow: 'hidden'
            }}>
              {plugin.logoUrl || plugin.id === 'bayon-anticheat' ? (
                <img
                  src={plugin.logoUrl || '/logo.png'}
                  alt={plugin.name}
                  style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                />
              ) : (
                getCategoryIcon(plugin.category)
              )}
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: '18px' }}>{plugin.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                v{plugin.version} • {plugin.category} • {plugin.supportedVersions}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenDetailPage && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => onOpenDetailPage(plugin)}
                title="Open Dedicated Full Page"
              >
                <ExternalLink size={13} />
                <span>Full Page</span>
              </button>
            )}
            {onSharePlugin && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => onSharePlugin(plugin)}
                title="Share this plugin"
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>
            )}
            <button
              className="modal-close"
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>
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
                  <div className="stat-val" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Star size={18} fill="currentColor" style={{ color: '#facc15' }} />
                    <span>{plugin.rating || '5.0'} / 5.0</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-lbl">Unique Downloads</div>
                  <div className="stat-val" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Download size={18} />
                    <span>{plugin.downloads || 0}</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-lbl">Architecture</div>
                  <div className="stat-val" style={{ fontSize: '16px' }}>Paper, Purpur, Folia</div>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Tags & Capabilities
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                {(plugin.tags || []).map((t, idx) => (
                  <span key={idx} className="plugin-tag" style={{ fontSize: '12px', padding: '4px 10px' }}>
                    #{t}
                  </span>
                ))}
              </div>

              {plugin.screenshots && plugin.screenshots.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Screenshots & Visual Telemetry
                  </h4>
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {plugin.screenshots.map((s, idx) => (
                      <img
                        key={idx}
                        src={s}
                        alt="Screenshot"
                        style={{ width: '220px', height: '130px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-bright)', cursor: 'pointer' }}
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
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="badge badge-blue">v{cl.version}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {cl.date}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', marginBottom: '8px' }}>
                      {cl.title}
                    </div>
                    <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {(cl.notes || []).map((note, nIdx) => (
                        <li key={nIdx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No changelogs posted for this plugin yet.
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
                  <div className="star-rating" style={{ display: 'flex', gap: '6px', cursor: 'pointer' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        onClick={() => setNewRating(star)}
                        style={{ display: 'inline-flex' }}
                      >
                        <Star
                          size={20}
                          fill={star <= newRating ? '#facc15' : 'none'}
                          style={{ color: star <= newRating ? '#facc15' : '#4b5563' }}
                        />
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

                {/* Screenshot / Image URL */}
                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label">Attach Screenshot URL (Optional)</label>
                  <input
                    className="input-field"
                    placeholder="Paste an image link (e.g. imgur, Discord CDN)..."
                    value={reviewImage}
                    onChange={e => setReviewImage(e.target.value)}
                  />
                  {reviewImage && (
                    <div className="image-preview-wrap" style={{ marginTop: '10px' }}>
                      <img src={reviewImage} alt="Attachment" className="image-preview"
                        onError={e => { e.target.style.display = 'none'; }} />
                      <button
                        type="button"
                        className="btn-remove-img"
                        onClick={() => setReviewImage('')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
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
                          <span style={{ display: 'inline-flex', gap: '2px' }}>
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star
                                key={s}
                                size={13}
                                fill={s <= r.rating ? '#facc15' : 'none'}
                                style={{ color: s <= r.rating ? '#facc15' : '#374151' }}
                              />
                            ))}
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

                      {/* Review likes and verified badge */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '12px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--border-subtle)'
                      }}>
                        {(() => {
                          const userKey = user ? user.username.toLowerCase() : '';
                          const isLikedByUser = Boolean(userKey && Array.isArray(r.likedBy) && r.likedBy.some(u => u.toLowerCase() === userKey));
                          return (
                            <button
                              type="button"
                              onClick={() => handleLikeReview(r.id)}
                              style={{
                                background: isLikedByUser ? 'rgba(0, 229, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                border: `1px solid ${isLikedByUser ? 'rgba(0, 229, 153, 0.4)' : 'var(--border-subtle)'}`,
                                color: isLikedByUser ? '#00e599' : 'var(--text-secondary)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                transition: 'all 0.15s ease'
                              }}
                              title={isLikedByUser ? 'Unlike this review' : 'Helpful review? Thumbs up!'}
                            >
                              <ThumbsUp size={12} fill={isLikedByUser ? 'currentColor' : 'none'} />
                              <span>{r.likes || 0} {r.likes === 1 ? 'Like' : 'Likes'}</span>
                            </button>
                          );
                        })()}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Verified Customer
                        </span>
                      </div>
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
            {!user ? (
              <button className="btn btn-primary" onClick={onOpenAuth}>
                Sign In to Download
              </button>
            ) : !isVerified ? (
              <button
                className="btn btn-primary"
                onClick={onOpenAuth}
                style={{ background: '#f59e0b', color: '#000', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <AlertTriangle size={15} /> Verify Email to Download
              </button>
            ) : isOwned || isFree ? (
              <button className="btn btn-primary" onClick={handleDownloadJar} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Download size={15} /> Download {plugin.jarFileName || 'Plugin.jar'}
              </button>
            ) : user.balance >= plugin.price ? (
              <button className="btn btn-primary" onClick={handleBuy} disabled={buying}>
                {buying ? 'Processing...' : `Buy with Balance ($${Number(user.balance).toFixed(2)})`}
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                disabled
                title="Your balance is lower than plugin price. Contact administrator."
              >
                Balance: ${Number(user.balance).toFixed(2)} (Req: ${Number(plugin.price).toFixed(2)})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
