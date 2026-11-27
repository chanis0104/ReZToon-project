import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Users, Home as HomeIcon, Heart, Star, Eye, BookOpen, Bookmark,
  BookmarkCheck, Play, Share2, ChevronRight, Clock, ThumbsUp, Trash2, Pencil,
  Send, PenTool, MessageCircle, X, Trophy, Loader2
} from 'lucide-react';
import ParticlesCanvas from '../../shared/effects/ParticlesCanvas';
import FloatingShapes from '../../shared/effects/FloatingShapes';
import ProfileAvatar from '../../shared/layout/ProfileAvatar';
import SearchPanel from '../../shared/panels/SearchPanel';
import CreatorPanel from '../../shared/panels/CreatorPanel';
import NotificationsPanel from '../../shared/panels/NotificationsPanel';
import MessagesPanel from '../../shared/panels/MessagesPanel';
import LanguageSwitcher from '../../shared/ui/LanguageSwitcher';
import LiteModeToggle from '../../shared/ui/LiteModeToggle';
import FollowButton from '../../shared/ui/FollowButton';
import { getIcon } from '../../shared/ui/Icon';
import { useCurrentUser } from '../../core/hooks/useCurrentUser';
import { getMangaById, getRelatedMangas, toggleMangaLike, isMangaLikedByUser, type Manga } from '../../core/services/mangaService';
import { addToLibrary, removeFromLibrary, isInLibrary, getLibraryEntry, type LibraryEntry } from '../../core/services/libraryService';
import { getUsersByIds, type User } from '../../core/services/userService';
import {
  getReviewAggregate, getReviewsForManga, getUserReview, addReview, updateReview,
  deleteReview, toggleHelpful, filterReviewsByRole, sortReviews,
  type Review, type ReviewSort, type ReviewRoleFilter, type AuthorRole, type ReviewAggregate
} from '../../core/services/reviewService';
import { getFooter } from '../../core/services/catalogueService';
import { useT, useI18n } from '../../config/i18n';
import { formatRelativeTime, formatDateShort, formatNumber } from '../../core/utils/format';

import '../../styles/home-style.css';
import '../../styles/profile-style.css';
import '../../styles/panel-style.css';
import '../../styles/manga-detail-style.css';
import '../../styles/follow-style.css';
import '../../styles/pwa-style.css';

const FOOTER = getFooter();

function isCreatorRole(role: AuthorRole): boolean {
  return role === 'creator' || role === 'both';
}

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="review-stars" aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= rounded ? 'currentColor' : 'none'} className={n <= rounded ? 'star-on' : 'star-off'} />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useT();
  return (
    <div className="star-picker" role="radiogroup" aria-label={t.reviewForm.yourRating}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n}`}
          className={`star-pick-btn ${n <= value ? 'on' : ''}`}
          onClick={() => onChange(n)}
        >
          <Star size={22} fill={n <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

interface ReviewFormProps {
  initial?: Review | null;
  onSubmit: (data: { rating: number; title: string; content: string }) => void | Promise<void>;
  onCancel?: () => void;
}

function ReviewForm({ initial, onSubmit, onCancel }: ReviewFormProps) {
  const t = useT();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    if (rating < 1) { setError(t.reviewForm.errPickRating); return; }
    if (!title.trim() || !content.trim()) { setError(t.reviewForm.errTitleContentRequired); return; }
    if (content.trim().length < 10) { setError(t.reviewForm.errContentTooShort); return; }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ rating, title, content });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errUnexpected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="review-form" onSubmit={handleSubmit}>
      {error && <div className="form-message error">{error}</div>}
      <div className="review-form-row">
        <span className="review-form-label">{t.reviewForm.yourRating}</span>
        <StarPicker value={rating} onChange={setRating} />
      </div>
      <div className="review-form-group">
        <label htmlFor="review-title">{t.reviewForm.title}</label>
        <input id="review-title" type="text" placeholder={t.reviewForm.titlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      </div>
      <div className="review-form-group">
        <label htmlFor="review-content">{t.reviewForm.content}</label>
        <textarea id="review-content" className="profile-textarea" placeholder={t.reviewForm.contentPlaceholder} value={content} onChange={(e) => setContent(e.target.value)} maxLength={800} rows={4} />
        <span className="char-counter">{content.length}/800</span>
      </div>
      <div className="review-form-actions">
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            <X size={14} /> {t.common.cancel}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <Send size={14} /> {initial ? t.reviewForm.update : t.reviewForm.publish}
        </button>
      </div>
    </form>
  );
}

export default function MangaDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useI18n();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [manga, setManga] = useState<Manga | null>(null);
  const [related, setRelated] = useState<Manga[]>([]);
  const [inLibrary, setInLibrary] = useState(false);
  const [mangaLiked, setMangaLiked] = useState(false);
  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  const [aggregate, setAggregate] = useState<ReviewAggregate | null>(null);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);

  const [reviewRole, setReviewRole] = useState<ReviewRoleFilter>('all');
  const [reviewSort, setReviewSort] = useState<ReviewSort>('recent');
  const [editingReview, setEditingReview] = useState(false);

  const SORT_OPTIONS: { id: ReviewSort; label: string }[] = [
    { id: 'recent', label: t.review.sortRecent },
    { id: 'highest', label: t.review.sortHighest },
    { id: 'lowest', label: t.review.sortLowest },
    { id: 'helpful', label: t.review.sortHelpful },
  ];

  const ROLE_OPTIONS: { id: ReviewRoleFilter; label: string; icon: typeof Users }[] = [
    { id: 'all', label: t.review.filterAll, icon: MessageCircle },
    { id: 'creator', label: t.review.filterCreators, icon: PenTool },
    { id: 'reader', label: t.review.filterReaders, icon: Users },
  ];

  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      if (!id) return;
      setLoading(true);
      try {
        const [m, r, revs, agg] = await Promise.all([
          getMangaById(id),
          getRelatedMangas(id),
          getReviewsForManga(id),
          getReviewAggregate(id)
        ]);

        if (!isCancelled) {
          setManga(m);
          setRelated(r);
          setAllReviews(revs);
          setAggregate(agg);
        }

        if (revs.length > 0 || m?.authorId) {
          const authorIds = new Set<string>();
          if (m?.authorId) authorIds.add(m.authorId);
          revs.forEach((r) => authorIds.add(r.authorId));

          const profiles = await getUsersByIds(Array.from(authorIds));
          if (!isCancelled) {
            const uMap: Record<string, User> = {};
            profiles.forEach((u) => uMap[u.id] = u);
            setUsersMap(uMap);
          }
        }

        if (m && user) {
          const [isIn, ent, isLiked, uRev] = await Promise.all([
            isInLibrary(user.id, m.id),
            getLibraryEntry(user.id, m.id),
            isMangaLikedByUser(m.id, user.id),
            getUserReview(m.id, user.id)
          ]);
          if (!isCancelled) {
            setInLibrary(isIn);
            setEntry(ent);
            setMangaLiked(isLiked);
            setUserReview(uRev);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { isCancelled = true; };
  }, [id, user?.id, refreshKey]);

  const visibleReviews = useMemo(() => {
    const filtered = filterReviewsByRole(allReviews, reviewRole);
    return sortReviews(filtered, reviewSort);
  }, [allReviews, reviewRole, reviewSort]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 900) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    if (!shareMessage) return;
    const timer = window.setTimeout(() => setShareMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [shareMessage]);

  useEffect(() => {
    if (!actionError) return;
    const timer = window.setTimeout(() => setActionError(null), 3500);
    return () => window.clearTimeout(timer);
  }, [actionError]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--dark)' }}>
        <div className="loader-ring" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
      </div>
    );
  }

  if (!manga) {
    return (
      <>
        <header className="home-header">
          <div className="container header-container">
            <Link to="/home" className="logo">{FOOTER.brand}</Link>
          </div>
        </header>
        <main className="manga-not-found">
          <h1>{t.common.notAvailable}</h1>
          <Link to="/home" className="btn btn-primary"><ArrowLeft size={16} /> {t.common.back}</Link>
        </main>
      </>
    );
  }

  const IconCmp = getIcon(manga.cover);
  const isCreator = user?.role === 'creator' || user?.role === 'both';
  const isSupervisor = user?.role === 'supervisor';
  const hasCreatorAccess = isCreator || isSupervisor;
  
  const chapters = manga.chapters || [];
  const firstChapter = chapters[0];
  const lastRead = entry?.currentChapter ?? 0;

  const nextChapter =
    chapters.find((c) => c.number > lastRead) ??
    chapters.find((c) => c.number === lastRead) ??
    firstChapter;

  // --- LOGIQUE OPTIMISTE : BOUTON LIBRARY ---
  const handleToggleLibrary = async () => {
    if (!user) { navigate('/let-go'); return; }
    if (isLibraryLoading) return;
    
    // 1. On sauvegarde l'ancien état
    const previousState = inLibrary;
    
    // 2. On change l'état visuel immédiatement (sans attendre le serveur)
    setInLibrary(!previousState);
    setIsLibraryLoading(true);
    setActionError(null);

    try {
      // 3. On fait l'appel à Supabase
      if (previousState) {
        await removeFromLibrary(user.id, manga.id);
      } else {
        await addToLibrary(user.id, manga.id, 'reading');
      }
      // On rafraîchit silencieusement pour mettre à jour l'avancement des chapitres
      setRefreshKey(k => k + 1);
    } catch (err) {
      // 4. En cas d'erreur (RLS, réseau...), on annule le changement visuel
      setInLibrary(previousState);
      setActionError("Failed to update library. Please try again.");
    } finally {
      setIsLibraryLoading(false);
    }
  };

  // --- LOGIQUE OPTIMISTE : BOUTON LIKE ---
  const handleLikeManga = async () => {
    if (!user) { navigate('/let-go'); return; }
    if (isLikeLoading) return;

    // 1. On sauvegarde l'ancien état
    const previousLiked = mangaLiked;
    const previousLikesCount = manga.likes;

    // 2. On change l'état visuel immédiatement
    setMangaLiked(!previousLiked);
    setManga((prev) => prev ? { ...prev, likes: prev.likes + (previousLiked ? -1 : 1) } : null);
    
    setIsLikeLoading(true);
    setActionError(null);

    try {
      // 3. On fait l'appel à Supabase
      const isNowLiked = await toggleMangaLike(manga.id, user.id);
      
      // Synchronisation finale
      setMangaLiked(isNowLiked);
    } catch (err) {
      // 4. En cas d'erreur, on annule tout
      setMangaLiked(previousLiked);
      setManga((prev) => prev ? { ...prev, likes: previousLikesCount } : null);
      setActionError("Failed to update like. Please try again.");
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleRead = () => {
    if (!nextChapter) return;
    navigate(`/manga/${manga.id}/read/${nextChapter.number}`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: manga.title, url }); return; }
      if (navigator.clipboard) { await navigator.clipboard.writeText(url); setShareMessage(t.mangaDetail.linkCopied); return; }
      setShareMessage(t.mangaDetail.shareNotSupported);
    } catch { }
  };

  const handleAddReview = async (data: { rating: number; title: string; content: string }) => {
    if (!user) { navigate('/let-go'); return; }
    // Les erreurs remontent au formulaire (affichées sous le titre) au lieu d'être ignorées.
    await addReview({ id: user.id, name: user.name, role: (user.role ?? 'reader') as AuthorRole }, { mangaId: manga.id, ...data });
    setEditingReview(false);
    setRefreshKey((k) => k + 1);
  };

  const handleUpdateReview = async (data: { rating: number; title: string; content: string }) => {
    if (!user || !userReview) return;
    await updateReview(userReview.id, user.id, data);
    setEditingReview(false);
    setRefreshKey((k) => k + 1);
  };

  const handleDeleteReview = async () => {
    if (!user || !userReview) return;
    if (!window.confirm(t.reviewForm.deleteConfirm)) return;
    try {
      await deleteReview(userReview.id, user.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.common.errUnexpected);
      return;
    }
    setEditingReview(false);
    setRefreshKey((k) => k + 1);
  };

  const handleToggleHelpful = async (reviewId: string) => {
    if (!user) { navigate('/let-go'); return; }
    try {
      await toggleHelpful(reviewId, user.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.common.errUnexpected);
      return;
    }
    setRefreshKey((k) => k + 1);
  };

  const reviewCount = aggregate?.count ?? 0;
  const reviewCountLabel = reviewCount === 1 ? t.review.reviewOne : t.review.reviewMany;

  return (
    <>
      <div className="home-bg">
        <ParticlesCanvas />
        <FloatingShapes />
        <div className="bg-overlay" />
      </div>

      <header className={`home-header ${menuOpen ? 'menu-open' : ''}`}>
        <div className="container header-container">
          <div className="header-brand-group">
            <Link to="/home" className="logo" onClick={() => setMenuOpen(false)}>{FOOTER.brand}</Link>
            <div className="desktop-only-nav">
              <Link to="/home" className="header-icon-btn" onClick={() => setMenuOpen(false)} aria-label={t.common.home}><HomeIcon size={18} /></Link>
              <Link to="/community" className="header-icon-btn" onClick={() => setMenuOpen(false)} aria-label={t.common.community}><Users size={18} /></Link>
              <Link to="/awards" className="header-icon-btn" onClick={() => setMenuOpen(false)} aria-label={t.awards.title}><Trophy size={18} /></Link>
            </div>
          </div>

          <button className={`nav-toggle ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen((v) => !v)} aria-label={t.nav.menu} type="button">
            <span /><span /><span />
          </button>

          <div className={`header-actions ${menuOpen ? 'open' : ''}`}>
            <div className="mobile-only-nav">
              <Link to="/home" className="header-icon-btn active" onClick={() => setMenuOpen(false)}>
                <HomeIcon size={18} /> <span>{t.common.home}</span>
              </Link>
              <Link to="/community" className="header-icon-btn" onClick={() => setMenuOpen(false)}>
                <Users size={18} /> <span>{t.common.community}</span>
              </Link>
              <Link to="/awards" className="header-icon-btn" onClick={() => setMenuOpen(false)}>
                <Trophy size={18} /> <span>{t.awards.title}</span>
              </Link>
            </div>
            <SearchPanel />
            {hasCreatorAccess && <CreatorPanel />}
            <LiteModeToggle />
            <LanguageSwitcher />
            {!isSupervisor && <NotificationsPanel />}
            {!isSupervisor && <MessagesPanel />}
            <ProfileAvatar />
          </div>
        </div>
      </header>

      <main className="manga-detail-main">
        <Link to="/home" className="manga-back"><ArrowLeft size={14} /> {t.common.back}</Link>

        <section className={`manga-hero status-${manga.status}`}>
          <div className="manga-hero-bg" aria-hidden="true">
            <div className="manga-hero-blob blob-a" />
            <div className="manga-hero-blob blob-b" />
          </div>

          <div className="manga-hero-inner">
            <div className="manga-cover-frame">
              {manga.coverUrl ? (
                <img className="cover-fill" src={manga.coverUrl} alt={manga.title} />
              ) : (
                <div className="manga-cover-art"><IconCmp size={72} /></div>
              )}
              <span className={`manga-status status-${manga.status}`}>{manga.status}</span>
            </div>

            <div className="manga-hero-info">
              <span className="manga-genre-tag">{manga.genre}</span>
              <h1 className="manga-title">{manga.title}</h1>
              <p className="manga-subtitle">{manga.subtitle}</p>

              <div className="manga-author-line">
                <span className="manga-author-avatar">
                  {usersMap[manga.authorId]?.photo ? (
                    <img
                      src={usersMap[manga.authorId].photo}
                      alt={manga.author}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    manga.author.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="manga-author-info">
                  <span className="manga-author-label">{t.mangaDetail.author}</span>
                  <span className="manga-author-name">{manga.author}</span>
                </div>
                {user && user.id !== manga.authorId && (
                  <FollowButton targetId={manga.authorId} type="creator" size="sm" variant="outline" />
                )}
              </div>

              <div className="manga-stats-row">
                <span><Star size={13} fill="currentColor" /> {manga.rating.toFixed(1)}</span>
                <span><Eye size={13} /> {formatNumber(manga.reads)} {t.mangaDetail.reads}</span>
                <span><Heart size={13} /> {formatNumber(manga.likes)}</span>
                <span><BookOpen size={13} /> {chapters.length} {t.common.chapterShort}</span>
              </div>

              {actionError && <span className="form-message error" style={{ marginTop: 10 }}>{actionError}</span>}

              <div className="manga-actions">
                <button type="button" className="btn btn-primary" onClick={handleRead} disabled={!nextChapter}>
                  <Play size={16} fill="currentColor" />
                  {lastRead > 0 ? t.mangaDetail.continueReading : t.mangaDetail.startReading}
                </button>
                
                <button 
                  type="button" 
                  className={`manga-action-btn ${inLibrary ? 'active' : ''}`} 
                  onClick={handleToggleLibrary}
                  disabled={isLibraryLoading}
                >
                  {isLibraryLoading ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    inLibrary ? <BookmarkCheck size={16} /> : <Bookmark size={16} />
                  )}
                  {inLibrary ? t.mangaDetail.inLibrary : t.mangaDetail.library}
                </button>

                <button 
                  type="button" 
                  className={`manga-action-btn ${mangaLiked ? 'active' : ''}`} 
                  onClick={handleLikeManga}
                  disabled={isLikeLoading}
                >
                  {isLikeLoading ? <Loader2 size={16} className="spin" /> : <Heart size={16} fill={mangaLiked ? 'currentColor' : 'none'} />}
                  {mangaLiked ? t.mangaDetail.liked : t.mangaDetail.like}
                </button>

                <button type="button" className="manga-action-btn" onClick={handleShare}>
                  <Share2 size={16} />
                  {t.mangaDetail.share}
                </button>
              </div>

              {shareMessage && <span className="manga-share-msg">{shareMessage}</span>}
            </div>
          </div>
        </section>

        <section className="manga-synopsis-section">
          <h2>{t.mangaDetail.synopsis}</h2>
          <p>{manga.description}</p>
        </section>

        <section className="manga-chapters-section">
          <h2>{t.mangaDetail.chapters}</h2>
          {chapters.length === 0 ? (
            <div className="manga-empty">{t.mangaDetail.noChapters}</div>
          ) : (
            <ul className="manga-chapters-list">
              {chapters.map((c) => {
                const isRead = entry?.chaptersRead.includes(c.number);
                return (
                  <li key={c.id} className={`manga-chapter-item ${isRead ? 'read' : ''}`}>
                    <Link to={`/manga/${manga.id}/read/${c.number}`} className="manga-chapter-link">
                      {c.coverUrl && <img className="manga-chapter-thumb" src={c.coverUrl} alt="" loading="lazy" />}
                      <span className="manga-chapter-num">{t.common.chapterShort} {c.number}</span>
                      <span className="manga-chapter-title">{c.title}</span>
                      <span className="manga-chapter-meta">
                        <Clock size={11} />
                        {c.publishedAt ? formatDateShort(c.publishedAt, lang) : ''}
                      </span>
                      <ChevronRight size={14} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="manga-reviews-section">
          <header className="manga-reviews-header">
            <div>
              <h2>{t.mangaDetail.reviews}</h2>
              {aggregate && (
                <div className="manga-rating-summary">
                  <Stars value={aggregate.average} size={16} />
                  <strong>{aggregate.average.toFixed(1)}</strong>
                  <span>{reviewCount} {reviewCountLabel}</span>
                </div>
              )}
            </div>
            {user && !userReview && !editingReview && (
              <button type="button" className="btn btn-outline" onClick={() => setEditingReview(true)}>
                <PenTool size={14} /> {t.mangaDetail.writeReview}
              </button>
            )}
          </header>

          {userReview && !editingReview && (
            <div className="my-review-card">
              <div className="my-review-head">
                <span>{t.reviewForm.yourReview}</span>
                <div className="my-review-actions">
                  <button type="button" onClick={() => setEditingReview(true)} aria-label={t.common.edit}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={handleDeleteReview} aria-label={t.common.delete}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="my-review-body">
                <Stars value={userReview.rating} />
                <strong>{userReview.title}</strong>
                <p>{userReview.content}</p>
              </div>
            </div>
          )}

          {editingReview && (
            <ReviewForm
              initial={userReview}
              onSubmit={userReview ? handleUpdateReview : handleAddReview}
              onCancel={() => setEditingReview(false)}
            />
          )}

          {allReviews.length === 0 ? (
            <div className="manga-empty">
              <p>{t.mangaDetail.noReviews}</p>
              <span>{t.mangaDetail.noReviewDesc}</span>
            </div>
          ) : (
            <>
              <div className="reviews-controls">
                <div className="reviews-filter">
                  {ROLE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`review-chip ${reviewRole === opt.id ? 'active' : ''}`}
                        onClick={() => setReviewRole(opt.id)}
                      >
                        <Icon size={12} /> {opt.label}
                      </button>
                    );
                  })}
                </div>
                <select
                  className="reviews-sort"
                  value={reviewSort}
                  onChange={(e) => setReviewSort(e.target.value as ReviewSort)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>

              {visibleReviews.length === 0 ? (
                <div className="manga-empty">{t.mangaDetail.noReviewMatch}</div>
              ) : (
                <ul className="reviews-list">
                  {visibleReviews.map((review) => {
                    const author = usersMap[review.authorId];
                    const isHelpful = user ? review.helpful.includes(user.id) : false;
                    const isCreatorReview = isCreatorRole(review.authorRole);
                    return (
                      <li key={review.id} className={`review-item ${isCreatorReview ? 'creator' : ''}`}>
                        <div className="review-author">
                          <span className="review-avatar">
                            {author?.photo ? (
                              <img
                                src={author.photo}
                                alt={review.authorName}
                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                              />
                            ) : (
                              review.authorName.charAt(0).toUpperCase()
                            )}
                          </span>
                          <div>
                            <strong>{review.authorName}</strong>
                            {isCreatorReview && (
                              <span className="review-creator-badge">
                                <PenTool size={9} /> {t.common.roleCreator}
                              </span>
                            )}
                            <span className="review-date">
                              {formatRelativeTime(review.createdAt, lang)}
                            </span>
                          </div>
                        </div>
                        <div className="review-body">
                          <Stars value={review.rating} />
                          <strong className="review-title">{review.title}</strong>
                          <p>{review.content}</p>
                          <button
                            type="button"
                            className={`review-helpful ${isHelpful ? 'active' : ''}`}
                            onClick={() => handleToggleHelpful(review.id)}
                            disabled={!user}
                          >
                            <ThumbsUp size={12} /> {t.mangaDetail.helpful} ({review.helpful.length})
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>

        {related.length > 0 && (
          <section className="manga-related-section">
            <h2>{t.mangaDetail.related}</h2>
            <div className="related-grid">
              {related.map((r) => {
                const RIcon = getIcon(r.cover);
                return (
                  <Link key={r.id} to={`/manga/${r.id}`} className="related-card">
                    <div className="related-cover">
                      <RIcon size={32} />
                      <span className={`related-status status-${r.status}`}>{r.status}</span>
                    </div>
                    <strong>{r.title}</strong>
                    <span>{r.genre}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
