/**
 * Shared types for the creator-site feature (_sites segment).
 */

export type TemplateId = 'editorial' | 'studio' | 'atelier';

export type SiteTheme = {
  /** Tailwind color key or hex. Constrained to the palette in SITE_ACCENTS. */
  accent: string;
  /** Key from SITE_FONT_PAIRINGS */
  font_pairing: string;
};

export type SiteSections = {
  bio: boolean;
  artworks: boolean;
  exhibitions: boolean;
  press: boolean;
  cv: boolean;
  contact: boolean;
};

export type SiteCta = {
  label: string;
  url: string;
};

export type SiteArtwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
};

export type SiteExhibition = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  image_url: string | null;
};

export type SitePress = {
  title: string;
  url: string;
  publication_name?: string;
  date?: string;
};

export type SiteData = {
  handle: string;
  template_id: TemplateId;
  theme: SiteTheme;
  sections: SiteSections;
  cta: SiteCta | null;
  published_at: string | null;
  /** From user_profiles */
  name: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  picture_url: string | null;
  medium: string | null;
  role: string;
  artworks: SiteArtwork[];
  exhibitions: SiteExhibition[];
  press: SitePress[];
  /** custom domain if verified */
  custom_domain: string | null;
};

/** Constrained accent color palette for site theming */
export const SITE_ACCENTS: { key: string; label: string; value: string }[] = [
  { key: 'wine',    label: 'Wine',    value: '#4A2F25' },
  { key: 'slate',   label: 'Slate',   value: '#3D4B5C' },
  { key: 'forest',  label: 'Forest',  value: '#2D4A3E' },
  { key: 'sand',    label: 'Sand',    value: '#8B7355' },
  { key: 'midnight',label: 'Midnight',value: '#1A1A2E' },
  { key: 'rose',    label: 'Rose',    value: '#8B4558' },
];

/** Font pairing options */
export const SITE_FONT_PAIRINGS: { key: string; label: string; description: string }[] = [
  { key: 'editorial', label: 'Editorial', description: 'Serif headings + sans body' },
  { key: 'modern',    label: 'Modern',    description: 'Clean sans throughout' },
];

export const DEFAULT_THEME: SiteTheme = {
  accent: 'wine',
  font_pairing: 'editorial',
};

export const DEFAULT_SECTIONS: SiteSections = {
  bio: true,
  artworks: true,
  exhibitions: true,
  press: true,
  cv: false,
  contact: true,
};
