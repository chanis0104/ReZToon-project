import { supabase } from '../lib/supabase';
import { clearMangaCache } from './mangaService';
import { explainDbError } from '../lib/dbError';

export type AuthorRole = 'reader' | 'creator' | 'both' | 'supervisor';

export interface Review {
    id: string;
    mangaId: string;
    authorId: string;
    authorName: string;
    authorRole: AuthorRole;
    rating: number;
    title: string;
    content: string;
    createdAt: string;
    helpful: string[];
}

export interface ReviewAggregate {
    average: number;
    count: number;
    distribution: { stars: number; count: number; percent: number }[];
    creatorAverage: number;
    creatorCount: number;
    readerAverage: number;
    readerCount: number;
}

export type ReviewSort = 'recent' | 'highest' | 'lowest' | 'helpful';
export type ReviewRoleFilter = 'all' | 'creator' | 'reader';

function mapRow(r: any): Review {
    return {
        id: r.id,
        mangaId: r.manga_id,
        authorId: r.author_id,
        authorName: r.author_name,
        authorRole: r.author_role as AuthorRole,
        rating: r.rating,
        title: r.title,
        content: r.content,
        createdAt: r.created_at,
        helpful: (r.review_helpful || []).map((h: any) => h.user_id),
    };
}

export async function getReviewsForManga(mangaId: string): Promise<Review[]> {
    const { data, error } = await supabase
        .from('reviews')
        .select('*, review_helpful(user_id)')
        .eq('manga_id', mangaId)
        .order('created_at', { ascending: false });
    if (error) console.error('[reviewService] getReviewsForManga :', error.code, error.message);
    if (error || !data) return [];
    return data.map(mapRow);
}

export async function getAllReviews(): Promise<Review[]> {
    const { data, error } = await supabase
        .from('reviews')
        .select('*, review_helpful(user_id)')
        .order('created_at', { ascending: false });
    if (error) console.error('[reviewService] getAllReviews :', error.code, error.message);
    if (error || !data) return [];
    return data.map(mapRow);
}

export async function getReviewAggregate(mangaId: string): Promise<ReviewAggregate> {
    const reviews = await getReviewsForManga(mangaId);
    const count = reviews.length;

    const distribution = [5, 4, 3, 2, 1].map((stars) => {
        const c = reviews.filter((r) => Math.round(r.rating) === stars).length;
        return { stars, count: c, percent: count > 0 ? (c / count) * 100 : 0 };
    });

    const average = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
    const creators = reviews.filter((r) => r.authorRole === 'creator' || r.authorRole === 'both');
    const readers = reviews.filter((r) => r.authorRole === 'reader');

    return {
        average,
        count,
        distribution,
        creatorAverage: creators.length
            ? creators.reduce((s, r) => s + r.rating, 0) / creators.length
            : 0,
        creatorCount: creators.length,
        readerAverage: readers.length
            ? readers.reduce((s, r) => s + r.rating, 0) / readers.length
            : 0,
        readerCount: readers.length,
    };
}

export async function getUserReview(mangaId: string, userId: string): Promise<Review | null> {
    const { data } = await supabase
        .from('reviews')
        .select('*, review_helpful(user_id)')
        .eq('manga_id', mangaId)
        .eq('author_id', userId)
        .maybeSingle();
    return data ? mapRow(data) : null;
}

export async function addReview(
    author: { id: string; name: string; role: AuthorRole },
    payload: { mangaId: string; rating: number; title: string; content: string },
): Promise<Review> {
    const { data, error } = await supabase
        .from('reviews')
        .insert({
            manga_id: payload.mangaId,
            author_id: author.id,
            author_name: author.name,
            author_role: author.role,
            rating: Math.max(1, Math.min(5, Math.round(payload.rating))),
            title: payload.title.trim(),
            content: payload.content.trim(),
        })
        .select('*')
        .single();

    if (error || !data) {
        console.error('[reviewService] addReview :', error?.code, error?.message);
        throw new Error(explainDbError(error, "Impossible de publier l'avis."));
    }

    clearMangaCache();

    return mapRow({ ...data, review_helpful: [] });
}

export async function updateReview(
    reviewId: string,
    userId: string,
    updates: Partial<Pick<Review, 'rating' | 'title' | 'content'>>,
): Promise<Review> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.rating !== undefined) {
        dbUpdates.rating = Math.max(1, Math.min(5, Math.round(updates.rating)));
    }
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;

    const { data, error } = await supabase
        .from('reviews')
        .update(dbUpdates)
        .eq('id', reviewId)
        .eq('author_id', userId)
        .select('*')
        .single();

    if (error || !data) {
        console.error('[reviewService] updateReview :', error?.code, error?.message);
        throw new Error(explainDbError(error, "Impossible de modifier l'avis."));
    }

    clearMangaCache();

    return mapRow({ ...data, review_helpful: [] });
}

export async function deleteReview(reviewId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId)
        .eq('author_id', userId);

    if (error) {
        console.error('[reviewService] deleteReview :', error.code, error.message);
        throw new Error(explainDbError(error, "Impossible de supprimer l'avis."));
    }

    clearMangaCache();

    return true;
}

export async function toggleHelpful(reviewId: string, userId: string): Promise<void> {
    const { data } = await supabase
        .from('review_helpful')
        .select('*')
        .eq('review_id', reviewId)
        .eq('user_id', userId)
        .maybeSingle();

    const { error } = data
        ? await supabase
            .from('review_helpful')
            .delete()
            .eq('review_id', reviewId)
            .eq('user_id', userId)
        : await supabase
            .from('review_helpful')
            .insert({ review_id: reviewId, user_id: userId });
    if (error) throw new Error(explainDbError(error));
}

export function filterReviewsByRole(reviews: Review[], role: ReviewRoleFilter): Review[] {
    if (role === 'all') return reviews;
    if (role === 'creator') {
        return reviews.filter((r) => r.authorRole === 'creator' || r.authorRole === 'both');
    }
    return reviews.filter((r) => r.authorRole === 'reader');
}

export function sortReviews(reviews: Review[], sort: ReviewSort): Review[] {
    const copy = reviews.slice();
    switch (sort) {
        case 'recent':
            return copy.sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
        case 'highest':
            return copy.sort((a, b) => b.rating - a.rating);
        case 'lowest':
            return copy.sort((a, b) => a.rating - b.rating);
        case 'helpful':
            return copy.sort((a, b) => b.helpful.length - a.helpful.length);
    }
}
