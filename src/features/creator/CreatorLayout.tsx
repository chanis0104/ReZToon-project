import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookPlus, Library, BarChart3,
  ChevronLeft, PenTool, Trophy,
  FileEdit,
} from 'lucide-react';

import Cursor from '../../shared/effects/Cursor';
import { useCurrentUser } from '../../core/hooks/useCurrentUser';
import { useIsMobile } from '../../core/hooks/useIsMobile';
import { useT } from '../../config/i18n';
import CreatorMobileLayout from './components/CreatorMobileLayout';
import '../../styles/creator-style.css';

export default function CreatorLayout() {
  const user = useCurrentUser();
  const isMobile = useIsMobile();
  const location = useLocation();
  const t = useT();

  if (!user) return null;

  if (isMobile) {
    return (
      <>
        <Cursor />
        <CreatorMobileLayout />
      </>
    );
  }

  const navItems = [
    { to: '/creator', label: t.creator.dashboard, icon: LayoutDashboard, end: true },
    { to: '/creator/new', label: t.creator.newChapter, icon: BookPlus, end: false },
    { to: '/creator/series', label: t.creator.mySeries, icon: Library, end: false },
    { to: '/creator/chapters', label: t.creator.myChapters, icon: FileEdit, end: false },
    { to: '/creator/analytics', label: t.creator.analytics, icon: BarChart3, end: false },
  ];

  const isSupervisor = user.role === 'supervisor';

  return (
    <>
      <Cursor />
      <div className="creator-shell">
        <aside className="creator-sidebar">
          <Link to="/home" className="creator-brand">
            ReZ<span>Toon</span>
          </Link>

          <div className="creator-sidebar-badge">
            <PenTool size={14} />
            <span>
              {isSupervisor ? t.creator.supervisorStudio : t.creator.studio}
            </span>
          </div>

          <nav className="creator-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`creator-nav-item ${active ? 'active' : ''}`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="creator-sidebar-footer">
            <Link to="/awards" className="creator-back">
              <Trophy size={16} />
              <span>{t.awards.title}</span>
            </Link>
            {isSupervisor ? (
              <Link to="/supervisor" className="creator-back">
                <ChevronLeft size={16} />
                <span>{t.creator.backToConsole}</span>
              </Link>
            ) : (
              <Link to="/home" className="creator-back">
                <ChevronLeft size={16} />
                <span>{t.common.home}</span>
              </Link>
            )}
          </div>
        </aside>

        <main className="creator-main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
