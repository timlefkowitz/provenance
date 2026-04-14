import 'server-only';

/**
 * Canonical https origin for sitemap `<loc>` and `robots.txt` Sitemap lines.
 * Production serves apex → www; Search Console URL-prefix is often `https://www.…`,
 * so listing www in XML avoids “wrong host” confusion while env may still be apex.
 */
export function getPublicSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  try {
    const u = new URL(raw);
    if (u.hostname === 'provenance.guru') {
      return 'https://www.provenance.guru';
    }
    return u.origin;
  } catch {
    return 'http://localhost:3000';
  }
}

/** Single canonical sitemap URL (same host as `<loc>` in sitemap.xml) for Search Console clarity. */
export function discoverableSitemapXmlUrls(): string[] {
  const base = getPublicSiteOrigin();
  return [new URL('/sitemap.xml', base).href];
}
