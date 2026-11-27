import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Home as HomeIcon, Trophy, BookOpen, Loader2 } from 'lucide-react';
import ParticlesCanvas from '../../shared/effects/ParticlesCanvas';
import FloatingShapes from '../../shared/effects/FloatingShapes';
import ProfileAvatar from '../../shared/layout/ProfileAvatar';
import SearchPanel from '../../shared/panels/SearchPanel';
import CreatorPanel from '../../shared/panels/CreatorPanel';
import NotificationsPanel from '../../shared/panels/NotificationsPanel';
import MessagesPanel from '../../shared/panels/MessagesPanel';
import LanguageSwitcher from '../../shared/ui/LanguageSwitcher';
import LiteModeToggle from '../../shared/ui/LiteModeToggle';
import FollowingFeed from '../../content/carousels/FollowingFeed';
import RecommendedSection from '../../content/recommendations/RecommendedSection';
import ContinueReadingSection from '../../content/recommendations/ContinueReadingSection';
import Annonces from '../../content/carousels/Annonces';
import MostLiked from '../../content/carousels/MostLiked';
import SuggestedCreators from '../../content/carousels/SuggestedCreators';
import FeaturedSlider from '../../content/carousels/FeaturedSlider';
import { EventsCarousel } from '../events';
import { CharactersCarousel } from '../characters';
import { useCurrentUser } from '../../core/hooks/useCurrentUser';
import { useRecommendations } from '../../core/hooks/useRecommendations';
import { getAllMangas, type Manga } from '../../core/services/mangaService';
import { getFooter } from '../../core/services/catalogueService';
import {
  getFeaturedRanking, rankByAverage,
  type FeaturedPeriod, type FeaturedRankEntry,
} from '../../core/services/rankingService';
import { formatNumber } from '../../core/utils/format';
import { useGenres } from '../../core/hooks/useGenres';
import { useT } from '../../config/i18n';
import { useIsMobile } from '../../core/hooks/useIsMobile';
import { MobileHeader } from '../../shared/layout/mobile';
import '../../styles/home-style.css';
import '../../styles/profile-style.css';
import '../../styles/panel-style.css';
import '../../styles/pwa-style.css';
import '../../styles/follow-style.css';
import '../../styles/recommendation-style.css';
import '../../styles/events-reader-style.css';
import '../../styles/characters-style.css';

// Seules les images réellement présentes dans /public/Images (2.jpeg et 3.jpeg n'existent pas)
const FEATURED_IMAGES = ['/Images/1.jpeg', '/Images/4.png', '/Images/5.png', '/Images/6.png', '/Images/7.png'];

export default function Home() {
  const isMobile = useIsMobile();

  const user = useCurrentUser();
  const userId = user?.id;
  const t = useT();

  const { forYou, becauseYouRead, continueReading, loading: recLoading } = useRecommendations();

  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { names: footerGenres } = useGenres();
  const FOOTER = getFooter(footerGenres);

  useEffect(() => {
    let isCancelled = false;
    async function fetchMangas() {
      try {
        const data = await getAllMangas({ throwOnError: true });
        if (!isCancelled) {
          setMangas(data);
          setLoadError(false);
        }
      } catch {
        if (!isCancelled) {
          setMangas([]);
          setLoadError(true);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    fetchMangas();
    return () => { isCancelled = true; };
  }, []);

  const isCreator = user?.role === 'creator' || user?.role === 'both';
  const isSupervisor = user?.role === 'supervisor';
  const hasCreatorAccess = isCreator || isSupervisor;

  // Top 5 de la semaine / du mois (moyenne vues + likes ; mois pondéré par les apparitions hebdo).
  const [period, setPeriod] = useState<FeaturedPeriod>('week');
  const [rankings, setRankings] = useState<Record<FeaturedPeriod, FeaturedRankEntry[] | null>>({
    week: null,
    month: null,
  });

  useEffect(() => {
    if (mangas.length === 0) return;
    let cancelled = false;
    Promise.all([
      getFeaturedRanking('week', 5, mangas),
      getFeaturedRanking('month', 5, mangas),
    ])
      .then(([week, month]) => {
        if (!cancelled) setRankings({ week: week.entries, month: month.entries });
      })
      .catch((err) => console.error('[Home] featured ranking failed:', err));
    return () => { cancelled = true; };
  }, [mangas]);

  const fr = t.featuredRanking;
  const featuredSlides = useMemo(() => {
    const byId = new Map<string, Manga>(mangas.map((m): [string, Manga] => [m.id, m]));
    const entries = rankings[period] ?? rankByAverage(mangas, 5);

    return entries
      .map((entry, index) => {
        const m = byId.get(entry.mangaId);
        if (!m) return null;
        const stats = [
          { value: formatNumber(entry.views), label: fr.views },
          { value: formatNumber(entry.likes), label: fr.likes },
          { value: entry.score.toLocaleString(undefined, { maximumFractionDigits: 1 }), label: fr.score },
        ];
        if (period === 'month' && entry.hasActivity) {
          stats.push({ value: String(entry.appearances), label: fr.appearances });
        }
        return {
          id: m.id,
          badge: m.tag || 'NEW RELEASE',
          title: m.title.split(' ').slice(0, 2).join(' '),
          highlight: m.title.split(' ').slice(2).join(' ') || m.subtitle || '',
          ageBadge: '13+',
          meta: [m.genre, m.author],
          rating: `★ ${(m.rating || 0).toFixed(1)}`,
          description: m.description || '',
          stats,
          image: FEATURED_IMAGES[index % FEATURED_IMAGES.length],
          coverUrl: m.coverUrl,
          rank: entry.rank,
          allTime: !entry.hasActivity,
        };
      })
      .filter((slide): slide is NonNullable<typeof slide> => slide !== null);
  }, [mangas, rankings, period, fr]);

  const popularCards = mangas.slice(0, 10).map((m) => ({
    id: m.id,
    title: m.title,
    sub: m.author,
    tag: m.tag || 'Series',
    icon: m.cover,
    coverUrl: m.coverUrl,
    genre: m.genre,
  }));

  const mostLiked = mangas.slice().sort((a, b) => b.likes - a.likes).slice(0, 12).map((m, i) => ({
    id: m.id,
    title: m.title,
    sub: m.author,
    tag: m.tag || 'Series',
    icon: m.cover,
    coverUrl: m.coverUrl,
    genre: m.genre,
    likes: m.likes,
    rank: i + 1,
  }));

  return (
    <>
      <div className="home-bg">
        <ParticlesCanvas />
        <FloatingShapes />
        <div className="bg-overlay" />
      </div>

      {isMobile ? (
        <MobileHeader hasCreatorAccess={hasCreatorAccess} isSupervisor={isSupervisor} />
      ) : (
        <header className="home-header">
          <div className="container header-container">
            <div className="header-brand-group">
              <Link to="/home" className="logo">
                {FOOTER.brand}
              </Link>

              <nav className="desktop-only-nav" aria-label="Navigation">
                <Link to="/home" className="header-icon-btn active" aria-label={t.common.home} aria-current="page">
                  <HomeIcon size={18} />
                </Link>
                <Link to="/community" className="header-icon-btn" aria-label={t.common.community}>
                  <Users size={18} />
                </Link>
                <Link to="/awards" className="header-icon-btn" aria-label={t.awards.title}>
                  <Trophy size={18} />
                </Link>
              </nav>
            </div>

            <div className="header-actions">
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
      )}

      <main className="home-main" style={{ marginTop: isMobile ? 'var(--header-height-mobile)' : 0 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#fff' }}>
            <Loader2 size={40} className="spin" style={{ color: 'var(--primary)' }} />
            <p style={{ marginTop: 20, fontWeight: 700, letterSpacing: '1px' }}>{t.common.loading}</p>
          </div>
        ) : (
          <>
            {mangas.length === 0 ? (
              <div className="empty-state-container" style={{ minHeight: '40vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 20px', marginBottom: 40 }}>
                <BookOpen size={64} style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: 20 }} />
                <h2 style={{ fontWeight: 900, color: '#fff', textAlign: 'center' }}>{loadError ? t.home.loadError : t.home.emptyPlatform}</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.6 }}>
                  {loadError ? t.home.loadErrorDesc : t.home.emptyPlatformDesc}
                </p>
                {hasCreatorAccess && (
                  <Link 
                    to="/creator" 
                    className="btn btn-primary" 
                    style={{ marginTop: 20, width: 'fit-content', padding: '12px 32px', minWidth: '220px' }}
                  >
                    {t.home.goCreator}
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="featured-hero">
                  <FeaturedSlider
                    slides={featuredSlides}
                    autoPlayMs={25000}
                    period={period}
                    onPeriodChange={setPeriod}
                  />
                  <div className="featured-particles-layer" aria-hidden="true">
                    <ParticlesCanvas count={40} />
                  </div>
                  <div className="featured-particles-glow" aria-hidden="true" />
                </div>

                {userId && recLoading && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.5)' }}>
                    <Loader2 size={24} className="spin" style={{ color: 'var(--primary)', margin: '0 auto 10px' }} />
                    <p style={{ fontSize: '0.9rem' }}>{t.common.loading}</p>
                  </div>
                )}

                {userId && !recLoading && continueReading.length > 0 && (
                  <ContinueReadingSection items={continueReading} />
                )}

                {userId && !recLoading && forYou.length > 0 && (
                  <RecommendedSection
                    title={t.home.trending}
                    subtitle={t.home.suggestedReadSub}
                    tag={t.home.trending}
                    recommendations={forYou}
                    tagIcon="trending"
                  />
                )}

                {userId && !recLoading && becauseYouRead.length > 0 && (
                  <RecommendedSection
                    title={t.mangaDetail.related}
                    subtitle={t.home.becauseYouReadSub}
                    tag={t.home.becauseYouRead}
                    recommendations={becauseYouRead}
                    tagIcon="sparkles"
                  />
                )}

                {userId && (
                  <div style={{ width: '90%', maxWidth: 1280, margin: '0 auto 40px' }}>
                    <FollowingFeed />
                  </div>
                )}

                {hasCreatorAccess && userId && (
                  <SuggestedCreators
                    userId={userId}
                    role={(user.role ?? 'reader') as 'creator' | 'both' | 'reader' | 'supervisor'}
                    favoriteGenres={user.favoriteGenres}
                  />
                )}

                <Annonces
                  books={popularCards}
                  tag={t.home.newReleases}
                  title={t.home.newReleases}
                  subtitle={t.home.freshChaptersSub}
                />

                <MostLiked books={mostLiked} title={t.home.mostLiked} subtitle={t.home.mostLikedSub} />
              </>
            )}

            {mangas.length > 0 && <EventsCarousel autoPlayMs={5000} />}
            {mangas.length > 0 && <CharactersCarousel />}
          </>
        )}
      </main>

      <footer className="home-footer">
        <div className="container footer-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link to="/home" className="logo">
                {FOOTER.brand}
              </Link>
              <p>{FOOTER.tagline}</p>
            </div>

            {FOOTER.columns.map((col) => (
              <div key={col.title} className="footer-links">
                <h4>{col.title}</h4>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel={l.href.startsWith('http') ? 'noopener noreferrer' : undefined}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="footer-bottom">
            <p className="copyright">{FOOTER.copyright}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
