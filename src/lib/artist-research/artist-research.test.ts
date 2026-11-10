import { describe, expect, it } from 'vitest';
import { EMPTY_SCALARS } from '~/lib/artist-details/fields';
import { parseArtistResearchResponse } from './parse-artist-research';
import { applyFindingsToShowCopy } from './apply-findings';

const response = `Here you go:
\`\`\`json
{
  "bio_facts": [
    { "field": "birth_year", "value": "1984", "source_url": "https://museum.org/artist", "source_title": "Museum" },
    { "field": "summary", "value": "A painter.", "source_url": "https://museum.org/artist" },
    { "field": "home_address", "value": "1 Main St", "source_url": "https://x.com" },
    { "field": "nationality", "value": "Nigerian" }
  ],
  "articles": [
    { "title": "Review", "url": "https://news.com/review?utm_source=x", "publication_name": "News", "date": "2023" },
    { "title": "No link", "url": "" }
  ],
  "exhibitions": [
    { "title": "Second Wind", "venue": "MoMA", "city": "New York", "year": 2023, "type": "solo", "source_url": "https://moma.org/x" }
  ],
  "sales": [
    { "title": "Untitled", "venue": "Christie's", "year": "2022", "price": "USD 12,500", "source_url": "https://christies.com/lot/1" }
  ],
  "awards": [],
  "collections": [{ "title": "Tate", "source_url": "ftp://tate.org" }]
}
\`\`\``;

describe('parseArtistResearchResponse', () => {
  const findings = parseArtistResearchResponse(response);

  it('keeps only sourced items with known fields', () => {
    expect(findings.map((f) => f.kind)).toEqual(['bio_fact', 'bio_fact', 'article', 'exhibition', 'sale']);
  });

  it('cleans tracking params and maps fields', () => {
    const article = findings.find((f) => f.kind === 'article')!;
    expect(article.source_url).toBe('https://news.com/review');
    const show = findings.find((f) => f.kind === 'exhibition')!;
    expect(show.payload).toMatchObject({ title: 'Second Wind', year: '2023', solo: true });
    const sale = findings.find((f) => f.kind === 'sale')!;
    expect(sale.payload).toMatchObject({ price_text: 'USD 12,500', venue: "Christie's" });
  });

  it('returns nothing for unparseable output', () => {
    expect(parseArtistResearchResponse('no json here')).toEqual([]);
  });
});

describe('applyFindingsToShowCopy', () => {
  it('fills empty fields, appends CV and press, ignores sales', () => {
    const base = { ...EMPTY_SCALARS, bio: 'Curator bio', cv_entries: [], press: [] };
    const { next, changed } = applyFindingsToShowCopy(base, parseArtistResearchResponse(response));
    expect(next.bio).toBe('Curator bio');
    expect(next.birth_year).toBe(1984);
    expect(next.cv_entries).toEqual([
      { type: 'exhibition', title: 'Second Wind', venue: 'MoMA', city: 'New York', year: '2023', url: 'https://moma.org/x' },
    ]);
    expect(next.press.map((p) => p.title)).toEqual(['Review']);
    expect(changed.sort()).toEqual(['birth_year', 'cv_entries', 'press']);
  });
});
