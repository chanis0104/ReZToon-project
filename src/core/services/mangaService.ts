import { supabase } from '../lib/supabase';

export type MangaStatus = 'ongoing' | 'completed' | 'hiatus';

export interface ChapterMeta {
  id: string;
  number: number;
  title: string;
  pages: number;
  publishedAt: string;
  pageUrls?: string[];
  /** Page de couverture facultative du chapitre. */
  coverUrl?: string;
}

export interface Manga {
  id: string;
  title: string;
  subtitle: string;
  authorId: string;
  author: string;
  cover: string;
  /** Image de couverture facultative (sinon l'icône `cover` est utilisée). */
  coverUrl?: string;
  genre: string;
  tag: string;
  status: MangaStatus;
  description: string;
  rating: number;
  ratingCount: number;
  reads: number;
  likes: number;
  chapters?: ChapterMeta[];
}

interface MangaCacheEntry {
  data: Manga[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
let mangaCache: MangaCacheEntry | null = null;
let inFlightFetch: Promise<Manga[]> | null = null;

function mapRowToManga(row: any): Manga {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    authorId: row.author_id,
    author: row.author_name,
    cover: row.cover,
    coverUrl: row.cover_url || undefined,
    genre: row.genre,
    tag: row.tag,
    status: row.status as MangaStatus,
    description: row.description,
    rating: Number(row.rating) || 0,
    ratingCount: row.rating_count || 0,
    reads: row.reads || 0,
    likes: row.likes || 0,
    chapters: (row.chapters || [])
      // Les brouillons (visibles de leur auteur via RLS) ne doivent pas apparaître côté lecteur.
      .filter((c: any) => c.status !== 'draft')
      .map((c: any) => ({
        id: c.id,
        number: c.number,
        title: c.title,
        pages: c.pages,
        publishedAt: c.published_at,
        pageUrls: Array.isArray(c.page_urls) ? c.page_urls : [],
        coverUrl: c.cover_url || undefined,
      }))
      .sort((a: any, b: any) => a.number - b.number),
  };
}

export async function getAllMangas(options: { throwOnError?: boolean } = {}): Promise<Manga[]> {
  if (mangaCache && Date.now() < mangaCache.expiresAt) {
    return mangaCache.data;
  }

  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = (async () => {
    try {
      const { data, error } = await supabase
        .from('mangas')
        .select('*, chapters (*)')
        .order('created_at', { ascending: false });

      if (error) console.error('[mangaService] getAllMangas a échoué :', error.message, error);
      else if (data && data.length === 0) console.warn('[mangaService] La requête mangas renvoie 0 ligne (table vide ou RLS sans politique SELECT).');

      if (error || !data) {
        if (options.throwOnError) throw error ?? new Error('Failed to load mangas');
        return [];
      }

      const mangas = data.map(mapRowToManga);
      mangaCache = { data: mangas, expiresAt: Date.now() + CACHE_TTL_MS };
      return mangas;
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

export async function getMangaById(id: string): Promise<Manga | null> {
  const { data, error } = await supabase
    .from('mangas')
    .select('*, chapters (*)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRowToManga(data);
}

export async function getMangasByIds(ids: string[]): Promise<Manga[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('mangas')
    .select('*, chapters (*)')
    .in('id', ids);

  if (error || !data) return [];
  return data.map(mapRowToManga);
}

export async function searchMangas(query: string): Promise<Manga[]> {
  const q = query.trim();
  if (!q) return getAllMangas();

  const safeQ = q.replace(/[(),]/g, '');
  const { data, error } = await supabase
    .from('mangas')
    .select('*, chapters (*)')
    .or(`title.ilike.%${safeQ}%,author_name.ilike.%${safeQ}%,genre.ilike.%${safeQ}%`)
    .order('reads', { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data.map(mapRowToManga);
}

export async function getChaptersForManga(id: string): Promise<ChapterMeta[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('manga_id', id)
    .eq('status', 'published')
    .order('number', { ascending: true });

  if (error || !data) return [];

  return data.map((c: any) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    pages: c.pages,
    publishedAt: c.published_at,
    pageUrls: Array.isArray(c.page_urls) ? c.page_urls : [],
    coverUrl: c.cover_url || undefined,
  }));
}

export async function getRelatedMangas(id: string, limit = 6): Promise<Manga[]> {
  const target = await getMangaById(id);
  if (!target) return [];

  const [byGenre, byAuthor] = await Promise.all([
    supabase.from('mangas').select('*').neq('id', id).eq('genre', target.genre).limit(limit),
    supabase.from('mangas').select('*').neq('id', id).eq('author_name', target.author).limit(limit),
  ]);

  const rawData = [...(byGenre.data || []), ...(byAuthor.data || [])];
  const uniqueMap = new Map();
  rawData.forEach((item) => uniqueMap.set(item.id, item));
  const finalData = Array.from(uniqueMap.values()).slice(0, limit);

  return finalData.map(mapRowToManga);
}

export function clearMangaCache() {
  mangaCache = null;
  inFlightFetch = null;
}

export function findMangaByTitle(title: string): Manga | null {
  if (!mangaCache) return null;
  const target = title.toLowerCase().trim();
  if (!target) return null;
  return mangaCache.data.find((m) => m.title.toLowerCase().trim().includes(target)) || null;
}

export function getMangaForCard(card: { id?: string; title: string; genre: string }): Manga | null {
  if (!mangaCache || mangaCache.data.length === 0) return null;
  if (card.id) {
    const byId = mangaCache.data.find((m) => m.id === card.id);
    if (byId) return byId;
  }
  const byTitle = findMangaByTitle(card.title);
  if (byTitle) return byTitle;
  return null;
}

export async function toggleMangaLike(mangaId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('manga_likes')
    .select('*')
    .eq('manga_id', mangaId)
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    await supabase.from('manga_likes').delete().eq('manga_id', mangaId).eq('user_id', userId);
    await supabase.rpc('decrement_manga_likes', { p_manga_id: mangaId });
    clearMangaCache();
    return false;
  }

  await supabase.from('manga_likes').insert({ manga_id: mangaId, user_id: userId });
  await supabase.rpc('increment_manga_likes', { p_manga_id: mangaId });
  clearMangaCache();
  return true;
}

export async function isMangaLikedByUser(mangaId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('manga_likes')
    .select('*')
    .eq('manga_id', mangaId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}
