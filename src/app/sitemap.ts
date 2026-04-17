import type { MetadataRoute } from 'next';

import { getPublishedBlogSitemapEntries } from '~/lib/blog/posts';
import { getPublicSiteOrigin } from '~/lib/seo/public-site-origin';

/** Public indexable routes for the root Next app (provenance.guru). */
const STATIC_PATHS = [
  '/',
  '/about',
  '/articles',
  '/grants',
  '/open-calls',
  '/open-calls/browse',
  '/registry',
  '/collectibles',
  '/exhibitions',
  '/lp/artist',
  '/lp/collector',
  '/lp/gallery',
  '/lp/institution',
  '/lp/provenance-service',
  '/pitch',
  '/investors',
] as const;

export const revalidate = 60;

/** Prefer Node for Supabase server client used by blog sitemap entries. */
export const runtime = 'nodejs';

function buildStaticEntries(base: string, now: Date): MetadataRoute.Sitemap {
  return STATIC_PATHS.map((path) => ({
    url: new URL(path, base).href,
    lastModified: now,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  console.log('[Sitemap] generating via src/app/sitemap.ts');
  const now = new Date();
  const base = getPublicSiteOrigin();

  if (base.includes('localhost')) {
    console.warn(
      '[Sitemap] NEXT_PUBLIC_SITE_URL missing or localhost; set https://www.provenance.guru in production for correct <loc> URLs.',
    );
  }

  const staticEntries = buildStaticEntries(base, now);

  try {
    const entries = await getPublishedBlogSitemapEntries();
    const blogEntries: MetadataRoute.Sitemap = [
      { url: new URL('/blog', base).href, lastModified: now },
      ...entries.map((entry) => {
        const lastModified = new Date(entry.lastmod);
        return {
          url: new URL(`/blog/${entry.slug}`, base).href,
          lastModified: Number.isNaN(lastModified.getTime())
            ? now
            : lastModified,
        };
      }),
    ];
    const combined = [...staticEntries, ...blogEntries];
    console.log('[Sitemap] returning', combined.length, 'entries');
    return combined;
  } catch (error) {
    console.error('[Sitemap] getPublishedBlogSitemapEntries failed; static URLs + /blog only', error);
    const fallback = [
      ...staticEntries,
      { url: new URL('/blog', base).href, lastModified: now },
    ];
    console.log('[Sitemap] returning', fallback.length, 'entries (no individual post URLs)');
    return fallback;
  }
}
