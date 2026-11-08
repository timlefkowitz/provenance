/**
 * Pure helpers for artwork lists (private named lists such as a
 * "To print" wall-label queue). Kept free of server imports so they
 * can be unit tested and used on both client and server.
 */

export const MAX_LIST_NAME_LENGTH = 80;
export const MAX_LIST_BATCH = 200;

/** Collapse whitespace and trim; returns null when the name is unusable. */
export function normalizeListName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const cleaned = name.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_LIST_NAME_LENGTH);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dedupe, drop anything that isn't a UUID, and cap the batch size. */
export function cleanArtworkIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out = new Set<string>();
  for (const id of ids) {
    if (typeof id === 'string' && UUID_RE.test(id)) out.add(id.toLowerCase());
    if (out.size >= MAX_LIST_BATCH) break;
  }
  return Array.from(out);
}

export function isValidListId(id: unknown): id is string {
  return typeof id === 'string' && UUID_RE.test(id);
}

const PLACEHOLDER_TITLES = new Set(['untitled', 'untitled artwork', 'unknown']);

/**
 * True when an artwork is missing the basics a wall label needs:
 * a real title or an artist name.
 */
export function isMissingInfo(artwork: { title?: string | null; artist_name?: string | null }): boolean {
  const title = artwork.title?.trim() ?? '';
  const artist = artwork.artist_name?.trim() ?? '';
  return !title || PLACEHOLDER_TITLES.has(title.toLowerCase()) || !artist;
}

/** localStorage key for the last list used by the quick-add button. */
export const LAST_LIST_STORAGE_KEY = 'provenance:last-artwork-list';
