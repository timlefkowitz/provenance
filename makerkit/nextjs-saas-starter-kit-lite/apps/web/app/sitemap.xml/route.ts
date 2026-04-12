import { getServerSideSitemap } from 'next-sitemap';

import appConfig from '~/config/app.config';
import { getPublishedBlogSitemapEntries } from '~/lib/blog/posts';

/**
 * @description The maximum age of the sitemap in seconds.
 * This is used to set the cache-control header for the sitemap. The cache-control header is used to control how long the sitemap is cached.
 * By default, the cache-control header is set to 'public, max-age=600, s-maxage=3600'.
 * This means that the sitemap will be cached for 600 seconds (10 minutes) and will be considered stale after 3600 seconds (1 hour).
 */
const MAX_AGE = 60;
const S_MAX_AGE = 3600;

export async function GET() {
  console.log('[Sitemap] GET started');
  const paths = [...getStaticPaths(), ...(await getBlogSitemapPaths())];

  const headers = {
    'Cache-Control': `public, max-age=${MAX_AGE}, s-maxage=${S_MAX_AGE}`,
  };

  console.log('[Sitemap] GET returning', paths.length, 'entries');
  return getServerSideSitemap(paths, headers);
}

function getStaticPaths() {
  const paths = [
    '/',
    '/faq',
    '/cookie-policy',
    '/terms-of-service',
    '/privacy-policy',
    // add more paths here
  ];

  return paths.map((path) => {
    return {
      loc: new URL(path, appConfig.url).href,
      lastmod: new Date().toISOString(),
    };
  });
}

async function getBlogSitemapPaths() {
  try {
    const entries = await getPublishedBlogSitemapEntries();
    const blogIndex = {
      loc: new URL('/blog', appConfig.url).href,
      lastmod: new Date().toISOString(),
    };
    const posts = entries.map((entry) => ({
      loc: new URL(`/blog/${entry.slug}`, appConfig.url).href,
      lastmod: new Date(entry.lastmod).toISOString(),
    }));

    return [blogIndex, ...posts];
  } catch (error) {
    console.error('[Sitemap] getBlogSitemapPaths failed', error);
    return [
      {
        loc: new URL('/blog', appConfig.url).href,
        lastmod: new Date().toISOString(),
      },
    ];
  }
}
