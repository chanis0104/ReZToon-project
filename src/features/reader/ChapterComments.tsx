import { useEffect, useMemo, useState } from 'react';
import {
  MessageCircle, Send, Heart, Trash2, Eye, EyeOff, AlertTriangle, X, Loader2,
} from 'lucide-react';
import { useCurrentUser } from '../../core/hooks/useCurrentUser';
import {
  getChapterComments,
  addChapterComment,
  deleteChapterComment,
  toggleCommentLike,
  type ChapterComment,
} from '../../core/services/chapterCommentService';
import { formatRelativeTime } from '../../core/utils/format';
import { useT, useI18n } from '../../config/i18n';

interface Props {
  mangaId: string;
  chapterNumber: number;
}

const MAX_LEN = 500;

export default function ChapterComments({ mangaId, chapterNumber }: Props) {
  const user = useCurrentUser();
  const t = useT();
  const { lang } = useI18n();

  const [comments, setComments] = useState<ChapterComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [draft, setDraft] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [showSpoilerIds, setShowSpoilerIds] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<ChapterComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await getChapterComments(mangaId, chapterNumber);
        if (!cancelled) setComments(data);
      } catch (err) {
        console.error('Failed to load comments:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [mangaId, chapterNumber, refreshKey]);

  const { roots, repliesByParent } = useMemo(() => {
    const roots: ChapterComment[] = [];
    const repliesByParent = new Map<string, ChapterComment[]>();

    for (const c of comments) {
      if (c.replyToId) {
        const arr = repliesByParent.get(c.replyToId) ?? [];
        arr.push(c);
        repliesByParent.set(c.replyToId, arr);
      } else {
        roots.push(c);
      }
    }

    return { roots, repliesByParent };
  }, [comments]);

  useEffect(() => {
    setDraft('');
    setReplyTo(null);
    setSpoiler(false);
  }, [mangaId, chapterNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !draft.trim() || submitting) return;

    setSubmitting(true);
    setPostError(null);
    try {
      await addChapterComment(
        { id: user.id, name: user.name, photo: user.photo, role: user.role },
        {
          mangaId,
          chapterNumber,
          text: draft,
          spoiler,
          replyToId: replyTo?.id ?? null,
        },
      );

      setDraft('');
      setSpoiler(false);
      setReplyTo(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to post comment:', err);
      setPostError(err instanceof Error ? err.message : t.common.errUnexpected);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!window.confirm(t.comments.deleteConfirm)) return;

    const success = await deleteChapterComment(id, user.id);
    if (success) setRefreshKey((k) => k + 1);
  };

  const handleLike = async (id: string) => {
    if (!user) return;

    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const hasLiked = c.likes.includes(user.id);
        return {
          ...c,
          likes: hasLiked ? c.likes.filter((x) => x !== user.id) : [...c.likes, user.id],
        };
      }),
    );

    try {
      await toggleCommentLike(id, user.id);
    } catch {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const hasLiked = c.likes.includes(user.id);
          return {
            ...c,
            likes: hasLiked ? c.likes.filter((x) => x !== user.id) : [...c.likes, user.id],
          };
        }),
      );
    }
  };

  const toggleSpoilerView = (id: string) => {
    setShowSpoilerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderComment = (c: ChapterComment, isReply = false) => {
    const liked = user ? c.likes.includes(user.id) : false;
    const isMine = user?.id === c.authorId;
    const showText = !c.spoiler || showSpoilerIds.has(c.id);

    return (
      <li
        key={c.id}
        className={`chapter-comment ${isReply ? 'is-reply' : ''} ${c.spoiler ? 'has-spoiler' : ''}`}
      >
        <div className="chapter-comment-avatar">
          {c.authorPhoto ? (
            <img src={c.authorPhoto} alt={c.authorName} />
          ) : (
            (c.authorName || '?').charAt(0).toUpperCase()
          )}
        </div>

        <div className="chapter-comment-body">
          <div className="chapter-comment-head">
            <strong>{c.authorName}</strong>
            {c.authorRole === 'creator' || c.authorRole === 'both' ? (
              <span className="chapter-comment-badge">{t.comments.creator}</span>
            ) : null}
            <span className="chapter-comment-time">{formatRelativeTime(c.date, lang)}</span>
          </div>

          {c.spoiler && !showText ? (
            <button
              type="button"
              className="chapter-comment-spoiler-btn"
              onClick={() => toggleSpoilerView(c.id)}
            >
              <Eye size={12} />
              {t.comments.spoilerWarning} — {t.comments.clickToReveal}
            </button>
          ) : (
            <p className="chapter-comment-text">
              {c.spoiler && (
                <button
                  type="button"
                  className="chapter-comment-spoiler-toggle"
                  onClick={() => toggleSpoilerView(c.id)}
                  aria-label={t.comments.hideSpoiler}
                >
                  <EyeOff size={11} />
                </button>
              )}
              {c.text}
            </p>
          )}

          <div className="chapter-comment-actions">
            <button
              type="button"
              className={`chapter-comment-action ${liked ? 'active' : ''}`}
              onClick={() => handleLike(c.id)}
            >
              <Heart size={11} fill={liked ? 'currentColor' : 'none'} />
              {c.likes.length > 0 ? c.likes.length : ''}
            </button>

            {!isReply && (
              <button
                type="button"
                className="chapter-comment-action"
                onClick={() => {
                  setReplyTo(c);
                  setDraft('');
                }}
              >
                {t.comments.reply}
              </button>
            )}

            {isMine && (
              <button
                type="button"
                className="chapter-comment-action danger"
                onClick={() => handleDelete(c.id)}
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>

          {repliesByParent.get(c.id)?.length ? (
            <ul className="chapter-comment-replies">
              {repliesByParent.get(c.id)!.map((r) => renderComment(r, true))}
            </ul>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section className="chapter-comments">
      <header className="chapter-comments-header">
        <h3>
          <MessageCircle size={16} /> {t.comments.discussion}
          <span className="chapter-comments-count">{loading ? '...' : comments.length}</span>
        </h3>
      </header>

      {user ? (
        <form className="chapter-comments-composer" onSubmit={handleSubmit}>
          {postError && <div className="form-message error" role="alert">{postError}</div>}
          {replyTo && (
            <div className="chapter-comments-reply-bar">
              <span>↩ {t.comments.reply} <strong>{replyTo.authorName}</strong></span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label={t.common.cancel}>
                <X size={11} />
              </button>
            </div>
          )}

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
            placeholder={t.comments.shareThoughts}
            rows={3}
            disabled={submitting}
          />

          <div className="chapter-comments-composer-foot">
            <label className="chapter-comments-spoiler-toggle">
              <input
                type="checkbox"
                checked={spoiler}
                onChange={(e) => setSpoiler(e.target.checked)}
                disabled={submitting}
              />
              <AlertTriangle size={12} />
              <span>{t.comments.markSpoiler}</span>
            </label>

            <span className="chapter-comments-char">
              {draft.length}/{MAX_LEN}
            </span>

            <button
              type="submit"
              className="chapter-comments-send"
              disabled={!draft.trim() || submitting}
            >
              {submitting ? (
                <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Send size={14} />
              )}
              {submitting ? t.comments.posting : t.comments.post}
            </button>
          </div>
        </form>
      ) : (
        <div className="chapter-comments-login">
          <MessageCircle size={22} />
          <p>{t.comments.signInToJoin}</p>
        </div>
      )}

      {loading ? (
        <div className="chapter-comments-empty">
          <Loader2 size={24} className="spin" style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          <p>{t.comments.loadingComments}</p>
        </div>
      ) : roots.length === 0 ? (
        <div className="chapter-comments-empty">
          <p>{t.comments.noCommentsChapter}</p>
          <span>{t.comments.beTheFirst}</span>
        </div>
      ) : (
        <ul className="chapter-comments-list">{roots.map((c) => renderComment(c))}</ul>
      )}
    </section>
  );
}
