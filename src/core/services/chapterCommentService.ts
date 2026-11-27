import { supabase } from '../lib/supabase';
import { explainDbError } from '../lib/dbError';

export interface ChapterComment {
  id: string;
  mangaId: string;
  chapterNumber: number;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  authorRole?: string;
  text: string;
  date: string;
  likes: string[];
  spoiler?: boolean;
  replyToId?: string | null;
}

function mapRow(r: any): ChapterComment {
  return {
    id: r.id,
    mangaId: r.manga_id,
    chapterNumber: r.chapter_number,
    authorId: r.author_id,
    authorName: r.author_name,
    authorPhoto: r.author_photo ?? undefined,
    authorRole: r.author_role ?? 'reader',
    text: r.text,
    date: r.created_at,
    likes: Array.isArray(r.likes) ? r.likes.map((l: any) => l.user_id) : [],
    spoiler: r.spoiler,
    replyToId: r.reply_to_id,
  };
}

export async function getChapterComments(
  mangaId: string,
  chapterNumber: number,
): Promise<ChapterComment[]> {
  const { data, error } = await supabase
    .from('chapter_comments')
    .select('*, likes:chapter_comment_likes(user_id)')
    .eq('manga_id', mangaId)
    .eq('chapter_number', chapterNumber)
    .order('created_at', { ascending: true });

  if (error) console.error('[chapterCommentService] getChapterComments :', error.code, error.message);
  if (error || !data) return [];
  return data.map(mapRow);
}

export async function addChapterComment(
  author: { id: string; name: string; photo?: string; role?: string },
  payload: {
    mangaId: string;
    chapterNumber: number;
    text: string;
    spoiler?: boolean;
    replyToId?: string | null;
  },
): Promise<ChapterComment | null> {
  const trimmed = (payload.text ?? '').trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('chapter_comments')
    .insert({
      manga_id: payload.mangaId,
      chapter_number: payload.chapterNumber,
      author_id: author.id,
      author_name: author.name,
      author_photo: author.photo,
      author_role: author.role ?? 'reader',
      text: trimmed,
      spoiler: Boolean(payload.spoiler),
      reply_to_id: payload.replyToId,
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('[chapterCommentService] addChapterComment :', error?.code, error?.message);
    throw new Error(explainDbError(error, 'Impossible de publier le commentaire.'));
  }
  return mapRow({ ...data, likes: [] });
}

export async function deleteChapterComment(
  commentId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('chapter_comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId);
  if (error) console.error('[chapterCommentService] deleteChapterComment :', error.code, error.message);
  return !error;
}

export async function toggleCommentLike(
  commentId: string,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from('chapter_comment_likes')
    .select('*')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  const { error } = data
    ? await supabase
        .from('chapter_comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId)
    : await supabase
        .from('chapter_comment_likes')
        .insert({ comment_id: commentId, user_id: userId });
  if (error) throw new Error(explainDbError(error));
}

export async function getChapterCommentCount(
  mangaId: string,
  chapterNumber: number,
): Promise<number> {
  const { count } = await supabase
    .from('chapter_comments')
    .select('*', { count: 'exact', head: true })
    .eq('manga_id', mangaId)
    .eq('chapter_number', chapterNumber);
  return count ?? 0;
}

export async function getCommentsCountByChapter(
  mangaId: string,
): Promise<Record<number, number>> {
  const { data } = await supabase
    .from('chapter_comments')
    .select('chapter_number')
    .eq('manga_id', mangaId);

  const map: Record<number, number> = {};
  (data ?? []).forEach((c: any) => {
    map[c.chapter_number] = (map[c.chapter_number] ?? 0) + 1;
  });
  return map;
}
