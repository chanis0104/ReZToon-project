import type {
    CatalogueCardData, GenreDescription, PopularCardData, LikedBookData, StatItem, FeaturedData, FooterData, LandingData,
} from '../../config/types';
import { getAllMangas } from './mangaService';

export interface FeaturedSlide {
    id: string; badge: string; title: string; highlight: string; ageBadge: string; meta: string[]; rating: string; description: string; stats: { value: string; label: string }[]; image: string;

    coverUrl?: string;

    rank?: number;

    allTime?: boolean;
}

const STATIC_CATALOGUE: CatalogueCardData[] = [
    { genre: 'Mankia', tag: 'Heroic Fantasy' },
    { genre: 'Yorman', tag: 'Urban Noir' },
    { genre: "Lover's", tag: 'Romance' },
    { genre: 'Mountété', tag: 'Mystic' },
    { genre: 'Mandrea', tag: 'Sci-Fi' },
    { genre: 'Contes', tag: 'Folklore' },
];

const STATIC_GENRES: Record<string, GenreDescription> = {
    Mankia: { title: 'MANKIA', desc: 'Heroic fantasy inspired by African legends.' },
    Yorman: { title: 'YORMAN', desc: 'Urban noir and gritty street stories.' },
    "Lover's": { title: "LOVER'S", desc: 'Romance, drama, and slow burns.' },
    Mountété: { title: 'MOUNTÉTÉ', desc: 'Mystical and folklore-driven tales.' },
    Mandrea: { title: 'MANDREA', desc: 'Afrofuturism and sci-fi.' },
    Contes: { title: 'CONTES', desc: 'Myths, fables, and moral stories.' },
};

const STATIC_STATS: StatItem[] = [
    { target: 250, label: 'African Manga' },
    { target: 150, label: 'Creators' },
    { target: 50000, label: 'Readers' },
];

const FOOTER_FALLBACK: FooterData = {
    brand: 'ReZToon',
    tagline: 'The home of African manga.',
    columns: [
        {
            title: 'Genres',
            links: [
                { label: 'Mankia', href: '#catalogue' }, { label: 'Yorman', href: '#catalogue' },
                { label: "Lover's", href: '#catalogue' }, { label: 'Mountété', href: '#catalogue' },
                { label: 'Mandrea', href: '#catalogue' }, { label: 'Contes', href: '#catalogue' },
            ],
        },
        {
            title: 'Community',
            links: [
                { label: 'WhatsApp', href: 'https://chat.whatsapp.com/GscnnFrSfWs38NwUqHDDvZ?s=cl&p=a&iam=2' },
            ],
        },
    ],
    copyright: '© 2026 ReZToon - All rights reserved.',
};

const LANDING_FALLBACK: LandingData = {
    brand: 'ReZToon', copyright: '© 2026 ReZToon', nav: [],
    hero: { badge: 'Welcome', titleLineOne: 'Discover African', titleHighlight: 'Manga', subtitle: 'Read the best.', primaryCta: 'Explore', secondaryCta: 'Learn More' },
    about: { tag: 'About', title: 'Our Mission', paragraphs: [], features: [] },
    catalogue: { tag: 'Genres', title: 'Explore Universes', subtitle: '' },
    newsletter: { tag: 'Newsletter', title: 'Stay Updated', subtitle: '', placeholder: 'Email', cta: 'Subscribe' },
};

export function getCatalogueCards(): CatalogueCardData[] { return STATIC_CATALOGUE; }
export function getGenreDescription(genre: string): GenreDescription { return STATIC_GENRES[genre] || { title: genre.toUpperCase(), desc: 'Discover African manga.' }; }
export function getHeroStats(): StatItem[] { return STATIC_STATS; }
export function getFooter(genreNames?: readonly string[]): FooterData {
    if (!genreNames || genreNames.length === 0) return FOOTER_FALLBACK;
    return {
        ...FOOTER_FALLBACK,
        columns: FOOTER_FALLBACK.columns.map((col) =>
            col.title === 'Genres'
                ? { ...col, links: genreNames.map((name) => ({ label: name, href: '#catalogue' })) }
                : col,
        ),
    };
}
export function getLanding(): LandingData { return LANDING_FALLBACK; }

export function getFeatured(): FeaturedData {
    return {
        badge: 'NEW',
        title: 'Discover',
        highlight: 'African Manga',
        ageBadge: '13+',
        meta: ['Action', 'Fantasy'],
        rating: '★ 4.8',
        description: 'Explore the best African manga.',
        stats: [],
        image: '/Images/1.jpeg'
    };
}

export async function getPopularCards(): Promise<PopularCardData[]> {
    const mangas = await getAllMangas();
    return mangas.slice(0, 10).map(m => ({ id: m.id, title: m.title, sub: m.author, tag: m.tag || 'Series', icon: m.cover, coverUrl: m.coverUrl, genre: m.genre }));
}

export async function getFeaturedSlides(): Promise<FeaturedSlide[]> {
    const mangas = await getAllMangas();
    return mangas.slice(0, 5).map((m) => ({
        id: m.id, badge: m.tag || 'NEW RELEASE', title: m.title.split(' ').slice(0, 2).join(' '),
        highlight: m.title.split(' ').slice(2).join(' ') || m.subtitle, ageBadge: '13+',
        meta: [m.genre, m.author, 'NEW'], rating: `★ ${m.rating.toFixed(1)}`, description: m.description,
        stats: [{ value: `${m.reads}`, label: 'READS' }, { value: `${m.chapters?.length || 0}`, label: 'CHAPTERS' }, { value: m.status.toUpperCase(), label: 'STATUS' }],
        image: '/Images/1.jpeg', coverUrl: m.coverUrl
    }));
}

export async function getAnnonceBooks(count = 20): Promise<PopularCardData[]> {
    const mangas = await getAllMangas();
    return mangas.slice(0, count).map(m => ({ id: m.id, title: m.title, sub: m.author, tag: m.tag || 'Series', icon: m.cover, coverUrl: m.coverUrl, genre: m.genre }));
}

export async function getMostLikedBooks(count = 12): Promise<LikedBookData[]> {
    const mangas = await getAllMangas();
    return mangas.slice().sort((a, b) => b.likes - a.likes).slice(0, count).map((m, i) => ({
        id: m.id, title: m.title, sub: m.author, tag: m.tag || 'Series', icon: m.cover, coverUrl: m.coverUrl, genre: m.genre, likes: m.likes, rank: i + 1
    }));
}
