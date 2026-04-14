/**
 * Gallery profiles shown in the public directory (/registry).
 * Only these are listed until more galleries are verified for the directory.
 */
const LISTED_SLUGS = new Set(['flight']);

function normalizeGalleryBrand(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** FL!ght / FL!GHT-style names normalize to "flght". */
function isFlightGalleryName(name: string): boolean {
  const n = normalizeGalleryBrand(name);
  return n === 'flght' || n === 'flight';
}

export function isPublicDirectoryGallery(profile: {
  name: string;
  slug?: string | null;
}): boolean {
  const slug = (profile.slug ?? '').trim().toLowerCase();
  if (slug && LISTED_SLUGS.has(slug)) {
    return true;
  }
  return isFlightGalleryName(profile.name);
}
