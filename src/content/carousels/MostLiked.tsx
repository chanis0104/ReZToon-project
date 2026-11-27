import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Heart, Sparkles, Play, Bookmark, BookmarkCheck,
} from 'lucide-react';
import { getIcon } from '../../shared/ui/Icon';
import { getMangaForCard } from '../../core/services/mangaService';
import { useHorizontalScroll } from '../../core/hooks/useHorizontalScroll';
import { useLibraryToggle } from '../../core/hooks/useLibraryToggle';
import { useT } from '../../config/i18n';
import type { LikedBookData } from '../../config/types';

interface MostLikedProps {
  books: LikedBookData[];
  title?: string;
  subtitle?: string;
  tag?: string;
}

interface CardMeta {
  id: string;
  description: string;
}

function formatLikes(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function MostLiked({
  books,
  title,
  subtitle,
  tag,
}: MostLikedProps) {
  const navigate = useNavigate();
  const t = useT();
  const items = books ?? [];

  const finalTitle = title || t.home.mostLiked;
  const finalSubtitle = subtitle || t.home.mostLikedSub;
  const finalTag = tag || t.home.mostLiked;

  const { isInLibrary, addToLib, feedback, setFeedback } =
    useLibraryToggle<string>({ onGuestAttempt: () => navigate('/let-go') });

  const {
    trackRef,
    canPrev,
    canNext,
    isDragging,
    scrollByAmount,
    dragHandlers,
  } = useHorizontalScroll('.liked-card', {
    gap: 20,
    dragIgnoreSelector: '.annonce-hover',
    resetKey: items.length,
  });

  const metaMap = useMemo(() => {
    const map = new Map<string, CardMeta>();
    items.forEach((book) => {
      const manga = getMangaForCard({ id: book.id, title: book.title, genre: book.genre });
      map.set(book.id, {
        id: book.id,
        description:
          manga?.description ??
          `A ${book.genre} story, ${book.tag.toLowerCase()}. Discover the full series on ReZToon.`,
      });
    });
    return map;
  }, [items]);

  const handleRead = (mangaId: string) => {
    if (!mangaId) {
      setFeedback({ id: mangaId, text: t.common.notAvailable });
      return;
    }
    navigate(`/manga/${mangaId}`);
  };

  if (items.length === 0) return null;

  return (
    <section className="annonces-section annonces-section-liked" aria-label={finalTitle}>
      <div className="annonces-header">
        <div className="annonces-heading">
          <span className="annonces-tag">
            <Heart size={12} fill="currentColor" /> {finalTag}
          </span>
          <h2 className="annonces-title">{finalTitle}</h2>
          <p className="annonces-subtitle">{finalSubtitle}</p>
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
      </div>

      <div
        ref={trackRef}
        className={`annonces-track ${isDragging ? 'dragging' : ''}`}
        {...dragHandlers}
      >
        {items.map((book) => {
          const IconCmp = getIcon(book.icon);
          const medal =
            book.rank === 1 ? 'gold' : book.rank === 2 ? 'silver' : book.rank === 3 ? 'bronze' : 'std';
          const cardMeta = metaMap.get(book.id);
          const description = cardMeta?.description ?? '';
          const inList = isInLibrary(book.id);
          const isFeedback = feedback?.id === book.id;

          return (
            <article
              key={book.id}
              className={`annonce-card liked-card rank-${medal}`}
              data-book-id={book.id}
            >
              <span className={`liked-rank ${medal}`}>
                {book.rank <= 3 ? <Sparkles size={11} /> : '#'}
                {book.rank}
              </span>

              <div className="annonce-cover">
                {book.coverUrl ? (
                  <img className="cover-fill" src={book.coverUrl} alt="" loading="lazy" />
                ) : (
                  <IconCmp size={48} />
                )}
                <span className="annonce-genre">{book.genre}</span>
              </div>

              <div className="annonce-body">
                <h3 className="annonce-title" title={book.title}>
                  {book.title}
                </h3>
                <p className="annonce-sub">{book.sub}</p>

                <div className="liked-foot">
                  <span className="annonce-tag">{book.tag}</span>
                  <span className="liked-count">
                    <Heart size={12} fill="currentColor" />
                    {formatLikes(book.likes)}
                  </span>
                </div>
              </div>

              <div className="annonce-hover">
                <p className="annonce-desc">{description}</p>

                <div className="annonce-hover-actions">
                  <button
                    type="button"
                    className="annonce-action-btn read"
                    onClick={() => handleRead(book.id)}
                  >
                    <Play size={13} fill="currentColor" />
                    {t.common.read}
                  </button>
                  <button
                    type="button"
                    className={`annonce-action-btn list ${inList ? 'added' : ''}`}
                    onClick={() => addToLib(book.id, book.id)}
                  >
                    {inList ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                    {inList ? t.home.inList : t.home.addToList}
                  </button>
                </div>

                {isFeedback && (
                  <span className="annonce-hover-feedback">{feedback?.text}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
