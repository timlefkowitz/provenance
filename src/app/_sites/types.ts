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

export type CertificateTypeKey = 'authenticity' | 'ownership' | 'show';

export type SiteArtworkFilters = {
  certificate_types: CertificateTypeKey[];
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
  /** Optional hero/banner image (separate from profile picture) */
  hero_image_url: string | null;
  /** Optional tagline displayed under the site name */
  tagline: string | null;
  /** From user_profiles, but may be overridden by about_override */
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
  /** Constrained surface color key */
  surface_color: string | null;
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

/** Surface (background) tone presets — paired well with each accent */
export const SITE_SURFACES: { key: string; label: string; bg: string; ink: string }[] = [
  { key: 'parchment', label: 'Parchment', bg: '#F5F1E8', ink: '#111111' },
  { key: 'cream',     label: 'Cream',     bg: '#FAF7F0', ink: '#1A1A1A' },
  { key: 'white',     label: 'White',     bg: '#FFFFFF', ink: '#111111' },
  { key: 'slate',     label: 'Slate',     bg: '#F1F4F7', ink: '#0F1419' },
  { key: 'charcoal',  label: 'Charcoal',  bg: '#1A1A1A', ink: '#F5F5F5' },
  { key: 'ink',       label: 'Ink',       bg: '#0F0F12', ink: '#F0EBE0' },
];

export const DEFAULT_SURFACE = 'parchment';

export const DEFAULT_ARTWORK_FILTERS: SiteArtworkFilters = {
  certificate_types: ['authenticity', 'ownership', 'show'],
};

export const CERTIFICATE_TYPE_LABELS: Record<CertificateTypeKey, { label: string; description: string }> = {
  authenticity: {
    label: 'Certificate of Authenticity',
    description: 'Works you created or claimed as the artist',
  },
  ownership: {
    label: 'Certificate of Ownership',
    description: 'Works in your collection',
  },
  show: {
    label: 'Certificate of Show',
    description: 'Works exhibited by your gallery or institution',
  },
};
