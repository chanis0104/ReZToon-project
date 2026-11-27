export interface GenreDescription {
  title: string;
  desc: string;
}

export interface CatalogueCardData {
  genre: string;
  tag: string;
}

export interface PopularCardData {
  id: string;
  title: string;
  sub: string;
  tag: string;
  icon: string;
  coverUrl?: string;
  genre: string;
}

export interface LikedBookData {
  id: string;
  title: string;
  sub: string;
  tag: string;
  icon: string;
  coverUrl?: string;
  genre: string;
  likes: number;
  rank: number;
}

export interface StatItem {
  target: number;
  label: string;
}

export interface ModalData {
  title: string;
  description: string;
}

export interface FeaturedData {
  badge: string;
  title: string;
  highlight: string;
  ageBadge: string;
  meta: string[];
  rating: string;
  description: string;
  stats: { value: string; label: string }[];
  image: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterData {
  brand: string;
  tagline: string;
  columns: FooterColumn[];
  copyright: string;
}

export interface LandingData {
  brand: string;
  copyright: string;
  nav: { href: string; label: string }[];
  hero: {
    badge: string;
    titleLineOne: string;
    titleHighlight: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  about: {
    tag: string;
    title: string;
    paragraphs: string[];
    features: { icon: string; label: string }[];
  };
  catalogue: { tag: string; title: string; subtitle: string };
  newsletter: {
    tag: string;
    title: string;
    subtitle: string;
    placeholder: string;
    cta: string;
  };
}
