/**
 * Normalize a raw URL pathname into a route pattern suitable for aggregation
 * in page_activity analytics. Strips UUIDs, numeric IDs, and short slug-like
 * segments so they don't create unbounded cardinality or leak PII-ish paths.
 *
 * Examples:
 *   /artworks/a1b2c3d4-e5f6-7890-abcd-ef1234567890  → /artworks/[id]
 *   /artists/123                                      → /artists/[id]
 *   /open-calls/summer-2026-residency                 → /open-calls/[slug]
 *   /admin/users                                      → /admin/users  (kept as-is)
 */
export function normalizePath(raw: string): string {
  // Strip query string and fragment, keep pathname only.
  const pathname = raw.split('?')[0]?.split('#')[0] ?? '/';

  const segments = pathname.split('/').map((seg) => {
    if (!seg) return seg;

    // UUID (any variant)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) {
      return '[id]';
    }

    // Pure numeric id
    if (/^\d+$/.test(seg)) {
      return '[id]';
    }

    // Slug-like: contains a hyphen AND is reasonably long (>12 chars).
    // Short hyphenated segments like "open-calls" are navigation, not IDs.
    if (seg.includes('-') && seg.length > 12) {
      return '[slug]';
    }

    return seg;
  });

  const normalized = segments.join('/') || '/';
  // Cap length so no oversized paths can be inserted.
  return normalized.slice(0, 120);
}
