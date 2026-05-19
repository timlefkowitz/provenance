/**
 * Pure helpers for /sitemap.xml (testable without Next.js request context).
 */

export type SitemapUrlEntry = {
  loc: string;
  lastModified: Date;
};

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Google accepts date-only lastmod (YYYY-MM-DD). */
export function lastmodDay(d: Date, fallback: Date): string {
  const t = d.getTime();
  const base = Number.isNaN(t) ? fallback : d;
  return base.toISOString().slice(0, 10);
}

export function buildSitemapXml(entries: SitemapUrlEntry[]): string {
  const chunks = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  const now = new Date();
  for (const { loc, lastModified } of entries) {
    chunks.push('<url>');
    chunks.push(`<loc>${escapeXml(loc)}</loc>`);
    chunks.push(`<lastmod>${lastmodDay(lastModified, now)}</lastmod>`);
    chunks.push('</url>');
  }
  chunks.push('</urlset>');
  return chunks.join('\n');
}
