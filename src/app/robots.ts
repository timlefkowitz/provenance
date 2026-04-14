import type { MetadataRoute } from 'next';

import { discoverableSitemapXmlUrls } from '~/lib/seo/public-site-origin';

export default function robots(): MetadataRoute.Robots {
  const [sitemapUrl] = discoverableSitemapXmlUrls();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: sitemapUrl,
  };
}
