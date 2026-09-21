import { describe, expect, it } from 'vitest';
import { mergeLeadArtworks, uniqueArtworkIds } from './lead-artworks';

const art = (id: string, title = id) => ({ id, title, image_url: null });

describe('mergeLeadArtworks', () => {
  it('puts the legacy artwork first and de-duplicates against embedded links', () => {
    const out = mergeLeadArtworks(art('a'), [{ artwork: art('b') }, { artwork: art('a') }, { artwork: art('c') }]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('tolerates missing legacy artwork, null links, array-shaped embeds and non-arrays', () => {
    expect(mergeLeadArtworks(null, [{ artwork: [art('x')] }, { artwork: null }, null]).map((x) => x.id)).toEqual(['x']);
    expect(mergeLeadArtworks(undefined, undefined)).toEqual([]);
    expect(mergeLeadArtworks(art('a'), 'oops')).toEqual([art('a')]);
  });
});

describe('uniqueArtworkIds', () => {
  it('merges, trims, drops empties and de-duplicates in order', () => {
    expect(uniqueArtworkIds('a', [' b ', 'a', '', null, undefined, 'c'])).toEqual(['a', 'b', 'c']);
    expect(uniqueArtworkIds(null, null)).toEqual([]);
  });
});
