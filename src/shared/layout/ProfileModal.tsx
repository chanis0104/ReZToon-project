import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  X, LogOut, User as UserIcon, Mail, Lock, Shield, Settings, Camera,
  Calendar, MapPin, Globe, Phone, Trash2, AtSign, BookOpen,
  PenTool, Link as LinkIcon, Palette, Users, ShieldCheck, CheckCircle2,
  Eye, Heart, Bookmark, Play, Library as LibraryIcon, Loader2,
} from 'lucide-react';
import {
  updateUser,
  updateOwnRole,
  logoutCurrentUser,
  updatePassword,
  uploadAvatar,
} from '../../core/services/userService';
import type { User, UserRole } from '../../core/services/userService';
import {
  getLibrary,
  removeFromLibrary,
  type LibraryEntry,
  type LibraryStatus,
} from '../../core/services/libraryService';
import { getMangasByIds } from '../../core/services/mangaService';
import { getIcon } from '../ui/Icon';
import { supabase } from '../../core/lib/supabase';
import { useGenres } from '../../core/hooks/useGenres';
import { useT } from '../../config/i18n';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const SPECIALIZATIONS = ['Writer', 'Artist', 'Both'];

interface ProfileModalProps {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onUserChange: (user: User | null) => void;
}

type Tab = 'profile' | 'creator' | 'security' | 'library' | 'preferences' | 'supervisor';
type Status = { type: 'error' | 'success'; text: string } | null;
type LibraryFilter = 'all' | LibraryStatus;

interface ResolvedLibraryItem {
  entry: LibraryEntry;
  mangaId: string;
  mangaTitle: string;
  mangaSubtitle: string;
  mangaGenre: string;
  mangaCover: string;
  mangaRating: number;
  mangaReads: number;
  mangaLikes: number;
  mangaChapters: number;
}

export default function ProfileModal({ isOpen, user, onClose, onUserChange }: ProfileModalProps) {
  const navigate = useNavigate();
  const t = useT();
  const { names: genreNames } = useGenres();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [status, setStatus] = useState<Status>(null);

  const safeName = user?.name || 'Unknown User';
  const safeEmail = user?.email || '';
  const readOnly = user?.isActive === false;

  const [name, setName] = useState(safeName);
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(safeEmail);
  const [photo, setPhoto] = useState(user?.photo ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? '');
  const [residence, setResidence] = useState(user?.residence ?? '');
  const [country, setCountry] = useState(user?.country ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(user?.favoriteGenres ?? []);
  const [preferredLanguage, setPreferredLanguage] = useState(user?.preferredLanguage ?? 'English');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'reader');
  const [penName, setPenName] = useState(user?.penName ?? '');
  const [portfolioUrl, setPortfolioUrl] = useState(user?.portfolioUrl ?? '');
  const [specialization, setSpecialization] = useState(user?.specialization ?? 'Writer');
  const [creatorBio, setCreatorBio] = useState(user?.creatorBio ?? '');

  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [libraryTick, setLibraryTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [libraryItems, setLibraryItems] = useState<ResolvedLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const roleDirtyRef = useRef(false);
  const pickRole = (next: UserRole) => {
    roleDirtyRef.current = next !== user?.role;
    setRole(next);
  };

  // Si le superviseur (ou un autre appareil) change le rôle pendant que la modale est
  // ouverte, on resynchronise silencieusement tant que l'utilisateur n'a pas touché au choix.
  useEffect(() => {
    if (!isOpen || !user?.role) return;
    if (!roleDirtyRef.current) setRole(user.role);
  }, [isOpen, user?.role]);

  const isSupervisor = role === 'supervisor';
  const isCreator = role === 'creator' || role === 'both';

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setName(user?.name || '');
    setUsername(user?.username ?? '');
    setEmail(user?.email || '');
    setPhoto(user?.photo ?? '');
    setBio(user?.bio ?? '');
    setBirthDate(user?.birthDate ?? '');
    setResidence(user?.residence ?? '');
    setCountry(user?.country ?? '');
    setPhone(user?.phone ?? '');
    setFavoriteGenres(user?.favoriteGenres ?? []);
    setPreferredLanguage(user?.preferredLanguage ?? 'English');
    setRole(user?.role ?? 'reader');
    roleDirtyRef.current = false;
    setPenName(user?.penName ?? '');
    setPortfolioUrl(user?.portfolioUrl ?? '');
    setSpecialization(user?.specialization ?? 'Writer');
    setCreatorBio(user?.creatorBio ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setLibraryFilter('all');
    setLibraryItems([]);
    setLibraryTick(0);
    setStatus(null);
    setActiveTab(user?.role === 'supervisor' ? 'supervisor' : 'profile');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !user || activeTab !== 'library') return;
    let cancelled = false;

    (async () => {
      setLibraryLoading(true);
      const entries = await getLibrary(user.id);
      
      // SÉCURITÉ ANTI-DOUBLON : On utilise un Map pour écraser les doublons
      const uniqueEntries = new Map();
      entries.forEach(entry => uniqueEntries.set(entry.mangaId, entry));
      const cleanEntries = Array.from(uniqueEntries.values());

      const mangaIds = cleanEntries.map((e) => e.mangaId);
      const mangas = await getMangasByIds(mangaIds);
      const mangaMap = new Map(mangas.map((m) => [m.id, m]));

      const resolved: ResolvedLibraryItem[] = [];
      cleanEntries.forEach((entry) => {
        const manga = mangaMap.get(entry.mangaId);
        if (!manga) return;
        resolved.push({
          entry,
          mangaId: manga.id,
          mangaTitle: manga.title,
          mangaSubtitle: manga.subtitle,
          mangaGenre: manga.genre,
          mangaCover: manga.cover,
          mangaRating: manga.rating,
          mangaReads: manga.reads,
          mangaLikes: manga.likes,
          mangaChapters: manga.chapters?.length || 0,
        });
      });

      if (!cancelled) {
        setLibraryItems(resolved);
        setLibraryLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, isOpen, libraryTick, activeTab]);

  const tabs = useMemo(() => {
    const list: { id: Tab; label: string; icon: typeof UserIcon }[] = [];
    if (isSupervisor) {
      list.push({ id: 'supervisor', label: t.supervisor.console, icon: Shield });
      list.push({ id: 'profile', label: t.profile.myProfile, icon: UserIcon });
    } else {
      list.push({ id: 'profile', label: t.profile.myProfile, icon: UserIcon });
      if (isCreator) list.push({ id: 'creator', label: t.profile.creatorProfile, icon: PenTool });
    }
    list.push({ id: 'security', label: t.profile.security, icon: Lock });
    list.push({ id: 'library', label: t.profile.myLibrary, icon: LibraryIcon });
    if (!isSupervisor) {
      list.push({ id: 'preferences', label: t.profile.preferences, icon: Settings });
    }
    return list;
  }, [isSupervisor, isCreator, t]);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setStatus(null);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || readOnly) return;

    if (!file.type.startsWith('image/')) {
      setStatus({ type: 'error', text: t.profile.errInvalidImage });
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setStatus({ type: 'error', text: t.profile.errImageSize });
      return;
    }

    setBusy(true);
    setStatus(null);

    const url = await uploadAvatar(user.id, file);
    if (!url) {
      setBusy(false);
      setStatus({ type: 'error', text: t.profile.errUploadFailed });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const previousPhoto = photo;
    setPhoto(url);

    const res = await updateUser(user.id, { photo: url });
    setBusy(false);

    if (res.success && res.user) {
      onUserChange(res.user);
    } else {
      setPhoto(previousPhoto);
      setStatus({ type: 'error', text: res.message });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || readOnly) return;
    const previousPhoto = photo;
    setPhoto('');
    if (fileInputRef.current) fileInputRef.current.value = '';

    const res = await updateUser(user.id, { photo: '' });
    if (res.success && res.user) {
      onUserChange(res.user);
    } else {
      setPhoto(previousPhoto);
      setStatus({ type: 'error', text: res.message });
    }
  };

  const toggleGenre = (genre: string) => {
    setFavoriteGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !user || readOnly) return;
    if (!name.trim()) {
      setStatus({ type: 'error', text: t.profile.errNameRequired });
      return;
    }
    if (email && (!email.includes('@') || !email.includes('.'))) {
      setStatus({ type: 'error', text: t.profile.errEmailInvalid });
      return;
    }
    setBusy(true);
    const result = await updateUser(user.id, {
      name,
      username,
      photo,
      bio,
      birthDate,
      residence,
      country,
      phone,
      favoriteGenres,
    });
    setBusy(false);

    if (!result.success || !result.user) {
      setStatus({ type: 'error', text: result.message });
      return;
    }
    onUserChange(result.user);
    setStatus({ type: 'success', text: result.message });
  };

  const handleCreatorSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !user || readOnly) return;
    if (!penName.trim()) {
      setStatus({ type: 'error', text: t.profile.errPenNameRequired });
      return;
    }
    setBusy(true);
    const result = await updateUser(user.id, { penName, portfolioUrl, specialization, creatorBio });
    setBusy(false);
    if (!result.success || !result.user) {
      setStatus({ type: 'error', text: result.message });
      return;
    }
    onUserChange(result.user);
    setStatus({ type: 'success', text: t.profile.creatorProfileUpdated });
  };

  const handleSecuritySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !user) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus({ type: 'error', text: t.profile.errFillPasswordFields });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setStatus({ type: 'error', text: t.auth.errPasswordLength });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', text: t.auth.errPasswordMatch });
      return;
    }

    setBusy(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: safeEmail,
      password: currentPassword,
    });

    if (signInError) {
      setBusy(false);
      setStatus({ type: 'error', text: t.profile.errCurrentPasswordIncorrect });
      return;
    }

    const result = await updatePassword(newPassword);

    if (!result.success) {
      setBusy(false);
      setStatus({ type: 'error', text: result.message });
      return;
    }

    await supabase.auth.signOut({ scope: 'others' }).catch(() => {});

    setBusy(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStatus({ type: 'success', text: t.profile.passwordUpdated });
  };

  const handlePreferencesSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !user || readOnly) return;

    const isNarrowingToReader =
      (user.role === 'creator' || user.role === 'both' || user.role === 'reader') &&
      role === 'reader' &&
      user.role !== 'reader';

    if (isNarrowingToReader) {
      const confirmed = window.confirm(t.profile.confirmReaderMode);
      if (!confirmed) return;
    }

    setBusy(true);

    const wantsRoleChange =
      !isSupervisor &&
      role !== user.role &&
      (role === 'reader' || role === 'creator' || role === 'both');

    let latest: User | null = null;

    // Le rôle est enregistré en premier et indépendamment de la langue : un échec
    // sur la langue ne doit jamais empêcher l'utilisateur de choisir son rôle.
    if (wantsRoleChange) {
      const roleResult = await updateOwnRole(role as 'reader' | 'creator' | 'both');
      if (!roleResult.success || !roleResult.user) {
        setBusy(false);
        setStatus({ type: 'error', text: roleResult.message });
        return;
      }
      latest = roleResult.user;
      onUserChange(roleResult.user);
    }

    if (preferredLanguage !== (latest?.preferredLanguage ?? user.preferredLanguage)) {
      const langResult = await updateUser(user.id, { preferredLanguage });
      if (!langResult.success) {
        setBusy(false);
        setStatus({ type: 'error', text: langResult.message });
        return;
      }
      if (langResult.user) onUserChange(langResult.user);
    }

    roleDirtyRef.current = false;
    setBusy(false);
    setStatus({ type: 'success', text: t.profile.preferencesSaved });
  };

  const handleLogout = async () => {
    await logoutCurrentUser();
    onUserChange(null);
    onClose();
    navigate('/', { replace: true });
  };

  const filteredLibrary = useMemo(() => {
    if (libraryFilter === 'all') return libraryItems;
    return libraryItems.filter((x) => x.entry.status === libraryFilter);
  }, [libraryItems, libraryFilter]);

  const handleRemoveFromLibrary = async (mangaId: string) => {
    if (!user) return;
    if (!window.confirm(t.profile.confirmRemoveLibrary)) return;
    setLibraryItems((prev) => prev.filter((x) => x.mangaId !== mangaId));
    await removeFromLibrary(user.id, mangaId);
  };

  if (!isOpen || !user) return null;

  return createPortal(
    <>
      <div
        className="profile-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className={`profile-modal ${isSupervisor ? 'profile-modal-supervisor' : ''}`} role="dialog" aria-modal="true">
          <button className="profile-close" onClick={onClose} aria-label={t.common.close}>
            <X size={18} />
          </button>

          <aside className="profile-sidebar">
            <div className="profile-sidebar-header">
              <div className={`profile-avatar-large ${isSupervisor ? 'supervisor-avatar-large' : ''}`}>
                {photo ? (
                  <img src={photo} alt={safeName} className="profile-avatar-large-img" />
                ) : (
                  <span>{safeName.charAt(0).toUpperCase()}</span>
                )}
                {isSupervisor && (
                  <span className="supervisor-avatar-crown">
                    <ShieldCheck size={16} />
                  </span>
                )}
              </div>

              <div className="profile-sidebar-text">
                <h2>{safeName}</h2>
                <p>{user.username ? `@${user.username}` : safeEmail}</p>
                {isSupervisor && (
                  <span className="profile-role-badge supervisor-badge">
                    <Shield size={10} /> {t.common.roleSupervisor}
                  </span>
                )}
                {isCreator && !isSupervisor && (
                  <span className="profile-role-badge">
                    <PenTool size={10} />{' '}
                    {role === 'both'
                      ? `${t.common.roleReader} & ${t.common.roleCreator}`
                      : t.common.roleCreator}
                  </span>
                )}
              </div>
            </div>

            <nav className="profile-sidebar-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`profile-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => switchTab(tab.id)}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="profile-sidebar-footer">
              <button type="button" className="profile-logout" onClick={handleLogout}>
                <LogOut size={16} />
                <span>{t.profile.logOut}</span>
              </button>
            </div>
          </aside>

          <section className="profile-content">
            {status && (
              <div className={`form-message ${status.type}`} role="alert">
                {status.text}
              </div>
            )}

            {activeTab === 'profile' && (
              <form className="profile-form" onSubmit={handleProfileSubmit} autoComplete="off">
                <div className="profile-content-header">
                  <h3>{t.profile.profileInfo}</h3>
                  <p>{t.profile.identity}</p>
                </div>

                <div className="profile-photo-section">
                  <button
                    type="button"
                    className="profile-photo-frame"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || readOnly}
                  >
                    {busy ? (
                      <Loader2 size={30} className="spin" />
                    ) : photo ? (
                      <img src={photo} alt="Profile" className="profile-photo-img" />
                    ) : (
                      <Camera size={30} />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    hidden
                    disabled={busy || readOnly}
                  />
                  <div className="profile-photo-actions">
                    {photo && !readOnly && (
                      <button
                        type="button"
                        className="profile-photo-remove"
                        onClick={handleRemovePhoto}
                        disabled={busy}
                      >
                        <Trash2 size={12} /> {t.profile.remove}
                      </button>
                    )}
                    <span className="profile-photo-hint">{t.profile.photoHint}</span>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <UserIcon size={14} /> {t.profile.fullName}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={readOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <AtSign size={14} /> {t.profile.username}
                    </label>
                    <input
                      type="text"
                      placeholder="yourhandle"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <Mail size={14} /> {t.profile.emailAddress}
                  </label>
                  <input type="email" value={email} disabled title={t.profile.contactSupport} />
                </div>

                <div className="form-group">
                  <label>
                    <BookOpen size={14} /> {t.profile.bio}
                  </label>
                  <textarea
                    className="profile-textarea"
                    rows={3}
                    maxLength={280}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    disabled={readOnly}
                  />
                  <span className="char-counter">{bio.length}/280</span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <Calendar size={14} /> {t.profile.dob}
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setBirthDate(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <Phone size={14} /> {t.profile.phoneNumber}
                    </label>
                    <input
                      type="tel"
                      placeholder="+237 6XX XX XX XX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <Globe size={14} /> {t.profile.country}
                    </label>
                    <input
                      type="text"
                      placeholder="Cameroon"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <MapPin size={14} /> {t.profile.city}
                    </label>
                    <input
                      type="text"
                      placeholder="Yaoundé"
                      value={residence}
                      onChange={(e) => setResidence(e.target.value)}
                      disabled={readOnly}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <Palette size={14} /> {t.profile.favoriteGenres}
                  </label>
                  <div className="genre-chips">
                    {genreNames.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`genre-chip ${favoriteGenres.includes(g) ? 'active' : ''}`}
                        onClick={() => toggleGenre(g)}
                        disabled={readOnly}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="profile-actions">
                  <button type="submit" className="btn-auth" disabled={busy || readOnly}>
                    {busy ? t.profile.saving : t.profile.saveChanges}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'creator' && isCreator && !isSupervisor && (
              <form className="profile-form" onSubmit={handleCreatorSubmit} autoComplete="off">
                <div className="profile-content-header">
                  <h3>{t.profile.creatorProfile}</h3>
                  <p>{t.profile.showcaseWork}</p>
                </div>

                <div className="form-group">
                  <label>
                    <PenTool size={14} /> {t.profile.penName}
                  </label>
                  <input
                    type="text"
                    placeholder="Your artist / author name"
                    value={penName}
                    onChange={(e) => setPenName(e.target.value)}
                    disabled={readOnly}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Users size={14} /> {t.profile.specialization}
                  </label>
                  <select
                    className="profile-select"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    disabled={readOnly}
                  >
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <LinkIcon size={14} /> {t.profile.portfolio}
                  </label>
                  <input
                    type="url"
                    placeholder="https://your-portfolio.com"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    disabled={readOnly}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <BookOpen size={14} /> {t.profile.creatorBio}
                  </label>
                  <textarea
                    className="profile-textarea"
                    rows={5}
                    maxLength={500}
                    value={creatorBio}
                    onChange={(e) => setCreatorBio(e.target.value)}
                    disabled={readOnly}
                  />
                  <span className="char-counter">{creatorBio.length}/500</span>
                </div>

                <div className="profile-actions">
                  <button type="submit" className="btn-auth" disabled={busy || readOnly}>
                    {busy ? t.profile.saving : t.profile.saveChanges}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'security' && (
              <form className="profile-form" onSubmit={handleSecuritySubmit} autoComplete="off">
                <div className="profile-content-header">
                  <h3>{t.profile.security}</h3>
                  <p>{t.profile.changePasswordSafe}</p>
                </div>
                <div className="form-group">
                  <label>
                    <Lock size={14} /> {t.profile.currentPassword}
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <Lock size={14} /> {t.profile.newPassword}
                  </label>
                  <input
                    type="password"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <Lock size={14} /> {t.profile.confirmNewPassword}
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="profile-actions">
                  <button type="submit" className="btn-auth" disabled={busy}>
                    {busy ? t.auth.updating : t.profile.updatePassword}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'preferences' && !isSupervisor && (
              <form className="profile-form" onSubmit={handlePreferencesSubmit}>
                <div className="profile-content-header">
                  <h3>{t.profile.preferences}</h3>
                  <p>{t.profile.manageAccountMode}</p>
                </div>

                <div className="form-group">
                  <label>
                    <Globe size={14} /> {t.nav.language}
                  </label>
                  <select
                    className="profile-select"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                    disabled={readOnly}
                  >
                    <option value="English">English</option>
                    <option value="French">Français</option>
                  </select>
                </div>

                <div className="role-switcher">
                  <div className="role-options">
                    <button
                      type="button"
                      className={`role-option ${role === 'reader' ? 'active' : ''}`}
                      onClick={() => pickRole('reader')}
                      disabled={readOnly}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px' }}
                    >
                      <BookOpen size={24} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <strong>{t.common.roleReader}</strong>
                        <span style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>{t.profile.readFollowSeries}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`role-option ${role === 'creator' ? 'active' : ''}`}
                      onClick={() => pickRole('creator')}
                      disabled={readOnly}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px' }}
                    >
                      <PenTool size={24} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <strong>{t.common.roleCreator}</strong>
                        <span style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>{t.profile.publishOwnManga}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`role-option ${role === 'both' ? 'active' : ''}`}
                      onClick={() => pickRole('both')}
                      disabled={readOnly}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px' }}
                    >
                      <Users size={24} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <strong>{t.profile.both}</strong>
                        <span style={{ fontSize: '0.7rem', lineHeight: '1.2' }}>{t.profile.readAndCreate}</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="profile-actions">
                  <button type="submit" className="btn-auth" disabled={busy || readOnly}>
                    {busy ? t.profile.saving : t.profile.saveChanges}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'supervisor' && isSupervisor && (
              <div className="profile-form">
                <div className="supervisor-locked-role">
                  <Shield size={20} />
                  <div>
                    <strong>{t.profile.supervisorRightsActive}</strong>
                    <span>{t.profile.supervisorFullAccess}</span>
                  </div>
                </div>
                <Link
                  to="/supervisor"
                  className="btn-auth"
                  style={{
                    marginTop: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                  onClick={onClose}
                >
                  <ShieldCheck size={16} /> {t.supervisor.console}
                </Link>
              </div>
            )}

            {activeTab === 'library' && (
              <div className="profile-form profile-library">
                <div className="profile-content-header">
                  <h3>{t.profile.myLibrary}</h3>
                  <p>{t.profile.manageMangaReading}</p>
                </div>

                <div className="profile-library-filters">
                  {[
                    { id: 'all', label: t.communityFeed.feedFilters.all, icon: LibraryIcon },
                    { id: 'reading', label: t.library.reading, icon: BookOpen },
                    { id: 'wishlist', label: t.library.wishlist, icon: Bookmark },
                    { id: 'completed', label: t.library.completed, icon: CheckCircle2 },
                  ].map((f) => {
                    const Icon = f.icon;
                    const count =
                      f.id === 'all'
                        ? libraryItems.length
                        : libraryItems.filter((x) => x.entry.status === f.id).length;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`profile-library-chip ${libraryFilter === f.id ? 'active' : ''}`}
                        onClick={() => setLibraryFilter(f.id as LibraryFilter)}
                      >
                        <Icon size={14} />
                        {f.label}
                        <span className="profile-library-chip-count">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {libraryLoading ? (
                  <div className="profile-library-empty">
                    <Loader2 size={28} className="spin" />
                    <p>{t.common.loading}</p>
                  </div>
                ) : filteredLibrary.length === 0 ? (
                  <div className="profile-library-empty">
                    <BookOpen size={28} />
                    <p>{t.library.empty}</p>
                    <span>{t.library.emptyDesc}</span>
                  </div>
                ) : (
                  <ul className="profile-library-list">
                    {filteredLibrary.map((item) => {
                      const IconCmp = getIcon(item.mangaCover);
                      const percent = Math.min(
                        100,
                        Math.round(
                          (item.entry.chaptersRead.length / (item.mangaChapters || 1)) * 100,
                        ),
                      );
                      return (
                        <li key={item.mangaId} className="profile-library-item">
                          <Link
                            to={`/manga/${item.mangaId}`}
                            className="profile-library-cover"
                            onClick={onClose}
                          >
                            <IconCmp size={32} />
                            <span className={`profile-library-status status-${item.entry.status}`}>
                              {item.entry.status}
                            </span>
                          </Link>
                          <div className="profile-library-info">
                            <div className="profile-library-head">
                              <h4>{item.mangaTitle}</h4>
                              <span className="profile-library-genre">{item.mangaGenre}</span>
                            </div>
                            <p className="profile-library-sub">{item.mangaSubtitle}</p>
                            <div className="profile-library-metrics">
                              <span>
                                <Eye size={12} /> {item.mangaReads}
                              </span>
                              <span>
                                <Heart size={12} /> {item.mangaLikes}
                              </span>
                            </div>
                            <div className="profile-library-progress">
                              <div
                                className="profile-library-progress-fill"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="profile-library-progress-meta">
                              <span>
                                {t.common.chapterShort} {item.entry.currentChapter} / {item.mangaChapters}
                              </span>
                              <span>{percent}%</span>
                            </div>
                          </div>
                          <div className="profile-library-actions">
                            <Link
                              to={`/manga/${item.mangaId}/read/${item.entry.currentChapter}`}
                              className="profile-library-btn read"
                              onClick={onClose}
                            >
                              <Play size={12} fill="currentColor" /> {t.common.read}
                            </Link>
                            <button
                              type="button"
                              className="profile-library-btn danger"
                              onClick={() => handleRemoveFromLibrary(item.mangaId)}
                            >
                              <Trash2 size={12} /> {t.profile.remove}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </>,
    document.body,
  );
}
