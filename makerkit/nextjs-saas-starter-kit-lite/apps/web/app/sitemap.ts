import type { MetadataRoute } from 'next';

import { PERSONA_LANDING_PATHS } from '~/(marketing)/lp/_components/persona-landing-seo';
import appConfig from '~/config/app.config';
import { getPublishedBlogSitemapEntries } from '~/lib/blog/posts';

const STATIC_PATHS = [
  '/',
  '/faq',
  '/create-certificate-of-authenticity',
  '/cookie-policy',
  '/terms-of-service',
  '/privacy-policy',
  ...PERSONA_LANDING_PATHS,
] as const;

/** Regenerate sitemap periodically (seconds). */
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  console.log('[Sitemap] generating via app/sitemap.ts');
  const base = appConfig.url;
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: new URL(path, base).href,
    lastModified: now,
  }));

  let blogEntries: MetadataRoute.Sitemap = [];

  try {
    const entries = await getPublishedBlogSitemapEntries();
    blogEntries = [
      { url: new URL('/blog', base).href, lastModified: now },
      ...entries.map((entry) => ({
        url: new URL(`/blog/${entry.slug}`, base).href,
        lastModified: new Date(entry.lastmod),
      })),
    ];
  } catch (error) {
    console.error('[Sitemap] getPublishedBlogSitemapEntries failed', error);
    blogEntries = [{ url: new URL('/blog', base).href, lastModified: now }];
  }

  const combined = [...staticEntries, ...blogEntries];
  console.log('[Sitemap] returning', combined.length, 'entries');

  return combined;
}
