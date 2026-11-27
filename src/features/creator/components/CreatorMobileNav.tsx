import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookPlus, Library, BarChart3, FileEdit } from 'lucide-react';
import { useT } from '../../../config/i18n';

export default function CreatorMobileNav() {
  const t = useT();

  const navItems = [
    { to: '/creator', icon: LayoutDashboard, end: true, title: t.creator.dashboard },
    { to: '/creator/new', icon: BookPlus, end: false, title: t.creator.newChapter },
    { to: '/creator/series', icon: Library, end: false, title: t.creator.mySeries },
    { to: '/creator/chapters', icon: FileEdit, end: false, title: t.creator.myChapters },
    { to: '/creator/analytics', icon: BarChart3, end: false, title: t.creator.analytics },
  ];

  return (
    <nav className="creator-mobile-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.title}
            className={({ isActive }) =>
              `creator-mobile-tab ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={20} />
          </NavLink>
        );
      })}
    </nav>
  );
}
