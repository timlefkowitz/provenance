import { describe, expect, it } from 'vitest';

import { preferArtistCoa } from './prefer-artist-coa';

const coa = { id: 'coa', certificate_type: 'authenticity', source_artwork_id: null };
const cos = { id: 'cos', certificate_type: 'show', source_artwork_id: 'coa' };
const coo = { id: 'coo', certificate_type: 'ownership', source_artwork_id: 'cos' };
const other = { id: 'other', certificate_type: 'show', source_artwork_id: null };

describe('preferArtistCoa', () => {
  it('shows the COA instead of the COS recorded on its exhibition link', () => {
    const cosNoSource = { ...cos, source_artwork_id: null };
    const { rows, foldedInto } = preferArtistCoa(
      [coa, cosNoSource, other],
      [{ artwork_id: 'coa', cos_artwork_id: 'cos' }, { artwork_id: 'cos' }, { artwork_id: 'other' }],
    );
    expect(rows.map((r) => r.id)).toEqual(['coa', 'other']);
    expect(foldedInto.get('cos')).toBe('coa');
  });

  it('folds certificates issued from a shown COA, through others shown', () => {
    const { rows } = preferArtistCoa([cos, coo, coa]);
    expect(rows.map((r) => r.id)).toEqual(['coa']);
  });

  it('keeps the COS when the COA itself is not shown', () => {
    const { rows } = preferArtistCoa([cos], [{ artwork_id: 'coa', cos_artwork_id: 'cos' }]);
    expect(rows.map((r) => r.id)).toEqual(['cos']);
  });

  it('ignores a link whose COS is the work itself', () => {
    const { rows } = preferArtistCoa([other], [{ artwork_id: 'other', cos_artwork_id: 'other' }]);
    expect(rows.map((r) => r.id)).toEqual(['other']);
  });
});
