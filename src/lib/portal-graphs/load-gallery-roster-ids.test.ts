import { describe, expect, it } from 'vitest';

import { loadGalleryRosterIds } from './load-gallery-roster-ids';

type Row = Record<string, unknown>;

/** Minimal chainable stand-in for the admin client: supports in / not / select. */
function fakeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const query = {
        select: () => query,
        in(col: string, values: unknown[]) {
          rows = rows.filter((r) => values.includes(r[col]));
          return query;
        },
        not(col: string) {
          rows = rows.filter((r) => r[col] != null);
          return query;
        },
        then(resolve: (v: { data: Row[]; error: null }) => void) {
          resolve({ data: rows, error: null });
        },
      };
      return query;
    },
  };
}

describe('loadGalleryRosterIds', () => {
  const base = {
    user_profiles: [{ id: 'gp1', user_id: 'gallery-owner' }],
    exhibitions: [{ id: 'ex1', gallery_id: 'gallery-owner' }],
  };

  it('includes selected exhibition works that carry no gallery profile', async () => {
    const admin = fakeAdmin({
      ...base,
      artworks: [
        { id: 'tagged', gallery_profile_id: 'gp1', source_artwork_id: null },
        { id: 'artist-coa', gallery_profile_id: null, source_artwork_id: null },
      ],
      exhibition_artworks: [
        { exhibition_id: 'ex1', artwork_id: 'artist-coa', status: 'selected', cos_artwork_id: null },
      ],
    });
    expect((await loadGalleryRosterIds(admin, ['gp1'])).sort()).toEqual(['artist-coa', 'tagged']);
  });

  it('skips submitted and declined works', async () => {
    const admin = fakeAdmin({
      ...base,
      artworks: [{ id: 'a' }, { id: 'b' }],
      exhibition_artworks: [
        { exhibition_id: 'ex1', artwork_id: 'a', status: 'submitted', cos_artwork_id: null },
        { exhibition_id: 'ex1', artwork_id: 'b', status: 'declined', cos_artwork_id: null },
      ],
    });
    expect(await loadGalleryRosterIds(admin, ['gp1'])).toEqual([]);
  });

  it('counts a work once when both the artist CoA and its CoS are linked', async () => {
    const admin = fakeAdmin({
      ...base,
      artworks: [
        { id: 'coa', gallery_profile_id: null, source_artwork_id: null },
        { id: 'cos', gallery_profile_id: null, source_artwork_id: 'coa' },
      ],
      exhibition_artworks: [
        { exhibition_id: 'ex1', artwork_id: 'coa', status: 'selected', cos_artwork_id: 'cos' },
        { exhibition_id: 'ex1', artwork_id: 'cos', status: 'selected', cos_artwork_id: null },
      ],
    });
    expect(await loadGalleryRosterIds(admin, ['gp1'])).toEqual(['cos']);
  });
});
