import { describe, expect, it } from 'vitest';
import {
  safeHttpUrl,
  sanitizeLlmGrants,
  selectOpenCallsForArtist,
  type OpenCallCandidate,
} from './weekly-digest';

const NOW = new Date('2026-09-21T10:00:00Z');
const SITE = 'https://provenance.guru';

describe('safeHttpUrl', () => {
  it('accepts http(s) and rejects everything else', () => {
    expect(safeHttpUrl('https://example.org/apply')).toBe('https://example.org/apply');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
    expect(safeHttpUrl(42)).toBeNull();
  });
});

describe('sanitizeLlmGrants', () => {
  it('drops nameless, past-deadline, excluded and duplicate grants; keeps undated ones', () => {
    const out = sanitizeLlmGrants(
      [
        { name: 'Future Grant', deadline: '2026-11-01', url: 'https://a.org' },
        { name: 'Past Grant', deadline: '2026-01-01' },
        { name: 'Undated Residency', type: 'residency', url: 'javascript:x' },
        { name: 'future grant', deadline: '2026-12-01' },
        { name: 'Already Sent' },
        { deadline: '2026-11-01' },
        { name: 'Bad Date', deadline: 'sometime in spring' },
      ],
      NOW,
      ['already sent'],
    );
    expect(out.map((g) => g.name)).toEqual(['Future Grant', 'Undated Residency', 'Bad Date']);
    expect(out[1]).toMatchObject({ type: 'residency', url: null, deadline: null });
    expect(out[2].deadline).toBeNull();
  });
});

const oc = (over: Partial<OpenCallCandidate> & { title?: string }): OpenCallCandidate => ({
  slug: 'slug',
  submission_closing_date: '2026-10-15',
  medium: null,
  eligible_locations: [],
  external_url: null,
  exhibition: { title: over.title ?? 'Show', description: null },
  ...over,
});

describe('selectOpenCallsForArtist', () => {
  const calls = [
    oc({ slug: 'ny-only', title: 'NY only', eligible_locations: ['New York'], submission_closing_date: '2026-09-30' }),
    oc({ slug: 'open-late', title: 'Anywhere late', submission_closing_date: '2026-12-01' }),
    oc({ slug: 'painting', title: 'Painting call', medium: 'Painting', submission_closing_date: '2026-11-20' }),
    oc({ slug: 'ext', title: 'External', external_url: 'https://ext.org/apply', submission_closing_date: '2026-10-01' }),
  ];

  it('filters by location and ranks medium matches first, then soonest deadline', () => {
    const items = selectOpenCallsForArtist(calls, { location: 'Chicago, IL', medium: 'Oil painting' }, SITE);
    expect(items.map((i) => i.title)).toEqual(['Painting call', 'External', 'Anywhere late']);
  });

  it('includes location-restricted calls when the artist location matches', () => {
    const items = selectOpenCallsForArtist(calls, { location: 'Brooklyn, New York', medium: null }, SITE);
    expect(items[0].title).toBe('NY only');
  });

  it('excludes restricted calls when the artist has no location', () => {
    const items = selectOpenCallsForArtist(calls, { location: null, medium: null }, SITE);
    expect(items.map((i) => i.title)).not.toContain('NY only');
  });

  it('links to the external page when set, otherwise the platform page', () => {
    const items = selectOpenCallsForArtist(calls, { location: null, medium: null }, SITE);
    expect(items.find((i) => i.title === 'External')?.url).toBe('https://ext.org/apply');
    expect(items.find((i) => i.title === 'Painting call')?.url).toBe(`${SITE}/open-calls/painting`);
  });
});
