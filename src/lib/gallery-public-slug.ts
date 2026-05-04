import { isValidSlug } from '~/lib/slug';

/** Top-level app segments and confusing names — gallery slugs cannot use these (for `/g/{slug}` clarity). */
export const RESERVED_GALLERY_SLUGS = new Set(
  [
    'about',
    'admin',
    'api',
    'articles',
    'artists',
    'artworks',
    'auth',
    'claim',
    'collectibles',
    'data',
    'docs',
    'exhibitions',
    'g',
    'gallery',
    'grants',
    'investors',
    'notifications',
    'onboarding',
    'open-calls',
    'pitch',
    'portal',
    'profile',
    'profiles',
    'registry',
    'settings',
    'subscription',
    'test',
    'www',
    'null',
    'undefined',
  ].map((s) => s.toLowerCase()),
);

/**
 * Additional reserved labels that cannot be used as creator-site subdomain handles.
 * These overlap with DNS / infrastructure names that must never be user-facing subdomains.
 */
export const RESERVED_SITE_HANDLES = new Set([
  ...RESERVED_GALLERY_SLUGS,
  'app',
  'blog',
  'cdn',
  'help',
  'mail',
  'media',
  'staging',
  'status',
  'support',
  'provenance',
  '_sites',
].map((s) => s.toLowerCase()));

export type SiteHandleValidation =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

/**
 * Validate a user-chosen subdomain handle for their creator website.
 * Rules mirror gallery slug validation but use the wider reserved-handle list.
 */
export function validateSiteHandle(raw: string): SiteHandleValidation {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: 'Site handle cannot be empty' };
  }
  if (normalized.length < 2) {
    return { ok: false, error: 'Handle must be at least 2 characters' };
  }
  if (normalized.length > 63) {
    return { ok: false, error: 'Handle must be 63 characters or less (DNS label limit)' };
  }
  if (isGalleryProfileUuid(normalized)) {
    return { ok: false, error: 'That handle is reserved. Pick a different name.' };
  }
  if (!isValidSlug(normalized)) {
    return {
      ok: false,
      error: 'Use lowercase letters, numbers, and single hyphens only (e.g. jane-doe)',
    };
  }
  if (RESERVED_SITE_HANDLES.has(normalized)) {
    return { ok: false, error: 'That handle is reserved. Pick another.' };
  }
  return { ok: true, normalized };
}

/** Match Postgres `uuid` profile ids (not valid gallery slugs). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGalleryProfileUuid(segment: string): boolean {
  return UUID_RE.test(segment.trim());
}

export type GallerySlugValidation =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

/**
 * Validate a user-chosen public slug for a gallery profile.
 */
export function validateGalleryPublicSlug(raw: string): GallerySlugValidation {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: 'Public URL slug cannot be empty' };
  }
  if (normalized.length > 100) {
    return { ok: false, error: 'Slug must be 100 characters or less' };
  }
  if (isGalleryProfileUuid(normalized)) {
    return {
      ok: false,
      error: 'That slug is reserved (looks like an ID). Pick a different name.',
    };
  }
  if (!isValidSlug(normalized)) {
    return {
      ok: false,
      error: 'Use lowercase letters, numbers, and single hyphens only (e.g. flight-gallery)',
    };
  }
  if (RESERVED_GALLERY_SLUGS.has(normalized)) {
    return { ok: false, error: 'That slug is reserved. Pick another.' };
  }
  return { ok: true, normalized };
}
