import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users as UsersIcon, Search, X } from 'lucide-react';
import Cursor from '../../../shared/effects/Cursor';
import ParticlesCanvas from '../../../shared/effects/ParticlesCanvas';
import FloatingShapes from '../../../shared/effects/FloatingShapes';
import { useCurrentUserWithLoading } from '../../../core/hooks/useCurrentUser';
import {
  getUsers,
  adminUpdateUser,
  toggleUserActive,
  deleteUserAccount,
  banUser,
} from '../../../core/services/userService';
import type { Permission, User, UserRole } from '../../../core/services/userService';
import {
  SupervisorHeader,
  SupervisorPageShell,
  UsersRightsTable,
  SupervisorToast,
} from '../components';
import '../../../styles/home-style.css';
import '../../../styles/profile-style.css';
import '../../../styles/panel-style.css';
import '../../../styles/supervisor-style.css';
import '../../../styles/supervisor-pages-style.css';
import { useT } from '../../../config/i18n';

type RoleFilter = 'all' | UserRole;
type PermissionFilter = 'all' | Permission;

export default function SupervisorUsers() {
  const t = useT();
  const { user, loading: authLoading } = useCurrentUserWithLoading();
  const navigate = useNavigate();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>('all');

  const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
    { id: 'all', label: t.communityFeed.feedFilters.all },
    { id: 'reader', label: t.common.roleReader },
    { id: 'creator', label: t.common.roleCreator },
    { id: 'both', label: t.supervisor.roleBoth },
    { id: 'supervisor', label: t.common.roleSupervisor },
  ];

  const PERMISSION_FILTERS: { id: PermissionFilter; label: string }[] = [
    { id: 'all', label: t.supervisor.rightsAll },
    { id: 'moderate_content', label: t.supervisor.rightsModerators },
    { id: 'manage_users', label: t.supervisor.rightsUserManagers },
    { id: 'manage_reports', label: t.supervisor.rightsReportManagers },
  ];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/let-go', { replace: true });
      return;
    }
    if (user.role !== 'supervisor') navigate('/supervisor', { replace: true });
  }, [user, authLoading, navigate]);

  // Rafraîchissement silencieux : le spinner n'apparaît qu'au premier chargement,
  // pour ne pas faire clignoter la liste à chaque changement de rôle.
  const refreshUsers = useCallback(async () => {
    const list = await getUsers();
    setUsers(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role === 'supervisor') void refreshUsers();
  }, [user, refreshUsers]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isSelf = (targetUserId: string) => targetUserId === user?.id;

  const isPeerSupervisor = (targetUserId: string) => {
    const target = users.find((u) => u.id === targetUserId);
    return target?.role === 'supervisor' && !isSelf(targetUserId);
  };

  const handleTogglePermission = async (targetUserId: string, permission: Permission) => {
    const target = users.find((u) => u.id === targetUserId);
    if (!target) return;
    const current = target.permissions ?? [];
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];

    const result = await adminUpdateUser(targetUserId, { permissions: next });
    if (result.success) {
      await refreshUsers();
      setToast(`${permission} ${next.includes(permission) ? 'granted' : 'revoked'}.`);
    } else {
      setToast(result.message);
    }
  };

  const handleSetRole = async (targetUserId: string, role: User['role']) => {
    if (!role) return;

    if (isSelf(targetUserId)) {
      setToast(t.supervisor.errCannotDemoteSelf);
      return;
    }

    if (role === 'supervisor') {
      const target = users.find((u) => u.id === targetUserId);
      const confirmed = window.confirm(
        t.supervisor.confirmPromoteSupervisor.replace('{{name}}', target?.name ?? ''),
      );
      if (!confirmed) return;
    }

    if (isPeerSupervisor(targetUserId) && (role === 'reader' || role === 'creator' || role === 'both')) {
      const target = users.find((u) => u.id === targetUserId);
      const confirmed = window.confirm(
        t.supervisor.confirmRevokeSupervisor
          .replace('{{name}}', target?.name ?? '')
          .replace('{{role}}', role),
      );
      if (!confirmed) return;
    }

    const result = await adminUpdateUser(targetUserId, { role });
    if (result.success) {
      await refreshUsers();
      setToast(t.supervisor.roleUpdated.replace('{{role}}', role));
    } else {
      setToast(result.message);
    }
  };

  const handleToggleActive = async (targetUserId: string, currentStatus: boolean) => {
    if (isSelf(targetUserId)) {
      setToast(t.supervisor.errCannotDeactivateSelf);
      return;
    }
    if (isPeerSupervisor(targetUserId)) {
      setToast(t.supervisor.errCannotModifyPeerSupervisor);
      return;
    }
    const action = currentStatus ? 'deactivate' : 'reactivate';
    if (!window.confirm(t.supervisor.confirmToggleActive.replace('{{action}}', action))) return;

    const res = await toggleUserActive(targetUserId, !currentStatus);
    if (res.success) {
      await refreshUsers();
      setToast(res.message);
    } else {
      setToast(res.message);
    }
  };

  const handleBan = async (targetUserId: string) => {
    if (isSelf(targetUserId)) return;
    if (isPeerSupervisor(targetUserId)) {
      setToast(t.supervisor.errCannotModifyPeerSupervisor);
      return;
    }
    const daysStr = window.prompt(t.supervisor.promptBanDays, '7');
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    if (isNaN(days) || days <= 0) {
      setToast(t.supervisor.errInvalidDays);
      return;
    }

    const res = await banUser(targetUserId, days);
    if (res.success) {
      await refreshUsers();
      setToast(res.message);
    } else {
      setToast(res.message);
    }
  };

  const handleDelete = async (targetUserId: string) => {
    if (isSelf(targetUserId)) return;
    if (isPeerSupervisor(targetUserId)) {
      setToast(t.supervisor.errCannotModifyPeerSupervisor);
      return;
    }
    if (!window.confirm(t.supervisor.confirmDeleteUser)) return;

    const res = await deleteUserAccount(targetUserId);
    if (res.success) {
      await refreshUsers();
      setToast(res.message);
    } else {
      setToast(res.message);
    }
  };

  const counts = useMemo(
    () => ({
      all: users.length,
      reader: users.filter((u) => (u.role ?? 'reader') === 'reader').length,
      creator: users.filter((u) => u.role === 'creator').length,
      both: users.filter((u) => u.role === 'both').length,
      supervisor: users.filter((u) => u.role === 'supervisor').length,
    }),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && (u.role ?? 'reader') !== roleFilter) return false;
      if (permissionFilter !== 'all') {
        const perms = u.permissions ?? [];
        if (!perms.includes(permissionFilter)) return false;
      }
      if (q) {
        const haystack = [
          u.name,
          u.email,
          u.username ?? '',
          u.country ?? '',
          u.residence ?? '',
          u.penName ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [users, query, roleFilter, permissionFilter]);

  const hasActiveFilters =
    query.trim() !== '' || roleFilter !== 'all' || permissionFilter !== 'all';

  const resetFilters = () => {
    setQuery('');
    setRoleFilter('all');
    setPermissionFilter('all');
  };

  if (authLoading || !user || user.role !== 'supervisor') return null;

  const totalUsers = users.length;
  const creators = users.filter((u) => u.role === 'creator' || u.role === 'both').length;
  const moderators = users.filter((u) =>
    (u.permissions ?? []).includes('moderate_content'),
  ).length;
  const supervisors = users.filter((u) => u.role === 'supervisor').length;

  return (
    <>
      <Cursor />
      <div className="home-bg">
        <ParticlesCanvas />
        <FloatingShapes />
        <div className="bg-overlay" />
      </div>

      <SupervisorHeader active="users" />

      <SupervisorPageShell
        tag="Console"
        tagIcon={<UsersIcon size={12} />}
        title={t.supervisor.usersAndRights}
        subtitle={`${totalUsers} accounts · ${creators} creators · ${moderators} moderators · ${supervisors} supervisors`}
      >
        <div className="supervisor-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder={t.supervisor.searchUsers}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="supervisor-search-clear"
              onClick={() => setQuery('')}
              aria-label={t.events.clearFilters}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="supervisor-chips">
          {ROLE_FILTERS.map((f) => {
            const count =
              f.id === 'all' ? counts.all : counts[f.id as keyof typeof counts] ?? 0;
            return (
              <button
                key={f.id}
                type="button"
                className={`supervisor-chip ${roleFilter === f.id ? 'active' : ''}`}
                onClick={() => setRoleFilter(f.id)}
              >
                <span>{f.label}</span>
                <span className="supervisor-chip-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="supervisor-chips">
          {PERMISSION_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`supervisor-chip ${permissionFilter === f.id ? 'active' : ''}`}
              onClick={() => setPermissionFilter(f.id)}
            >
              <span>{f.label}</span>
            </button>
          ))}
          {hasActiveFilters && (
            <button type="button" className="supervisor-chip reset" onClick={resetFilters}>
              <X size={12} />
              <span>{t.events.resetFilters}</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="supervisor-empty">
            <UsersIcon size={28} />
            <p>{t.supervisor.loadingUsers}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="supervisor-empty">
            <UsersIcon size={28} />
            <p>{t.supervisor.noUsersMatch}</p>
            <span>{t.supervisor.tryAnotherFilter}</span>
          </div>
        ) : (
          <UsersRightsTable
            users={filteredUsers}
            onTogglePermission={handleTogglePermission}
            onSetRole={handleSetRole}
            onToggleActive={handleToggleActive}
            onBan={handleBan}
            onDelete={handleDelete}
            currentUserId={user.id}
          />
        )}
      </SupervisorPageShell>

      {toast && <SupervisorToast message={toast} />}
    </>
  );
}
