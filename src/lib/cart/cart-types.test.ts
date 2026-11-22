import { describe, expect, it } from 'vitest';

import { MAX_CART_ITEMS, mergeCartLines } from './cart-types';

describe('mergeCartLines', () => {
  it('dedupes by artwork and keeps order', () => {
    expect(
      mergeCartLines(
        [{ artworkId: 'a', exhibitionId: 'e1' }],
        [
          { artworkId: 'b', exhibitionId: 'e2' },
          { artworkId: 'a', exhibitionId: 'e3' },
        ],
      ),
    ).toEqual([
      { artworkId: 'a', exhibitionId: 'e1' },
      { artworkId: 'b', exhibitionId: 'e2' },
    ]);
  });

  it('drops junk from storage and caps the size', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ artworkId: `a${i}`, exhibitionId: 'e' }));
    expect(mergeCartLines([null as never, { artworkId: '', exhibitionId: 'e' }], many)).toHaveLength(MAX_CART_ITEMS);
  });
});
