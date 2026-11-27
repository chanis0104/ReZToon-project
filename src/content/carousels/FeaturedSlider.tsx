import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck,
} from 'lucide-react';
import type { FeaturedSlide } from '../../core/services/catalogueService';
import type { FeaturedPeriod } from '../../core/services/rankingService';
import { getMangaForCard } from '../../core/services/mangaService';
import { useCurrentUser } from '../../core/hooks/useCurrentUser';
import { addToLibrary, getLibrary } from '../../core/services/libraryService';
import { useT } from '../../config/i18n';

interface FeaturedSliderProps {
  slides: FeaturedSlide[];
  autoPlayMs?: number;
  period?: FeaturedPeriod;
  onPeriodChange?: (period: FeaturedPeriod) => void;
}

interface SlideMeta {
  id: string;
  description: string;
}

export default function FeaturedSlider({
  slides,
  autoPlayMs = 5000,
  period,
  onPeriodChange,
}: FeaturedSliderProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [libraryIds, setLibraryIds] = useState<Set<string>>(new Set());

  const timerRef = useRef<number | null>(null);

  const user = useCurrentUser();
  const navigate = useNavigate();
  const t = useT();

  const total = slides.length;
  const fr = t.featuredRanking;

  // Changement de période / de classement : on repart de la première slide.
  const slidesKey = slides.map((s) => s.id).join('|');
  useEffect(() => {
    setCurrent(0);
    setPrevIndex(null);
  }, [slidesKey, period]);

  useEffect(() => {
    if (!user) {
      setLibraryIds(new Set());
      return;
    }
    let cancelled = false;
    getLibrary(user.id)
      .then((entries) => {
        if (!cancelled) {
          setLibraryIds(new Set(entries.map((e) => e.mangaId)));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const metaMap = useMemo(() => {
    const map = new Map<string, SlideMeta>();
    slides.forEach((s) => {
      const fullTitle = `${s.title} ${s.highlight}`.trim();
      const genre = s.meta[0] ?? '';
      const manga = getMangaForCard({ id: s.id, title: fullTitle, genre });
      map.set(s.id, {
        id: s.id,
        description: manga?.description ?? s.description,
      });
    });
    return map;
  }, [slides]);

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      const wrapped = ((next % total) + total) % total;
      setPrevIndex(current);
      setCurrent(wrapped);
    },
    [current, total],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (paused || total <= 1) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      next();
    }, autoPlayMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [paused, current, autoPlayMs, next, total]);

  useEffect(() => {
    if (prevIndex === null) return;
    const id = window.setTimeout(() => setPrevIndex(null), 600);
    return () => window.clearTimeout(id);
  }, [prevIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(id);
  }, [feedback]);

  const handleRead = (mangaId: string) => {
    if (!mangaId) {
      setFeedback(t.common.notAvailable);
      return;
    }
    navigate(`/manga/${mangaId}`);
  };

  const handleAddToList = async (mangaId: string) => {
    if (!user) {
      navigate('/let-go');
      return;
    }
    if (!mangaId) {
      setFeedback(t.common.notAvailable);
      return;
    }
    if (libraryIds.has(mangaId)) {
      setFeedback(t.home.inList);
      return;
    }
    await addToLibrary(user.id, mangaId, 'wishlist');
    setLibraryIds((prev) => new Set(prev).add(mangaId));
    setFeedback(t.home.inList);
  };

  if (total === 0) return null;

  return (
    <section
      className="featured-slider"
      id="home"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {period && onPeriodChange && (
        <div className="featured-period-bar">
          <div className="featured-period-switch" role="tablist" aria-label={fr.switchLabel}>
            {(['week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                className={`featured-period-btn ${period === p ? 'active' : ''}`}
                onClick={() => onPeriodChange(p)}
              >
                {p === 'week' ? fr.week : fr.month}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="featured-slider-track">
        {slides.map((s, i) => {
          const isActive = i === current;
          const isPrev = i === prevIndex;
          const meta = metaMap.get(s.id);
          const mangaId = meta?.id ?? s.id;
          const description = meta?.description ?? s.description;
          const inList = Boolean(user && mangaId && libraryIds.has(mangaId));

          return (
            <article
              key={s.id}
              className={`featured-slide ${isActive ? 'active' : ''} ${isPrev ? 'leaving' : ''} ${s.coverUrl ? 'has-cover' : ''}`}
              aria-hidden={!isActive}
            >
              <div
                className="featured-slide-bg"
                style={{ backgroundImage: `url(${s.image})` }}
              />
              <div className="featured-slide-overlay" />

              <div className="container featured-container">
                <div className="featured-content">
                  <div className="featured-badge-row">
                    {s.rank !== undefined && (
                      <span className="featured-rank" title={period === 'month' ? fr.topMonth : fr.topWeek}>
                        <span className="featured-rank-hash">#</span>{s.rank}
                        {period && (
                          <span className="featured-rank-period">
                            {period === 'month' ? fr.topMonth : fr.topWeek}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="featured-badge">{s.badge}</span>
                    {s.allTime && <span className="featured-alltime">{fr.allTime}</span>}
                  </div>

                  <h1 className="featured-title">
                    {s.title}
                    <br />
                    <span className="highlight">{s.highlight}</span>
                  </h1>

                  <div className="featured-meta">
                    <span className="age-badge">{s.ageBadge}</span>
                    {s.meta.map((m) => (
                      <span key={m} className="meta-item">
                        {m}
                      </span>
                    ))}
                    <span className="meta-item rating">{s.rating}</span>
                  </div>

                  <p className="featured-desc">{description}</p>

                  <div className="featured-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-glow"
                      onClick={() => handleRead(mangaId)}
                    >
                      <span className="btn-icon">
                        <Play size={14} />
                      </span>
                      {t.home.readNow}
                      <span className="btn-glow-ring" />
                    </button>

                    <button
                      type="button"
                      className={`btn btn-outline featured-list-btn ${inList ? 'added' : ''}`}
                      onClick={() => handleAddToList(mangaId)}
                    >
                      <span className="btn-icon">
                        {inList ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </span>
                      {inList ? t.home.inList : t.home.addToList}
                    </button>
                  </div>

                  {isActive && feedback && (
                    <div className="featured-feedback" role="status">
                      {feedback}
                    </div>
                  )}

                  <div className="featured-stats">
                    {s.stats.map((stat) => (
                      <div key={stat.label} className="featured-stat">
                        <strong>{stat.value}</strong>
                        <span>{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {s.coverUrl && (
                  <div className="featured-poster" aria-hidden="true">
                    <img src={s.coverUrl} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            className="featured-nav featured-nav-prev"
            onClick={prev}
            aria-label={t.common.previous}
          >
            <ChevronLeft size={20} />
          </button>

          <button
            type="button"
            className="featured-nav featured-nav-next"
            onClick={next}
            aria-label={t.common.next}
          >
            <ChevronRight size={20} />
          </button>

          <div className="featured-dots" role="tablist" aria-label="Slides">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={`Go to slide ${i + 1}`}
                className={`featured-dot ${i === current ? 'active' : ''}`}
                onClick={() => goTo(i)}
              >
                <span className="featured-dot-fill" />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
