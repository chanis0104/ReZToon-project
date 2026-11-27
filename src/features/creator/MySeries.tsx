import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, Eye, BookOpen, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useCurrentUser } from '../../core/hooks/useCurrentUser';
import {
  createSeries,
  deleteSeries,
  getSeriesByOwner,
  updateSeries,
} from '../../core/services/contentService';
import type { Series, SeriesStatus } from '../../core/services/contentService';
import { useGenres } from '../../core/hooks/useGenres';
import { useT } from '../../config/i18n';
import TeamPanel from '../collaboration/TeamPanel';
import CoverPicker from '../../shared/ui/CoverPicker';
import type { CoverPickerValue } from '../../shared/ui/CoverPicker';
import { uploadCover } from '../../core/services/coverService';

const NO_COVER: CoverPickerValue = { file: null, removed: false };

const STATUSES: SeriesStatus[] = ['ongoing', 'hiatus', 'completed'];

export default function MySeries() {
  const user = useCurrentUser();
  const t = useT();
  const navigate = useNavigate();
  
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Series | null>(null);
  const [title, setTitle] = useState('');
  const { names: genreNames } = useGenres();
  const [genre, setGenre] = useState<string>('');
  const effectiveGenre = genre || genreNames[0] || '';
  // Un genre masqué/supprimé reste sélectionnable en modification pour ne pas être écrasé.
  const GENRES = effectiveGenre && !genreNames.includes(effectiveGenre) ? [effectiveGenre, ...genreNames] : genreNames;
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<SeriesStatus>('ongoing');
  const [error, setError] = useState<string | null>(null);
  const [teamSeriesId, setTeamSeriesId] = useState<string | null>(null);
  const [cover, setCover] = useState<CoverPickerValue>(NO_COVER);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getSeriesByOwner(user.id);
      setSeries(data);
    } catch (err) {
      console.error("Failed to load series:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetForm = () => {
    setTitle('');
    setGenre('');
    setDescription('');
    setStatus('ongoing');
    setEditing(null);
    setShowForm(false);
    setError(null);
    setCover(NO_COVER);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t.creator.title + ' is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Couverture facultative : téléversée seulement si l'utilisateur en a choisi une.
      const uploadedCover = cover.file ? await uploadCover(cover.file, user.id, 'series') : undefined;

      if (editing) {
        const updated = await updateSeries(editing.id, user.id, {
          title: trimmedTitle,
          genre: effectiveGenre,
          description: description.trim(),
          status,
          coverUrl: uploadedCover ?? (cover.removed ? null : undefined),
        });
        if (!updated) {
          setError(t.common.errUnexpected);
          return;
        }
      } else {
        const created = await createSeries(
          { id: user.id, name: user.name },
          {
            title: trimmedTitle,
            genre: effectiveGenre,
            description: description.trim(),
            status,
            coverUrl: uploadedCover,
          },
        );
        if (!created) {
          setError(t.common.errUnexpected);
          return;
        }
      }
      
      resetForm();
      await refresh();
    } catch (err: any) {
      setError(err.message || t.common.errUnexpected);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (s: Series) => {
    setEditing(s);
    setTitle(s.title);
    setGenre(s.genre);
    setDescription(s.description);
    setStatus(s.status);
    setShowForm(true);
    setError(null);
    setCover(NO_COVER);
  };

  const handleDelete = async (s: Series) => {
    if (!user) return;
    if (window.confirm(t.creator.deleteConfirm)) {
      setLoading(true);
      const success = await deleteSeries(s.id, user.id);
      if (success) {
        await refresh();
      } else {
        setError(t.common.errUnexpected);
        setLoading(false);
      }
    }
  };

  if (!user) return null;

  return (
    <div className="creator-page">
      <header className="creator-page-header">
        <div>
          <span className="creator-page-tag">{t.creator.mySeries}</span>
          <h1>{t.creator.mySeries}</h1>
          <p>{t.creator.manageAll}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          disabled={loading}
        >
          <Plus size={16} /> {t.creator.newSeries}
        </button>
      </header>

      {showForm && (
        <form className="creator-form" onSubmit={handleSubmit}>
          {error && (
            <div className="form-message error" role="alert">
              {error}
            </div>
          )}

          <div className="creator-form-grid">
            <div className="creator-form-group">
              <label>{t.creator.title}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.creator.title}
                maxLength={120}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="creator-form-group">
              <label>{t.creator.genre}</label>
              <select
                className="creator-select"
                value={effectiveGenre}
                onChange={(e) => setGenre(e.target.value)}
                disabled={isSubmitting}
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="creator-form-group">
            <label>{t.creator.description}</label>
            <textarea
              className="creator-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.creator.description}
              maxLength={400}
              disabled={isSubmitting}
            />
            <span className="creator-char-counter">{description.length}/400</span>
          </div>

          <CoverPicker
            label={t.coverForm.seriesLabel}
            currentUrl={editing?.coverUrl}
            value={cover}
            onChange={setCover}
            aspect="portrait"
            disabled={isSubmitting}
          />

          <div className="creator-form-group">
            <label>{t.creator.status}</label>
            <select
              className="creator-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as SeriesStatus)}
              disabled={isSubmitting}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="creator-form-actions">
            <button type="button" className="btn btn-outline" onClick={resetForm} disabled={isSubmitting}>
              {t.common.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> {t.common.loading}</>
              ) : editing ? (
                t.creator.updateSeries
              ) : (
                t.creator.createSeries
              )}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="wallet-empty" style={{ minHeight: 200 }}>
          <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          <p>{t.creator.loadingSeries}</p>
        </div>
      ) : series.length === 0 ? (
        <div className="wallet-empty">
          <BookOpen size={28} />
          <p>{t.creator.noSeries}</p>
          <span>{t.creator.noSeriesDesc}</span>
        </div>
      ) : (
        <section className="creator-series-grid">
          {series.map((s) => (
            <article key={s.id} className="creator-series-card">
              <div className="creator-series-cover">
                {s.coverUrl ? (
                  <img className="cover-fill" src={s.coverUrl} alt="" loading="lazy" />
                ) : (
                  <BookOpen size={36} />
                )}
              </div>
              <div className="creator-series-body">
                <h3>{s.title}</h3>
                <span className="creator-series-genre">{s.genre}</span>
                <div className="creator-series-meta">
                  <span>{s.reads} {t.mangaDetail.reads}</span>
                </div>
                <span className={`creator-status ${s.status}`}>{s.status}</span>
                <div className="creator-series-actions">
                  <button
                    className="creator-action-btn"
                    aria-label="View"
                    onClick={() => navigate('/creator/analytics')}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    className="creator-action-btn"
                    aria-label={t.team.title}
                    onClick={() => setTeamSeriesId((cur) => (cur === s.id ? null : s.id))}
                  >
                    <Users size={14} />
                  </button>
                  <button
                    className="creator-action-btn"
                    aria-label="Edit"
                    onClick={() => handleEdit(s)}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    className="creator-action-btn danger"
                    aria-label="Delete"
                    onClick={() => handleDelete(s)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {user && teamSeriesId && series.some((x) => x.id === teamSeriesId) && (
        <TeamPanel key={teamSeriesId} seriesId={teamSeriesId} ownerId={user.id} />
      )}
    </div>
  );
}
