import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Calendar, Play, Bookmark, BookmarkCheck,
  Flame, Tag, Loader2,
} from 'lucide-react';
import { getIcon } from '../../shared/ui/Icon';
import {
  getAllWeeklyReleases,
  getWeeklyFiltered,
  sortByDay,
  getWeeklyCounts,
  getDayCounts,
  WEEK_DAYS,
  type WeeklyRelease,
  type WeekDay,
} from '../../core/services/weeklyService';
import { getMangaForCard } from '../../core/services/mangaService';
import { useHorizontalScroll } from '../../core/hooks/useHorizontalScroll';
import { useLibraryToggle } from '../../core/hooks/useLibraryToggle';
import { useGenres } from '../../core/hooks/useGenres';
import { useT } from '../../config/i18n';

type GenreFilter = 'all' | string;
type DayFilter = 'all' | WeekDay;

interface CardMeta {
  id: string;
  coverUrl?: string;
  description: string;
}

const DAY_CLASS: Record<WeekDay, string> = {
  Monday: 'monday', Tuesday: 'tuesday', Wednesday: 'wednesday',
  Thursday: 'thursday', Friday: 'friday', Saturday: 'saturday', Sunday: 'sunday',
};

const DAY_SHORT: Record<WeekDay, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

export default function WeeklyReleases() {
  const navigate = useNavigate();
  const t = useT();
  const [genreFilter, setGenreFilter] = useState<GenreFilter>('all');
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');
  const [allReleases, setAllReleases] = useState<WeeklyRelease[]>([]);
  const [loading, setLoading] = useState(true);

  const { isInLibrary, addToLib, feedback, setFeedback } =
    useLibraryToggle<string>({ onGuestAttempt: () => navigate('/let-go') });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await getAllWeeklyReleases();
      if (!cancelled) {
        setAllReleases(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const { names: genreNames } = useGenres();
  const genreCounts = useMemo(
    () => getWeeklyCounts(allReleases, dayFilter, genreNames),
    [allReleases, dayFilter, genreNames],
  );
  const dayCounts = useMemo(
    () => getDayCounts(allReleases, genreFilter),
    [allReleases, genreFilter],
  );

  const releases = useMemo(
    () => sortByDay(getWeeklyFiltered(allReleases, genreFilter, dayFilter)),
    [allReleases, genreFilter, dayFilter],
  );

  const metaMap = useMemo(() => {
    const map = new Map<string, CardMeta>();
    releases.forEach((r) => {
      const manga = getMangaForCard({ id: r.mangaId, title: r.title, genre: r.genre });
      // Couverture du chapitre en priorité, sinon celle de la série.
      const chapterCover = manga?.chapters?.find((c) => c.number === r.chapterNumber)?.coverUrl;
      map.set(r.id, {
        id: r.id,
        coverUrl: chapterCover ?? manga?.coverUrl,
        description:
          manga?.description ??
          `A ${r.genre} story, ${r.tag.toLowerCase()}. Chapter ${r.chapter} arrives ${r.day}.`,
      });
    });
    return map;
  }, [releases]);

  const {
    trackRef,
    canPrev,
    canNext,
    isDragging,
    scrollByAmount,
    dragHandlers,
    resetScroll,
  } = useHorizontalScroll('.weekly-card', {
    gap: 18,
    dragIgnoreSelector: '.annonce-hover',
    resetKey: `${genreFilter}|${dayFilter}|${releases.length}`,
  });

  useEffect(() => {
    resetScroll();
  }, [genreFilter, dayFilter, resetScroll]);

  const handleRead = (releaseId: string, mangaId: string) => {
    if (!mangaId) {
      setFeedback({ id: releaseId, text: t.common.notAvailable });
      return;
    }
    navigate(`/manga/${mangaId}`);
  };

  if (loading) {
    return (
      <section className="weekly-section" aria-label={t.home.weeklyReleases}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Loader2 size={30} className="spin" style={{ color: 'var(--primary)' }} />
        </div>
      </section>
    );
  }

  return (
    <section className="weekly-section" aria-label={t.home.weeklyReleases}>
      <header className="weekly-header">
        <div className="weekly-heading">
          <span className="weekly-tag">
            <Flame size={12} /> {t.home.weeklyReleases}
          </span>
          <h2 className="weekly-title">{t.home.weeklyTitle}</h2>
          <p className="weekly-subtitle">
            {releases.length} {t.home.weeklySubtitle}
          </p>
        </div>

        <div className="annonces-nav">
          <button
            type="button"
            className="annonces-arrow"
            onClick={() => scrollByAmount(-1)}
            disabled={!canPrev}
            aria-label={t.common.previous}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="annonces-arrow"
            onClick={() => scrollByAmount(1)}
            disabled={!canNext}
            aria-label={t.common.next}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="weekly-filters-container">
        <div className="weekly-filter-row">
          <span className="weekly-filter-label">
            <Tag size={11} /> {t.home.category}
          </span>
          <div className="weekly-filters" role="tablist">
            <button
              type="button"
              className={`weekly-chip ${genreFilter === 'all' ? 'active' : ''}`}
              onClick={() => setGenreFilter('all')}
            >
              <span>{t.communityFeed.feedFilters.all}</span>
              <span className="weekly-chip-count">{genreCounts.all}</span>
            </button>
            {genreNames.map((g) => (
              <button
                key={g}
                type="button"
                className={`weekly-chip ${genreFilter === g ? 'active' : ''}`}
                onClick={() => setGenreFilter(g)}
              >
                <span>{g}</span>
                <span className="weekly-chip-count">{genreCounts[g] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="weekly-filter-row">
          <span className="weekly-filter-label">
            <Calendar size={11} /> {t.home.day}
          </span>
          <div className="weekly-filters" role="tablist">
            <button
              type="button"
              className={`weekly-chip day-chip ${dayFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDayFilter('all')}
            >
              <span>{t.home.allDays}</span>
              <span className="weekly-chip-count">{dayCounts.all}</span>
            </button>
            {WEEK_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`weekly-chip day-chip day-${DAY_CLASS[d]} ${dayFilter === d ? 'active' : ''}`}
                onClick={() => setDayFilter(d)}
                title={d}
              >
                <span className="weekly-day-dot" />
                <span>{DAY_SHORT[d]}</span>
                <span className="weekly-chip-count">{dayCounts[d] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {releases.length === 0 ? (
        <div className="weekly-empty">
          <Calendar size={28} />
          <p>{t.home.noReleases}</p>
          <span>{t.home.tryAnotherDay}</span>
        </div>
      ) : (
        <div
          ref={trackRef}
          className={`annonces-track weekly-track ${isDragging ? 'dragging' : ''}`}
          {...dragHandlers}
        >
          {releases.map((release) => {
            const IconCmp = getIcon(release.icon);
            const cardMeta = metaMap.get(release.id);
            const description = cardMeta?.description ?? '';
            const inList = isInLibrary(release.mangaId);
            const isFeedback = feedback?.id === release.id;
            const dayClass = DAY_CLASS[release.day];

            return (
              <article key={release.id} className={`annonce-card weekly-card day-${dayClass}`}>
                <div className="annonce-cover">
                  {cardMeta?.coverUrl ? (
                    <img className="cover-fill" src={cardMeta.coverUrl} alt="" loading="lazy" />
                  ) : (
                    <IconCmp size={44} />
                  )}
                  <span className="annonce-genre">{release.genre}</span>
                  <span className="weekly-chapter">{t.common.chapterShort} {release.chapter}</span>
                </div>

                <div className="weekly-day-ribbon">
                  <span className="weekly-day-dot" />
                  <span className="weekly-day-name">{release.day}</span>
                  <span className="weekly-day-sep">·</span>
                  <span className="weekly-day-label">{release.label}</span>
                </div>

                <div className="annonce-body">
                  <h3 className="annonce-title" title={release.title}>{release.title}</h3>
                  <p className="annonce-sub">{release.subtitle}</p>
                  <span className="annonce-tag">{release.tag}</span>
                </div>

                <div className="annonce-hover">
                  <p className="annonce-desc">{description}</p>
                  <div className="annonce-hover-actions">
                    <button
                      type="button"
                      className="annonce-action-btn read"
                      onClick={() => handleRead(release.id, release.mangaId)}
                    >
                      <Play size={13} fill="currentColor" /> {t.common.read}
                    </button>
                    <button
                      type="button"
                      className={`annonce-action-btn list ${inList ? 'added' : ''}`}
                      onClick={() => addToLib(release.id, release.mangaId)}
                    >
                      {inList ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                      {inList ? t.home.inList : t.home.addToList}
                    </button>
                  </div>
                  {isFeedback && <span className="annonce-hover-feedback">{feedback?.text}</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
