import { describe, expect, it } from 'vitest';

import { buildExhibitionQrHtml } from './exhibition-print-html';
import { readPosterOverrides, resolvePosterText, type PosterText } from './poster-text';

const DEFAULTS: PosterText = {
  owner: 'Photon Labs',
  title: 'Night Garden',
  dates: 'March 1 – April 2, 2027',
  location: 'Austin, TX',
  cta: 'Scan for the list of works',
  sub: '12 works · titles, details and certificates',
  url: 'https://provenance.guru/exhibitions/abc',
  brand: 'Provenance',
};

describe('readPosterOverrides', () => {
  it('keeps known fields, empty lines and line breaks; drops the rest', () => {
    expect(
      readPosterOverrides({ title: 'Night\nGarden', brand: '', evil: 'x', cta: 42, sub: 'a\u0000b' }),
    ).toEqual({ title: 'Night\nGarden', brand: '', sub: 'ab' });
    expect(readPosterOverrides(null)).toEqual({});
  });

  it('caps each line at its limit', () => {
    expect(readPosterOverrides({ brand: 'x'.repeat(500) }).brand).toHaveLength(60);
  });
});

describe('poster text on the printed poster', () => {
  it('uses edits, hides cleared lines and keeps defaults for the rest', () => {
    const text = resolvePosterText(DEFAULTS, { cta: 'Scan me', brand: '', title: 'Night\nGarden' });
    const html = buildExhibitionQrHtml(text, '<svg></svg>');
    expect(html).toContain('<div class="cta">Scan me</div>');
    expect(html).toContain('Night<br />Garden');
    expect(html).toContain('March 1 – April 2, 2027');
    expect(html).not.toContain('class="brand"');
    expect(html).not.toContain('list of works');
  });

  it('escapes what people type', () => {
    const html = buildExhibitionQrHtml(resolvePosterText(DEFAULTS, { owner: '<b>Hi</b>' }), '');
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;');
    expect(html).not.toContain('<b>Hi</b>');
  });
});
