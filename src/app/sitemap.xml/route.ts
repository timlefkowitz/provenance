import { NextResponse } from 'next/server';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

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
  '/privacy-policy',
  '/terms-of-service',
  '/cookie-policy',
  '/billing-terms',
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

  // Blog posts
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
  } catch (error) {
    console.error('[SEO/sitemap.xml] blog URLs omitted beyond index', error);
    out.push({ loc: new URL('/blog', base).href, lastModified: now });
  }

  // Dynamic public profile pages (artists, galleries) and verified certificates
  try {
    const admin = getSupabaseServerAdminClient() as any;

    // Artist profile pages — accounts with artist role
    const { data: artistAccounts } = await admin
      .from('user_profiles')
      .select('id, updated_at')
      .eq('role', 'artist')
      .limit(2000);

    for (const artist of artistAccounts ?? []) {
      out.push({
        loc: new URL(`/artists/${artist.id}`, base).href,
        lastModified: artist.updated_at ? new Date(artist.updated_at) : now,
      });
    }

    // Gallery pages — profiles with a slug
    const { data: galleryProfiles } = await admin
      .from('user_profiles')
      .select('slug, updated_at')
      .eq('role', 'gallery')
      .not('slug', 'is', null)
      .limit(500);

    for (const gallery of galleryProfiles ?? []) {
      if (gallery.slug) {
        out.push({
          loc: new URL(`/g/${gallery.slug}`, base).href,
          lastModified: gallery.updated_at ? new Date(gallery.updated_at) : now,
        });
      }
    }

    // Verified artwork certificate pages (public, verified)
    const { data: artworks } = await admin
      .from('artworks')
      .select('id, updated_at')
      .eq('status', 'verified')
      .eq('is_public', true)
      .limit(5000);

    for (const artwork of artworks ?? []) {
      out.push({
        loc: new URL(`/artworks/${artwork.id}/certificate`, base).href,
        lastModified: artwork.updated_at ? new Date(artwork.updated_at) : now,
      });
    }

    console.log('[SEO/sitemap.xml] returning', out.length, 'urls (with dynamic pages)');
  } catch (error) {
    console.error('[SEO/sitemap.xml] dynamic pages omitted', error);
    console.log('[SEO/sitemap.xml] returning', out.length, 'urls (static only)');
  }

  const xml = buildSitemapXml(out);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400',
    },
  });
}
