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
