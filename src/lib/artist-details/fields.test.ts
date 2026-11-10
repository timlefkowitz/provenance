import { describe, expect, it } from 'vitest';
import {
  appendCvEntriesToCvJson,
  buildProfileSuggestion,
  buildProfileUpdateFromSuggestion,
  cvEntriesFromCvJson,
  EMPTY_SCALARS,
  formatTombstone,
  normalizeYear,
  sanitizeCvEntries,
  sanitizePress,
  suggestionFieldKeys,
} from './fields';

const profile = {
  ...EMPTY_SCALARS,
  bio: 'Old bio',
  nationality: 'Nigerian',
  artist_cv_json: { exhibitions: [{ name: 'First Light', venue: 'Tate', year: '2020' }] },
  news_publications: [{ title: 'Review', url: 'https://example.com/a/' }],
};

describe('formatTombstone', () => {
  it('formats living and deceased artists', () => {
    expect(formatTombstone({ nationality: 'Nigerian', birth_year: 1984, birth_place: 'Lagos' })).toBe('Nigerian, b. 1984, Lagos');
    expect(formatTombstone({ nationality: 'American', birth_year: 1920, death_year: 1990 })).toBe('American, 1920–1990');
    expect(formatTombstone({})).toBe('');
  });
});

describe('normalizeYear', () => {
  it('accepts 4-digit plausible years only', () => {
    expect(normalizeYear('1984')).toBe(1984);
    expect(normalizeYear('84')).toBeNull();
    expect(normalizeYear('abc')).toBeNull();
    expect(normalizeYear(3000)).toBeNull();
  });
});

describe('sanitizers', () => {
  it('drops CV entries without a title and dedupes', () => {
    const out = sanitizeCvEntries([
      { type: 'exhibition', title: 'Show', year: '2021' },
      { type: 'exhibition', title: ' show ', year: '2021' },
      { type: 'bogus', title: 'Untyped' },
      { type: 'award', title: '' },
    ]);
    expect(out).toEqual([
      { type: 'exhibition', title: 'Show', year: '2021' },
      { type: 'exhibition', title: 'Untyped' },
    ]);
  });
  it('requires a title and http(s) url for press, dedupes by url', () => {
    const out = sanitizePress([
      { title: 'A', url: 'https://x.com/a' },
      { title: 'A again', url: 'https://x.com/a/' },
      { title: 'No url' },
      { title: 'Bad', url: 'javascript:alert(1)' },
    ]);
    expect(out.map((p) => p.title)).toEqual(['A']);
  });
});

describe('CV JSON round trip', () => {
  it('reads and appends without duplicates', () => {
    const cv = appendCvEntriesToCvJson(profile.artist_cv_json, [
      { type: 'exhibition', title: 'First Light', venue: 'Tate', year: '2020' },
      { type: 'award', title: 'Turner Prize', year: '2022' },
      { type: 'education', title: 'MFA', venue: 'Yale', year: '2010' },
    ]);
    expect((cv.exhibitions as unknown[]).length).toBe(1);
    expect(cv.awards).toEqual([{ name: 'Turner Prize', venue: '', year: '2022' }]);
    expect(cv.education).toEqual([{ institution: 'Yale', degree: 'MFA', year: '2010' }]);
    const entries = cvEntriesFromCvJson(cv);
    expect(entries.find((e) => e.type === 'education')).toMatchObject({ title: 'MFA', venue: 'Yale' });
  });
});

describe('buildProfileSuggestion', () => {
  it('sends only changed, non-empty fields and new CV/press', () => {
    const s = buildProfileSuggestion(
      {
        bio: 'New bio',
        nationality: 'Nigerian',
        birth_place: null,
        cv_entries: [
          { type: 'exhibition', title: 'First Light', venue: 'Tate', year: '2020' },
          { type: 'exhibition', title: 'Second Wind', venue: 'MoMA', year: '2023' },
        ],
        press: [
          { title: 'Review', url: 'https://example.com/a' },
          { title: 'Interview', url: 'https://example.com/b' },
        ],
      },
      profile,
    );
    expect(suggestionFieldKeys(s).sort()).toEqual(['bio', 'cv_entries_add', 'press_add']);
    expect(s.cv_entries_add?.map((e) => e.title)).toEqual(['Second Wind']);
    expect(s.press_add?.map((p) => p.title)).toEqual(['Interview']);
  });

  it('is empty when the profile already matches', () => {
    expect(suggestionFieldKeys(buildProfileSuggestion({ bio: 'Old bio' }, profile))).toEqual([]);
  });
});

describe('buildProfileUpdateFromSuggestion', () => {
  const suggestion = {
    bio: 'New bio',
    birth_year: 1984,
    cv_entries_add: [{ type: 'award' as const, title: 'Prize' }],
    press_add: [
      { title: 'Interview', url: 'https://example.com/b' },
      { title: 'Dup', url: 'https://example.com/a' },
    ],
  };

  it('applies only accepted keys, with the artist overrides', () => {
    const update = buildProfileUpdateFromSuggestion(suggestion, profile, ['bio', 'press_add'], { bio: 'My own words' });
    expect(update.bio).toBe('My own words');
    expect(update.birth_year).toBeUndefined();
    expect(update.artist_cv_json).toBeUndefined();
    expect((update.news_publications as { url: string }[]).map((p) => p.url)).toEqual([
      'https://example.com/a/',
      'https://example.com/b',
    ]);
  });

  it('appends accepted CV entries to the CV JSON', () => {
    const update = buildProfileUpdateFromSuggestion(suggestion, profile, ['cv_entries_add']);
    expect((update.artist_cv_json as { awards: unknown[] }).awards).toHaveLength(1);
    expect((update.artist_cv_json as { exhibitions: unknown[] }).exhibitions).toHaveLength(1);
  });
});
