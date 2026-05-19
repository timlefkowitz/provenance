import { afterEach, describe, expect, it } from 'vitest';

import {
  buildSitemapXml,
  escapeXml,
  lastmodDay,
  type SitemapUrlEntry,
} from './sitemap-xml';
import { discoverableSitemapXmlUrls, getPublicSiteOrigin } from './public-site-origin';

describe('escapeXml', () => {
  it('escapes special characters in loc', () => {
    expect(escapeXml('a&b<c>"\'')).toBe('a&amp;b&lt;c&gt;&quot;&apos;');
  });
});

describe('lastmodDay', () => {
  it('uses YYYY-MM-DD for valid dates', () => {
    const fallback = new Date('2026-01-01T00:00:00.000Z');
    expect(lastmodDay(new Date('2026-05-19T12:00:00.000Z'), fallback)).toBe('2026-05-19');
  });

  it('falls back when date is invalid', () => {
    const fallback = new Date('2026-04-14T00:00:00.000Z');
    expect(lastmodDay(new Date('not-a-date'), fallback)).toBe('2026-04-14');
  });
});

describe('buildSitemapXml', () => {
  it('produces a valid urlset with declaration and namespace', () => {
    const entries: SitemapUrlEntry[] = [
      {
        loc: 'https://www.provenance.guru/',
        lastModified: new Date('2026-05-19T00:00:00.000Z'),
      },
    ];
    const xml = buildSitemapXml(entries);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://www.provenance.guru/</loc>');
    expect(xml).toContain('<lastmod>2026-05-19</lastmod>');
    expect(xml).toContain('</urlset>');
  });

  it('does not include HTML or localhost', () => {
    const xml = buildSitemapXml([
      {
        loc: 'https://www.provenance.guru/about',
        lastModified: new Date('2026-05-19T00:00:00.000Z'),
      },
    ]);
    expect(xml).not.toMatch(/<html/i);
    expect(xml).not.toContain('localhost');
  });
});

describe('getPublicSiteOrigin', () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it('normalizes apex provenance.guru to www', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://provenance.guru';
    expect(getPublicSiteOrigin()).toBe('https://www.provenance.guru');
  });

  it('keeps www origin unchanged', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.provenance.guru';
    expect(getPublicSiteOrigin()).toBe('https://www.provenance.guru');
  });
});

describe('discoverableSitemapXmlUrls', () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it('lists canonical www sitemap.xml', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://provenance.guru';
    expect(discoverableSitemapXmlUrls()).toEqual(['https://www.provenance.guru/sitemap.xml']);
  });
});
