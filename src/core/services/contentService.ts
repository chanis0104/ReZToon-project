import { supabase } from '../lib/supabase';
import { createAutoReleasePost } from './communityService';
import { clearMangaCache } from './mangaService';

export type SeriesStatus = 'ongoing' | 'hiatus' | 'completed';
export type ChapterStatus = 'draft' | 'published';

export interface Series {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  genre: string;
  description: string;
  status: SeriesStatus;
  reads: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  seriesId: string;
  ownerId: string;
  ownerName: string;
  number: number;
  title: string;
  summary: string;
  status: ChapterStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pageUrls: string[];
}

export type CreateChapterResult =
  | { ok: true; chapter: Chapter }
  | { ok: false; kind: 'duplicate' | 'invalid' | 'unknown'; message: string };

function mapSeries(d: any): Series {
  return {
    id: d.id,
    ownerId: d.author_id,
    ownerName: d.author_name,
    title: d.title,
    genre: d.genre,
    description: d.description,
    status: d.status,
    reads: d.reads || 0,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapChapter(d: any): Chapter {
  return {
    id: d.id,
    seriesId: d.manga_id,
    ownerId: d.author_id,
    ownerName: d.author_name,
    number: d.number,
    title: d.title,
    summary: d.summary,
    status: d.status,
    publishedAt: d.published_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    pageUrls: Array.isArray(d.page_urls) ? d.page_urls : [],
  };
}

export async function getSeriesByOwner(ownerId: string): Promise<Series[]> {
  const { data } = await supabase
    .from('mangas')
    .select('*')
    .eq('author_id', ownerId)
    .order('updated_at', { ascending: false });
  return data ? data.map(mapSeries) : [];
}

export async function getAllSeries(): Promise<Series[]> {
  const { data } = await supabase.from('mangas').select('*');
  return data ? data.map(mapSeries) : [];
}

export async function createSeries(
  owner: { id: string; name: string },
  payload: { title: string; genre: string; description: string; status: SeriesStatus },
): Promise<Series | null> {
  if (!payload.title.trim()) return null;
  const { data, error } = await supabase
    .from('mangas')
    .insert({
      author_id: owner.id,
      author_name: owner.name,
      title: payload.title.trim(),
      genre: payload.genre,
      description: payload.description.trim(),
      status: payload.status,
    })
    .select()
    .single();
  if (error || !data) {
    console.error('[contentService] createSeries failed:', error?.code, error?.message);
    if (error?.code === '42501' || (error as any)?.status === 403) {
      throw new Error(
        "Permission refusée par la base de données (RLS). Appliquez supabase/migrations/20261126_mangas_rls.sql.",
      );
    }
    throw new Error(error?.message || 'Création impossible.');
  }
  clearMangaCache();
  return mapSeries(data);
}

export async function updateSeries(
  seriesId: string,
  actorId: string,
  updates: Partial<Pick<Series, 'title' | 'genre' | 'description' | 'status'>>,
): Promise<Series | null> {
  const { data, error } = await supabase
    .from('mangas')
    .update({
      title: updates.title,
      genre: updates.genre,
      description: updates.description,
      status: updates.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', seriesId)
    .eq('author_id', actorId)
    .select()
    .single();
  if (error || !data) return null;
  clearMangaCache();
  return mapSeries(data);
}

export async function deleteSeries(seriesId: string, actorId: string): Promise<boolean> {
  const { error } = await supabase
    .from('mangas')
    .delete()
    .eq('id', seriesId)
    .eq('author_id', actorId);
  if (!error) clearMangaCache();
  return !error;
}

export async function getChaptersByOwner(ownerId: string): Promise<Chapter[]> {
  const { data } = await supabase
    .from('chapters')
    .select('*')
    .eq('author_id', ownerId)
    .order('updated_at', { ascending: false });
  return data ? data.map(mapChapter) : [];
}

export async function getChaptersBySeries(seriesId: string): Promise<Chapter[]> {
  const { data } = await supabase
    .from('chapters')
    .select('*')
    .eq('manga_id', seriesId)
    .order('number', { ascending: true });
  return data ? data.map(mapChapter) : [];
}

export async function chapterNumberExists(seriesId: string, number: number): Promise<boolean> {
  const { data } = await supabase
    .from('chapters')
    .select('id')
    .eq('manga_id', seriesId)
    .eq('number', number)
    .maybeSingle();
  return Boolean(data);
}

export async function createChapter(
  owner: { id: string; name: string },
  payload: {
    seriesId: string;
    number: number;
    title: string;
    summary: string;
    status: ChapterStatus;
    publishDate?: string;
    pageUrls?: string[];
  },
): Promise<CreateChapterResult> {
  if (!payload.seriesId) return { ok: false, kind: 'invalid', message: 'Series required' };
  if (!payload.title.trim()) return { ok: false, kind: 'invalid', message: 'Title required' };
  if (!Number.isFinite(payload.number) || payload.number < 1) {
    return { ok: false, kind: 'invalid', message: 'Chapter number must be at least 1' };
  }

  const duplicate = await chapterNumberExists(payload.seriesId, payload.number);
  if (duplicate) {
    return { ok: false, kind: 'duplicate', message: `Chapter ${payload.number} already exists` };
  }

  const { data, error } = await supabase
    .from('chapters')
    .insert({
      manga_id: payload.seriesId,
      author_id: owner.id,
      author_name: owner.name,
      number: payload.number,
      title: payload.title.trim(),
      summary: payload.summary.trim(),
      status: payload.status,
      published_at:
        payload.status === 'published'
          ? payload.publishDate || new Date().toISOString()
          : null,
      page_urls: payload.pageUrls || [],
      pages: payload.pageUrls?.length || 0,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      return { ok: false, kind: 'duplicate', message: `Chapter ${payload.number} already exists` };
    }
    return { ok: false, kind: 'unknown', message: error?.message ?? 'Insert failed' };
  }

  clearMangaCache();

  if (payload.status === 'published') {
    await supabase
      .from('mangas')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', payload.seriesId);

    const { data: series } = await supabase
      .from('mangas')
      .select('title, genre')
      .eq('id', payload.seriesId)
      .single();

    if (series) {
      await createAutoReleasePost(
        { id: owner.id, name: owner.name },
        {
          mangaId: payload.seriesId,
          seriesTitle: series.title,
          genre: series.genre,
          chapterNumber: payload.number,
          chapterTitle: payload.title,
          summary: payload.summary,
        },
      );
    }
  }

  return { ok: true, chapter: mapChapter(data) };
}
