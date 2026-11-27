import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import ProtectedRoute from '../shared/layout/ProtectedRoute';
import Cursor from '../shared/effects/Cursor';
import PWAInstallBanner from '../shared/ui/PWAInstallBanner';
import OfflineBanner from '../shared/ui/OfflineBanner';
import AccountSuspendedBanner from '../shared/ui/AccountSuspendedBanner';
import SupervisorFloatingBadge from '../features/supervisor/components/SupervisorFloatingBadge';

const LandingPage = lazy(() => import('../features/landing/LandingPage'));
const Home = lazy(() => import('../features/home/Home'));
const Community = lazy(() => import('../features/community/Community'));
const CommunityEvents = lazy(() => import('../features/community/CommunityEvents'));
const MangaDetail = lazy(() => import('../features/manga/MangaDetail'));
const Reader = lazy(() => import('../features/reader/Reader'));
const CreatorProfile = lazy(() => import('../features/creators/CreatorProfile'));
const Awards = lazy(() => import('../features/awards/Awards'));

const LetGo = lazy(() => import('../features/auth/LetGo'));
const Forgot = lazy(() => import('../features/auth/Forgot'));
const ResetPassword = lazy(() => import('../features/auth/ResetPassword'));

const Library = lazy(() => import('../features/library/Library'));
const Message = lazy(() => import('../features/messaging/Message'));

const CreatorLayout = lazy(() => import('../features/creator/CreatorLayout'));
const CreatorDashboard = lazy(() => import('../features/creator/CreatorDashboard'));
const NewChapter = lazy(() => import('../features/creator/NewChapter'));
const MySeries = lazy(() => import('../features/creator/MySeries'));
const MyChapters = lazy(() => import('../features/creator/MyChapters'));
const Analytics = lazy(() => import('../features/creator/Analytics'));

const SupervisorHome = lazy(() => import('../features/supervisor/pages/Home'));
const SupervisorUsers = lazy(() => import('../features/supervisor/pages/Users'));
const SupervisorReports = lazy(() => import('../features/supervisor/pages/Reports'));
const SupervisorEvents = lazy(() => import('../features/supervisor/pages/Events'));
const SupervisorSearch = lazy(() => import('../features/supervisor/pages/Search'));
const SupervisorNotifications = lazy(() => import('../features/supervisor/pages/Notifications'));
const SupervisorMessages = lazy(() => import('../features/supervisor/pages/Messages'));
const SupervisorGenres = lazy(() => import('../features/supervisor/pages/Genres'));
const SupervisorFeedback = lazy(() => import('../features/supervisor/pages/Feedback'));

const PUBLIC_ROUTES = ['/', '/let-go', '/forgot', '/reset-password'];

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--dark)' }}>
      <div className="loader-ring" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
      <p style={{ marginTop: 20, color: 'var(--primary)', fontWeight: 800, letterSpacing: '2px' }}>ReZToon</p>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const showBanners = !PUBLIC_ROUTES.includes(location.pathname);
  const showCursor = !location.pathname.includes('/read/');

  return (
    <>
      {showCursor && <Cursor />}

      {showBanners && <OfflineBanner />}
      {showBanners && <AccountSuspendedBanner />}

      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<Home />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/events" element={<CommunityEvents />} />
          <Route path="/awards" element={<Awards />} />
          <Route path="/creators/:id" element={<CreatorProfile />} />
          <Route path="/manga/:id" element={<MangaDetail />} />
          <Route path="/manga/:id/read/:chapter" element={<Reader />} />

          <Route path="/let-go" element={<LetGo />} />
          <Route path="/forgot" element={<Forgot />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/messages" element={<Message />} />
            <Route path="/library" element={<Library />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['creator', 'both', 'supervisor']} />}>
            <Route path="/creator" element={<CreatorLayout />}>
              <Route index element={<CreatorDashboard />} />
              <Route path="new" element={<NewChapter />} />
              <Route path="series" element={<MySeries />} />
              <Route path="chapters" element={<MyChapters />} />
              <Route path="analytics" element={<Analytics />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['supervisor']} />}>
            <Route path="/supervisor" element={<SupervisorHome />} />
            <Route path="/supervisor/users" element={<SupervisorUsers />} />
            <Route path="/supervisor/reports" element={<SupervisorReports />} />
            <Route path="/supervisor/events" element={<SupervisorEvents />} />
            <Route path="/supervisor/search" element={<SupervisorSearch />} />
            <Route path="/supervisor/notifications" element={<SupervisorNotifications />} />
            <Route path="/supervisor/messages" element={<SupervisorMessages />} />
            <Route path="/supervisor/genres" element={<SupervisorGenres />} />
            <Route path="/supervisor/feedback" element={<SupervisorFeedback />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {showBanners && <PWAInstallBanner />}
      {showBanners && <SupervisorFloatingBadge />}
    </>
  );
}
