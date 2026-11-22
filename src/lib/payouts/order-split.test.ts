import { describe, expect, it } from 'vitest';

import { allocateProRata, splitOrder } from './earnings-math';

describe('allocateProRata', () => {
  it('always sums to the total', () => {
    const parts = allocateProRata(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it('splits by weight', () => {
    expect(allocateProRata(3230, [100000, 10000])).toEqual([2936, 294]);
  });

  it('puts everything on the first part when weights are zero', () => {
    expect(allocateProRata(50, [0, 0])).toEqual([50, 0]);
  });
});

describe('splitOrder', () => {
  const base = {
    artistAccountId: 'artist',
    galleryAccountId: 'gallery',
  };

  it('one artist line when there is no commission', () => {
    const lines = splitOrder(
      [{ ...base, orderItemId: 'oi1', artworkId: 'a1', priceCents: 100000, commissionPercent: 0 }],
      2930,
      2.7,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      sellerAccountId: 'artist',
      role: 'artist',
      grossCents: 100000,
      platformFeeCents: 2700,
      stripeFeeCents: 2930,
      netCents: 94370,
    });
  });

  it('splits commission and shares fees in proportion', () => {
    const lines = splitOrder(
      [{ ...base, orderItemId: 'oi1', artworkId: 'a1', priceCents: 100000, commissionPercent: 40 }],
      2930,
      2.7,
    );
    expect(lines).toHaveLength(2);
    const [artist, gallery] = lines;
    expect(artist).toMatchObject({ role: 'artist', grossCents: 60000, stripeFeeCents: 1758, platformFeeCents: 1620 });
    expect(gallery).toMatchObject({
      role: 'gallery_commission',
      sellerAccountId: 'gallery',
      grossCents: 40000,
      stripeFeeCents: 1172,
      platformFeeCents: 1080,
    });
    const gross = lines.reduce((a, l) => a + l.grossCents, 0);
    const fees = lines.reduce((a, l) => a + l.stripeFeeCents, 0);
    expect(gross).toBe(100000);
    expect(fees).toBe(2930);
  });

  it('no commission line when the gallery is the artist', () => {
    const lines = splitOrder(
      [{ orderItemId: 'oi1', artworkId: 'a1', priceCents: 5000, artistAccountId: 'g', galleryAccountId: 'g', commissionPercent: 50 }],
      175,
      2.7,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.grossCents).toBe(5000);
  });

  it('shares Stripe fee across a multi-work cart and keeps totals exact', () => {
    const lines = splitOrder(
      [
        { ...base, orderItemId: 'oi1', artworkId: 'a1', priceCents: 123457, commissionPercent: 33.33 },
        { ...base, artistAccountId: 'artist2', orderItemId: 'oi2', artworkId: 'a2', priceCents: 9999, commissionPercent: 0 },
        { ...base, orderItemId: 'oi3', artworkId: 'a3', priceCents: 1, commissionPercent: 50 },
      ],
      3913,
      2.7,
    );
    expect(lines.reduce((a, l) => a + l.grossCents, 0)).toBe(123457 + 9999 + 1);
    expect(lines.reduce((a, l) => a + l.stripeFeeCents, 0)).toBe(3913);
    for (const l of lines) expect(l.netCents).toBeGreaterThanOrEqual(0);
  });
});
