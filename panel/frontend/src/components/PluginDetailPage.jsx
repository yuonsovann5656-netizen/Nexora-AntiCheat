import React, { useState, useEffect } from 'react';
import { API_BASE } from '../apiConfig';
import {
  ArrowLeft, Star, Download, Camera, Check,
  AlertTriangle, Shield, Sword, Settings,
  Package, Plug, Share2, ThumbsUp, X, CheckCircle,
  ExternalLink, Layers, Terminal, Sparkles
} from 'lucide-react';

const CATEGORY_ICONS = {
  security:       <Shield size={28} />,
  administration: <Settings size={28} />,
  combat:         <Sword size={28} />,
  bundle:         <Package size={28} />,
  default:        <Plug size={28} />,
};

function getCategoryIcon(cat) {
  const key = (cat || '').toLowerCase();
  return CATEGORY_ICONS[key] || CATEGORY_ICONS.default;
}

export default function PluginDetailPage({
  plugin,
  plugins = [],
  user,
  onNavigateHome,
  onOpenAuth,
  onPurchaseSuccess,
  onOpenLightbox,
  onSharePlugin
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'changelog', 'reviews'
  const [reviews, setReviews] = useState([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviewImage, setReviewImage] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [buying, setBuying] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  const isVerified = user && (user.emailVerified === true || user.role === 'ADMIN');
  const isOwned = user && Array.isArray(user.purchasedPlugins) && user.purchasedPlugins.includes(plugin?.id);
  const isFree = Number(plugin?.price || 0) === 0;

  useEffect(() => {
    if (plugin?.id) {
      fetchReviews();
      window.scrollTo(0, 0);
    }
  }, [plugin?.id]);

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

  const handleDownloadJar = () => {
    const downloadEndpoint = `${API_BASE}/api/plugins/${plugin.id}/download${user ? `?username=${encodeURIComponent(user.username)}` : ''}`;
    window.location.href = downloadEndpoint;
  };

  const handleBuy = async () => {
    if (!user) {
      onOpenAuth();
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
        if (onPurchaseSuccess) {
          onPurchaseSuccess(data.newBalance, data.purchasedPlugins);
        }
        setTimeout(() => {
          handleDownloadJar();
        }, 600);
      } else {
        setAlertMsg({ type: 'error', text: data.error || 'Failed to complete transaction.' });
      }
    } catch {
      setAlertMsg({ type: 'error', text: 'Network error during purchase.' });
    } finally {
      setBuying(false);
    }
  };

  if (!plugin) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: '#fff', padding: '60px 20px', textAlign: 'center' }}>
        <h2>Plugin Not Found</h2>
        <button className="btn btn-primary" onClick={onNavigateHome} style={{ marginTop: '20px' }}>
          <ArrowLeft size={16} /> Return to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navigation Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(5, 5, 5, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '14px 28px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={onNavigateHome}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <ArrowLeft size={15} />
            <span>Store Catalog</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="Bayon Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>
              BAYON • SHOTDI CORE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onSharePlugin && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onSharePlugin(plugin)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>
            )}
            {!user ? (
              <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
                Sign In
              </button>
            ) : (
              <span style={{ fontSize: '12px', color: '#00e599', fontWeight: 700 }}>
                {user.username}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Hero Product Banner */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '48px 24px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flex: 1, minWidth: '320px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-bright)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              boxShadow: '0 0 30px rgba(0, 229, 153, 0.1)'
            }}>
              {getCategoryIcon(plugin.category)}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span className="badge badge-blue">{plugin.category}</span>
                <span className="badge badge-green">POWERED BY SHOTDI</span>
                <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>v{plugin.version}</span>
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                {plugin.name}
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: 1.5 }}>
                {plugin.tagline}
              </p>
            </div>
          </div>

          {/* Quick CTA Box */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-bright)',
            borderRadius: '12px',
            padding: '24px',
            minWidth: '280px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>PRICE</span>
              <span className="plugin-price-tag" style={{ fontSize: '28px' }}>
                {isFree ? 'FREE' : `$${Number(plugin.price).toFixed(2)}`}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!user ? (
                <button className="btn btn-primary" onClick={onOpenAuth} style={{ width: '100%', justifyContent: 'center' }}>
                  Sign In to Download
                </button>
              ) : isOwned || isFree ? (
                <button className="btn btn-primary" onClick={handleDownloadJar} style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={16} /> Download {plugin.jarFileName || 'Plugin.jar'}
                </button>
              ) : user.balance >= plugin.price ? (
                <button className="btn btn-primary" onClick={handleBuy} disabled={buying} style={{ width: '100%', justifyContent: 'center' }}>
                  {buying ? 'Processing...' : `Buy with Balance ($${Number(user.balance).toFixed(2)})`}
                </button>
              ) : (
                <button className="btn btn-secondary" disabled style={{ width: '100%', justifyContent: 'center' }}>
                  Balance: ${Number(user.balance).toFixed(2)}
                </button>
              )}

              {onSharePlugin && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSharePlugin(plugin)}
                  style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Share2 size={13} /> Share with Other Users
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', padding: '0 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`modal-tab ${activeTab === 'overview' ? 'active' : ''}`}
            style={{ padding: '16px 20px', background: 'none', border: 'none', fontSize: '13px', fontWeight: 700 }}
          >
            Overview & Architecture
          </button>
          <button
            onClick={() => setActiveTab('changelog')}
            className={`modal-tab ${activeTab === 'changelog' ? 'active' : ''}`}
            style={{ padding: '16px 20px', background: 'none', border: 'none', fontSize: '13px', fontWeight: 700 }}
          >
            Changelog & Updates ({plugin.changelogs ? plugin.changelogs.length : 0})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`modal-tab ${activeTab === 'reviews' ? 'active' : ''}`}
            style={{ padding: '16px 20px', background: 'none', border: 'none', fontSize: '13px', fontWeight: 700 }}
          >
            Community Reviews ({reviews.length})
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 24px', flex: 1, width: '100%', boxSizing: 'border-box' }}>
        
        {alertMsg && (
          <div style={{
            padding: '12px 18px',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '13px',
            background: alertMsg.type === 'success' ? 'rgba(0, 229, 153, 0.15)' : 'rgba(255, 51, 68, 0.15)',
            color: alertMsg.type === 'success' ? '#00e599' : '#ff4d5e',
            border: `1px solid ${alertMsg.type === 'success' ? 'rgba(0, 229, 153, 0.3)' : 'rgba(255, 51, 68, 0.3)'}`
          }}>
            {alertMsg.text}
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                Product Overview
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '24px' }}>
                {plugin.description}
              </p>

              {/* Supported Tech Specs */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: '14px' }}>
                  SERVER COMPATIBILITY & SPECS
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MINECRAFT VERSIONS</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
                      {plugin.supportedVersions || '1.20 - 1.21.4'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SUPPORTED PLATFORMS</span>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {(plugin.software || ['Paper', 'Purpur', 'Folia']).map((soft, i) => (
                        <span key={i} className="badge badge-blue" style={{ fontSize: '10px' }}>
                          {soft}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ACTIVE DOWNLOADS</span>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#00e599', marginTop: '2px' }}>
                      {plugin.downloads || 0} unique servers
                    </div>
                  </div>
                </div>
              </div>

              {/* Screenshots Gallery if available */}
              {Array.isArray(plugin.screenshots) && plugin.screenshots.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#fff', marginBottom: '12px' }}>
                    PREVIEW SCREENSHOTS
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
                    {plugin.screenshots.map((imgUrl, idx) => (
                      <img
                        key={idx}
                        src={imgUrl}
                        alt={`Screenshot ${idx + 1}`}
                        style={{
                          width: '100%',
                          height: '140px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer'
                        }}
                        onClick={() => onOpenLightbox && onOpenLightbox(imgUrl)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar quick info */}
            <div>
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '20px'
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
                  Tags & Metadata
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                  {(plugin.tags || []).map((tag, idx) => (
                    <span key={idx} className="plugin-tag" style={{ fontSize: '11px' }}>
                      #{tag}
                    </span>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>LICENSE MODEL</div>
                  <div style={{ fontSize: '13px', color: '#00e599', fontWeight: 700 }}>
                    Unencumbered Community Edition
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                    Deploy freely across all your proxy and backend servers with zero key restrictions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHANGELOG */}
        {activeTab === 'changelog' && (
          <div style={{ maxWidth: '800px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>
              Version Release History
            </h3>
            {Array.isArray(plugin.changelogs) && plugin.changelogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {plugin.changelogs.map((cl, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '20px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="badge badge-blue">v{cl.version}</span>
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cl.date}</span>
                    </div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>
                      {cl.title}
                    </h4>
                    <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                      {(cl.notes || []).map((note, nIdx) => (
                        <li key={nIdx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No changelog entries published yet.</div>
            )}
          </div>
        )}

        {/* TAB 3: REVIEWS WITH LIKES */}
        {activeTab === 'reviews' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {/* Submit form */}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
                Write Community Feedback
              </h3>
              <form onSubmit={handleSubmitReview} style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label">Rating</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} onClick={() => setNewRating(star)} style={{ cursor: 'pointer' }}>
                        <Star size={20} fill={star <= newRating ? '#facc15' : 'none'} style={{ color: star <= newRating ? '#facc15' : '#4b5563' }} />
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label className="form-label">Review Comment</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '90px' }}
                    placeholder="Share your server performance, TPS observations, or configuration tips..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Attach Proof / Screenshot (Optional)</label>
                  <input type="file" id="page-review-img" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                  <label htmlFor="page-review-img" style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={14} />
                    <span>{reviewImage ? 'Change Image' : 'Upload Game Screenshot'}</span>
                  </label>
                  {reviewImage && (
                    <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
                      <img src={reviewImage} alt="Attachment" style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '6px' }} />
                      <button type="button" onClick={() => setReviewImage('')} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.8)', border: 'none', color: '#fff', borderRadius: '50%', padding: '2px', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" disabled={submittingReview} style={{ width: '100%', justifyContent: 'center' }}>
                  {submittingReview ? 'Submitting...' : 'Post Verified Review'}
                </button>
              </form>
            </div>

            {/* Reviews List */}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>
                All Verified Reviews ({reviews.length})
              </h3>
              {reviews.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {reviews.map(r => {
                    const userKey = user ? user.username.toLowerCase() : '';
                    const isLikedByUser = Boolean(userKey && Array.isArray(r.likedBy) && r.likedBy.some(u => u.toLowerCase() === userKey));

                    return (
                      <div key={r.id} className="review-card">
                        <div className="review-author">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="review-username">{r.username}</span>
                            <span style={{ display: 'inline-flex', gap: '2px' }}>
                              {[1, 2, 3, 4, 5].map(s => (
                                <Star key={s} size={12} fill={s <= r.rating ? '#facc15' : 'none'} style={{ color: s <= r.rating ? '#facc15' : '#374151' }} />
                              ))}
                            </span>
                          </div>
                          <span className="review-date">{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>

                        <p className="review-comment">{r.comment}</p>

                        {r.imageUrl && (
                          <img
                            src={r.imageUrl}
                            alt="Attachment"
                            className="review-image-thumb"
                            onClick={() => onOpenLightbox && onOpenLightbox(r.imageUrl)}
                          />
                        )}

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '12px',
                          paddingTop: '8px',
                          borderTop: '1px solid var(--border-subtle)'
                        }}>
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
                              fontWeight: 600
                            }}
                            title="Helpful review? Thumbs up!"
                          >
                            <ThumbsUp size={12} fill={isLikedByUser ? 'currentColor' : 'none'} />
                            <span>{r.likes || 0} {r.likes === 1 ? 'Like' : 'Likes'}</span>
                          </button>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Verified Customer</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', padding: '30px', textAlign: 'center' }}>
                  No reviews yet. Be the first to share your thoughts!
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '28px', textAlign: 'center', background: 'var(--bg-secondary)', marginTop: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="Bayon Logo" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
              BAYON TECHNOLOGIES • POWERED BY SHOTDI
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>Discord</a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>YouTube</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>GitHub</a>
            <a href="https://t.me" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px' }}>Telegram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
