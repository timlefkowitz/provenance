import { NextResponse } from 'next/server';

import { discoverableSitemapXmlUrls } from '~/lib/seo/public-site-origin';

/**
 * Explicit plaintext robots.txt (avoids relying on MetadataRoute serialization).
 * See https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
 */
export async function GET() {
  const [sitemapUrl] = discoverableSitemapXmlUrls();
  console.log('[SEO/robots.txt] GET');

  const body =
    `User-agent: *\n` +
    `Allow: /\n\n` +
    `Sitemap: ${sitemapUrl}\n`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
