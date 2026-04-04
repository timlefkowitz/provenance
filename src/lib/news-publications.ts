/**
 * Helpers for profile press / news_publications (dedupe by normalized URL).
 */

export type NewsPublicationInput = {
  title: string;
  url: string;
  publication_name?: string;
  date?: string;
};

export function normalizeNewsPublicationUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    u.hash = '';
    let href = u.href;
    if (href.endsWith('/') && u.pathname !== '/') {
      href = href.slice(0, -1);
    }
    return href.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/** Later items with duplicate URLs are dropped. */
export function dedupeNewsPublications<T extends NewsPublicationInput>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = normalizeNewsPublicationUrl(item.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Merge new publications into existing, deduping by URL (existing wins order). */
export function mergeNewsPublicationsDeduped<T extends NewsPublicationInput>(
  existing: T[],
  additions: T[],
): T[] {
  return dedupeNewsPublications([...existing, ...additions]);
}
