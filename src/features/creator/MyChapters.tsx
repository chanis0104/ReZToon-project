import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Edit3, Image as ImageIcon, Loader2, X } from 'lucide-react';

import { supabase } from '../../core/lib/supabase';
import { useCurrentUser } from '../../core/hooks/useCurrentUser';
import {
  getChaptersByOwner,
  getSeriesByOwner,
  updateChapter,
} from '../../core/services/contentService';
import type { Chapter, ChapterStatus, Series } from '../../core/services/contentService';
import { uploadCover } from '../../core/services/coverService';
import CoverPicker from '../../shared/ui/CoverPicker';
import type { CoverPickerValue } from '../../shared/ui/CoverPicker';
import { useT } from '../../config/i18n';

const NO_COVER: CoverPickerValue = { file: null, removed: false };

/** Aperçu d'un fichier local ; l'URL objet est libérée au démontage. */
function LocalPreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt={file.name} />;
}

export default function MyChapters() {
  const user = useCurrentUser();
  const t = useT();

  const [series, setSeries] = useState<Series[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesFilter, setSeriesFilter] = useState('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulaire d'édition
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<ChapterStatus>('draft');
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [newPages, setNewPages] = useState<File[]>([]);
  const [cover, setCover] = useState<CoverPickerValue>(NO_COVER);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, c] = await Promise.all([getSeriesByOwner(user.id), getChaptersByOwner(user.id)]);
      setSeries(s);
      setChapters(c);
    } catch (err) {
      console.error('Failed to load chapters:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const seriesTitle = useMemo(() => {
    const map = new Map(series.map((s) => [s.id, s.title]));
    return (id: string) => map.get(id) ?? '—';
  }, [series]);

  const visible = useMemo(
    () =>
      chapters
        .filter((c) => seriesFilter === 'all' || c.seriesId === seriesFilter)
        .sort((a, b) => a.seriesId.localeCompare(b.seriesId) || a.number - b.number),
    [chapters, seriesFilter],
  );

  const openEditor = (c: Chapter) => {
    setEditing(c);
    setTitle(c.title);
    setSummary(c.summary ?? '');
    setStatus(c.status);
    setPageUrls(c.pageUrls);
    setNewPages([]);
    setCover(NO_COVER);
    setMessage(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setNewPages([]);
    setCover(NO_COVER);
  };

  const handleAddPages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    const images = picked.filter((f) => f.type.startsWith('image/'));
    if (images.length !== picked.length) setMessage({ type: 'error', text: t.creatorForm.errPages });
    if (images.length) setNewPages((prev) => [...prev, ...images]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editing || saving) return;

    if (!title.trim()) {
      setMessage({ type: 'error', text: t.chapterEdit.errTitle });
      return;
    }
    if (status === 'published' && pageUrls.length + newPages.length === 0) {
      setMessage({ type: 'error', text: t.chapterEdit.errPages });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const uploaded = await Promise.all(
        newPages.map(async (file, i) => {
          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
          const path = `${user.id}/${editing.seriesId}/${editing.number}/${Date.now()}-e${i}.${ext}`;
          const { error } = await supabase.storage.from('manga-pages').upload(path, file, { upsert: true });
          if (error) throw new Error(`Upload failed for page ${i + 1}: ${error.message}`);
          return supabase.storage.from('manga-pages').getPublicUrl(path).data.publicUrl;
        }),
      );

      const coverUrl = cover.file
        ? await uploadCover(cover.file, user.id, 'chapter')
        : cover.removed
          ? null
          : undefined;

      await updateChapter({ id: user.id, name: user.name }, editing.id, {
        title,
        summary,
        status,
        pageUrls: [...pageUrls, ...uploaded],
        coverUrl,
      });

      setMessage({ type: 'success', text: t.chapterEdit.saved });
      closeEditor();
      await refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t.common.errUnexpected });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="creator-page">
      <header className="creator-page-header">
        <div>
          <span className="creator-page-tag">{t.creator.myChapters}</span>
          <h1>{t.creator.myChapters}</h1>
          <p>{t.creator.myChaptersDesc}</p>
        </div>
        {series.length > 1 && (
          <select
            className="creator-select"
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
            aria-label={t.common.series}
          >
            <option value="all">{t.chapterEdit.allSeries}</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
      </header>

      {message && <div className={`form-message ${message.type}`} role="alert">{message.text}</div>}

      {editing && (
        <form className="creator-form" onSubmit={handleSave}>
          <h2 style={{ margin: 0 }}>
            {t.chapterEdit.editTitle} — {seriesTitle(editing.seriesId)} #{editing.number}
          </h2>

          <div className="creator-form-grid">
            <div className="creator-form-group">
              <label>{t.chapterEdit.number}</label>
              <input type="number" value={editing.number} disabled readOnly />
              <span className="creator-char-counter">{t.chapterEdit.numberLocked}</span>
            </div>
            <div className="creator-form-group">
              <label>{t.chapterEdit.statusLabel}</label>
              <select
                className="creator-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as ChapterStatus)}
                disabled={saving}
              >
                <option value="draft">{t.chapterEdit.draft}</option>
                <option value="published">{t.chapterEdit.published}</option>
              </select>
            </div>
          </div>

          <div className="creator-form-group">
            <label>{t.creatorForm.chapterTitle}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
          </div>

          <div className="creator-form-group">
            <label>{t.creatorForm.summary}</label>
            <textarea
              className="creator-textarea"
              rows={4}
              maxLength={400}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={saving}
            />
            <span className="creator-char-counter">{summary.length}/400</span>
          </div>

          <CoverPicker
            label={t.coverForm.chapterLabel}
            currentUrl={editing.coverUrl}
            value={cover}
            onChange={setCover}
            aspect="landscape"
            disabled={saving}
          />

          <div className="creator-form-group">
            <label>
              {t.chapterEdit.currentPages} ({pageUrls.length + newPages.length} {t.chapterEdit.pagesCount})
            </label>
            {pageUrls.length > 0 && (
              <div className="creator-chapter-pages">
                {pageUrls.map((url, i) => (
                  <div key={url} className="creator-chapter-page">
                    <img src={url} alt={`Page ${i + 1}`} loading="lazy" />
                    <button
                      type="button"
                      aria-label={t.chapterEdit.removePage}
                      onClick={() => setPageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={saving}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {newPages.length > 0 && (
              <div className="creator-chapter-pages">
                {newPages.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="creator-chapter-page">
                    <LocalPreview file={file} />
                    <button
                      type="button"
                      aria-label={t.chapterEdit.removePage}
                      onClick={() => setNewPages((prev) => prev.filter((_, idx) => idx !== i))}
                      disabled={saving}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="creator-upload" style={{ cursor: saving ? 'not-allowed' : 'pointer', marginTop: 8 }}>
              <input type="file" accept="image/*" multiple hidden onChange={handleAddPages} disabled={saving} />
              <ImageIcon size={22} />
              <strong>{t.chapterEdit.addPages}</strong>
              <span>{t.creatorForm.uploadHint}</span>
            </label>
          </div>

          <div className="creator-form-actions">
            <button type="button" className="btn btn-outline" onClick={closeEditor} disabled={saving}>
              {t.common.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> {t.chapterEdit.saving}</>
              ) : (
                t.chapterEdit.save
              )}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="wallet-empty" style={{ minHeight: 200 }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="wallet-empty">
          <BookOpen size={28} />
          <p>{t.chapterEdit.empty}</p>
          <span>{t.chapterEdit.emptyDesc}</span>
        </div>
      ) : (
        <section className="creator-chapter-list">
          {visible.map((c) => (
            <article key={c.id} className="creator-chapter-row">
              <div className="creator-chapter-thumb">
                {c.coverUrl ? <img src={c.coverUrl} alt="" loading="lazy" /> : <BookOpen size={20} />}
              </div>
              <div className="creator-chapter-info">
                <strong>#{c.number} · {c.title}</strong>
                <span>{seriesTitle(c.seriesId)} · {c.pageUrls.length} {t.chapterEdit.pagesCount}</span>
              </div>
              <span className={`creator-status ${c.status === 'published' ? 'ongoing' : 'hiatus'}`}>
                {c.status === 'published' ? t.chapterEdit.published : t.chapterEdit.draft}
              </span>
              <button
                type="button"
                className="creator-action-btn"
                aria-label={t.chapterEdit.edit}
                title={t.chapterEdit.edit}
                onClick={() => openEditor(c)}
              >
                <Edit3 size={14} />
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
