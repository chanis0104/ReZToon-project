import { useEffect, useMemo, useState } from 'react';
import { Upload, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { supabase } from '../../core/lib/supabase';

import { useCurrentUser } from '../../core/hooks/useCurrentUser';
import { createChapter, getSeriesByOwner } from '../../core/services/contentService';
import type { Series } from '../../core/services/contentService';
import { useT } from '../../config/i18n';
import CoverPicker from '../../shared/ui/CoverPicker';
import type { CoverPickerValue } from '../../shared/ui/CoverPicker';
import { uploadCover } from '../../core/services/coverService';

interface FileItem {
  file: File;
  preview: string;
}

export default function NewChapter() {
  const user = useCurrentUser();
  const t = useT();

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [seriesId, setSeriesId] = useState('');
  const [number, setNumber] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [items, setItems] = useState<FileItem[]>([]);
  const [cover, setCover] = useState<CoverPickerValue>({ file: null, removed: false });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await getSeriesByOwner(user.id);
        if (!cancelled) {
          setSeriesList(list);
          if (list.length > 0 && !seriesId) setSeriesId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load series:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const selectedSeries = useMemo(
    () => seriesList.find((s) => s.id === seriesId) ?? null,
    [seriesList, seriesId],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selected.length) return;

    const validImages = selected.filter((f) => f.type.startsWith('image/'));
    if (validImages.length !== selected.length) {
      setStatus({ type: 'error', text: t.creatorForm.errPages });
    }
    if (!validImages.length) return;

    const newItems = await Promise.all(
      validImages.map(
        (file) =>
          new Promise<FileItem>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({ file, preview: typeof reader.result === 'string' ? reader.result : '' });
            reader.onerror = () => resolve({ file, preview: '' });
            reader.readAsDataURL(file);
          }),
      ),
    );

    setItems((prev) => [...prev, ...newItems]);
  };

  const removeFile = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async (publish: boolean) => {
    if (!user || isSubmitting) return;

    if (!seriesId || !number || !title.trim()) {
      setStatus({ type: 'error', text: t.creatorForm.errRequired });
      return;
    }

    if (publish && items.length === 0) {
      setStatus({ type: 'error', text: t.creatorForm.errPages });
      return;
    }

    const chapterNumber = Number(number);
    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
      setStatus({ type: 'error', text: t.creatorForm.errNumber });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const uploadPromises = items.map(async ({ file }, i) => {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${seriesId}/${chapterNumber}/${Date.now()}-${i}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('manga-pages')
          .upload(path, file, { upsert: true });

        if (uploadError) throw new Error(`Upload failed for page ${i + 1}: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('manga-pages')
          .getPublicUrl(path);

        return publicUrl;
      });

      const pageUrls = await Promise.all(uploadPromises);
      // Couverture du chapitre : facultative.
      const coverUrl = cover.file ? await uploadCover(cover.file, user.id, 'chapter') : undefined;

      const result = await createChapter(
        { id: user.id, name: user.name },
        {
          seriesId,
          number: chapterNumber,
          title,
          summary,
          status: publish ? 'published' : 'draft',
          publishDate,
          pageUrls,
          coverUrl,
        },
      );

      if (!result.ok) throw new Error(result.message);

      const actionLabel = publish ? t.creatorForm.successPublished : t.creatorForm.successDraft;

      setStatus({
        type: 'success',
        text: `Chapter ${number} "${title}" ${actionLabel} ${pageUrls.length} pages.`,
      });

      setNumber('');
      setTitle('');
      setSummary('');
      setPublishDate('');
      setItems([]);
      setCover({ file: null, removed: false });
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message || t.common.errUnexpected });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="creator-page" style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="creator-page">
      <header className="creator-page-header">
        <div>
          <span className="creator-page-tag">{t.creator.publishNewChapter}</span>
          <h1>{t.creator.newChapter}</h1>
          <p>{t.creator.publishNewChapter}</p>
        </div>
      </header>

      {status && (
        <div className={`form-message ${status.type}`} role="alert">
          {status.text}
        </div>
      )}

      {seriesList.length === 0 ? (
        <div className="wallet-empty">
          <ImageIcon size={28} />
          <p>{t.creator.noSeries}</p>
          <span>{t.creator.noSeriesDesc}</span>
        </div>
      ) : (
        <form className="creator-form" onSubmit={(e) => { e.preventDefault(); void submit(true); }}>
          <div className="creator-form-grid">
            <div className="creator-form-group">
              <label>{t.common.series}</label>
              <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="creator-select" disabled={isSubmitting}>
                {seriesList.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div className="creator-form-group">
              <label>{t.creatorForm.chapterNumber}</label>
              <input type="number" min="1" placeholder="1" value={number} onChange={(e) => setNumber(e.target.value)} disabled={isSubmitting} />
            </div>
          </div>

          <div className="creator-form-group">
            <label>{t.creatorForm.chapterTitle}</label>
            <input type="text" placeholder={t.creatorForm.chapterTitle} value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSubmitting} />
          </div>

          <div className="creator-form-group">
            <label>{t.creatorForm.summary}</label>
            <textarea className="creator-textarea" rows={4} maxLength={400} placeholder={t.creatorForm.summaryPlaceholder} value={summary} onChange={(e) => setSummary(e.target.value)} disabled={isSubmitting} />
            <span className="creator-char-counter">{summary.length}/400</span>
          </div>

          <div className="creator-form-group">
            <label>{t.creatorForm.publishDate}</label>
            <input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} disabled={isSubmitting} />
          </div>

          <CoverPicker
            label={t.coverForm.chapterLabel}
            value={cover}
            onChange={setCover}
            aspect="landscape"
            disabled={isSubmitting}
          />

          <div className="creator-form-group">
            <label>{t.creatorForm.pages} ({items.length} {t.creatorForm.selected})</label>
            <label className={`creator-upload ${isSubmitting ? 'disabled' : ''}`} style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
              <input type="file" accept="image/*" multiple hidden onChange={handleFileChange} disabled={isSubmitting} />
              <ImageIcon size={28} />
              <strong>{t.creatorForm.clickToUpload}</strong>
              <span>{t.creatorForm.uploadHint}</span>
            </label>

            {items.length > 0 && (
              <div className="creator-page-previews">
                {items.map((item, i) => (
                  <div key={i} className="creator-page-preview">
                    <img src={item.preview} alt={`Page ${i + 1}`} />
                    <button type="button" onClick={() => removeFile(i)} disabled={isSubmitting}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="creator-form-actions">
            <button type="button" className="btn btn-outline" onClick={() => void submit(false)} disabled={isSubmitting}>
              {t.creatorForm.saveDraft}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> {t.creatorForm.uploading} {items.length}...</>
              ) : (
                <><Upload size={16} /> {t.creatorForm.publishChapter}</>
              )}
            </button>
          </div>

          {selectedSeries && <span className="creator-char-counter">{t.creatorForm.target} {selectedSeries.title}</span>}
        </form>
      )}
    </div>
  );
}
