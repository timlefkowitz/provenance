import { NextResponse } from 'next/server';

import { getPublishedBlogSitemapEntries } from '~/lib/blog/posts';
import { buildSitemapXml } from '~/lib/seo/sitemap-xml';
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
  '/investors',
] as const;

/** Seconds — ISR-style freshness without tying crawlers to the MetadataRoute pipeline. */
export const revalidate = 60;

export const runtime = 'nodejs';

export async function GET() {
  console.log('[SEO/sitemap.xml] GET started');
  const base = getPublicSiteOrigin();
  const now = new Date();

  if (base.includes('localhost')) {
    console.warn(
      '[SEO/sitemap.xml] NEXT_PUBLIC_SITE_URL missing or localhost; set https://www.provenance.guru in production.',
    );
  }

  const out: { loc: string; lastModified: Date }[] = [];

  for (const path of STATIC_PATHS) {
    out.push({ loc: new URL(path, base).href, lastModified: now });
  }

  try {
    const posts = await getPublishedBlogSitemapEntries();
    out.push({ loc: new URL('/blog', base).href, lastModified: now });
    for (const row of posts) {
      const lastModified = new Date(row.lastmod);
      out.push({
        loc: new URL(`/blog/${row.slug}`, base).href,
        lastModified,
      });
    }
    console.log('[SEO/sitemap.xml] returning', out.length, 'urls');
  } catch (error) {
    console.error('[SEO/sitemap.xml] blog URLs omitted beyond index', error);
    out.push({ loc: new URL('/blog', base).href, lastModified: now });
    console.log('[SEO/sitemap.xml] returning', out.length, 'urls (fallback)');
  }

  const xml = buildSitemapXml(out);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400',
    },
  });
}
