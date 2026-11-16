import { describe, expect, it } from 'vitest';
import {
  buildCarryOverUpdate,
  canRequestUpdateFrom,
  describeRequestedFields,
  fulfilHrefForField,
  isUnclaimedArtistProfile,
  sanitizeRequestedFields,
  type CarryOverProfile,
} from './fields';

const emptyContent: CarryOverProfile = {
  bio: null,
  artist_statement: null,
  header_image_url: null,
  artist_cv_json: null,
  artist_cv_file_url: null,
  artist_cv_file_path: null,
  artist_cv_uploaded_at: null,
};

describe('sanitizeRequestedFields', () => {
  it('keeps known fields in a stable order and drops the rest', () => {
    expect(sanitizeRequestedFields(['bio', 'nope', 'cv', 'bio', 3])).toEqual(['cv', 'bio']);
    expect(sanitizeRequestedFields('cv')).toEqual([]);
    expect(sanitizeRequestedFields(undefined)).toEqual([]);
  });
});

describe('describeRequestedFields', () => {
  it('joins labels as a sentence', () => {
    expect(describeRequestedFields(['cv'])).toBe('CV');
    expect(describeRequestedFields(['cv', 'bio'])).toBe('CV and Bio');
    expect(describeRequestedFields(['cv', 'artist_statement', 'header_image'])).toBe(
      'CV, Artist statement and Header image',
    );
  });
});

describe('fulfilHrefForField', () => {
  const target = { artistAccountId: 'u1', profileId: 'p1' };
  it('sends CV and exhibitions to the CV page and the rest to profile edit', () => {
    expect(fulfilHrefForField('cv', target)).toBe('/artists/u1/cv?profileId=p1');
    expect(fulfilHrefForField('exhibitions', target)).toBe('/artists/u1/cv?profileId=p1');
    expect(fulfilHrefForField('bio', target)).toBe('/profiles/p1/edit');
    expect(fulfilHrefForField('header_image', target)).toBe('/profiles/p1/edit');
  });
  it('works for artists with no profile row yet', () => {
    const noProfile = { artistAccountId: 'u1', profileId: null };
    expect(fulfilHrefForField('cv', noProfile)).toBe('/artists/u1/cv');
    expect(fulfilHrefForField('bio', noProfile)).toBe('/profile');
  });
});

describe('isUnclaimedArtistProfile', () => {
  it('is true only for active artist profiles with no owner', () => {
    expect(isUnclaimedArtistProfile({ role: 'artist', user_id: null, is_active: true, is_claimed: false })).toBe(true);
    expect(isUnclaimedArtistProfile({ role: 'artist', user_id: 'u1', is_active: true, is_claimed: true })).toBe(false);
    expect(isUnclaimedArtistProfile({ role: 'artist', user_id: null, is_active: false, is_claimed: false })).toBe(false);
    expect(isUnclaimedArtistProfile({ role: 'artist', user_id: null, is_active: true, is_claimed: true })).toBe(false);
    expect(isUnclaimedArtistProfile({ role: 'collector', user_id: null, is_active: true, is_claimed: false })).toBe(false);
    expect(isUnclaimedArtistProfile(null)).toBe(false);
  });
});

describe('canRequestUpdateFrom', () => {
  it('lets signed-in visitors ask an artist with an account', () => {
    expect(canRequestUpdateFrom('artist', 'gallery')).toBe(true);
  });
  it('not the artist themself, signed-out visitors, or artists without an account', () => {
    expect(canRequestUpdateFrom('artist', 'artist')).toBe(false);
    expect(canRequestUpdateFrom('artist', null)).toBe(false);
    expect(canRequestUpdateFrom(null, 'gallery')).toBe(false);
  });
});

describe('buildCarryOverUpdate', () => {
  it('copies contributed content into an empty profile', () => {
    const from: CarryOverProfile = {
      bio: 'Contributed bio',
      artist_statement: 'Statement',
      header_image_url: 'https://x/h.jpg',
      artist_cv_json: { exhibitions: [{ name: 'Show', venue: 'Gallery', year: '2021' }] },
      artist_cv_file_url: 'https://x/cv.pdf',
      artist_cv_file_path: 'u/p/cv.pdf',
      artist_cv_uploaded_at: '2026-01-01T00:00:00Z',
    };
    expect(buildCarryOverUpdate(from, emptyContent)).toEqual(from);
  });

  it("never overwrites the artist's own text, header or CV file", () => {
    const from = { ...emptyContent, bio: 'Theirs', header_image_url: 'a', artist_cv_file_path: 'x', artist_cv_file_url: 'y' };
    const to = { ...emptyContent, bio: 'Mine', header_image_url: 'b', artist_cv_file_path: 'mine' };
    expect(buildCarryOverUpdate(from, to)).toEqual({});
  });

  it('treats whitespace-only text as empty', () => {
    expect(buildCarryOverUpdate({ ...emptyContent, bio: 'New' }, { ...emptyContent, bio: '  ' })).toEqual({ bio: 'New' });
    expect(buildCarryOverUpdate({ ...emptyContent, bio: '  ' }, emptyContent)).toEqual({});
  });

  it('adds CV entries the artist does not already list', () => {
    const from = {
      ...emptyContent,
      artist_cv_json: {
        exhibitions: [
          { name: 'Shared', venue: 'V', year: '2020' },
          { name: 'Only contributed', venue: 'W', year: '2022' },
        ],
      },
    };
    const to = { ...emptyContent, artist_cv_json: { summary: 'Mine', exhibitions: [{ name: 'Shared', venue: 'V', year: '2020' }] } };
    const update = buildCarryOverUpdate(from, to);
    expect(update.artist_cv_json?.summary).toBe('Mine');
    expect(update.artist_cv_json?.exhibitions?.map((e) => e.name)).toEqual(['Shared', 'Only contributed']);
  });

  it('leaves the CV alone when nothing is new', () => {
    const cv = { exhibitions: [{ name: 'Shared', venue: 'V', year: '2020' }] };
    expect(buildCarryOverUpdate({ ...emptyContent, artist_cv_json: cv }, { ...emptyContent, artist_cv_json: cv })).toEqual({});
  });
});
