import { describe, expect, it, vi } from 'vitest';

import type { ResolvedCartItem } from '~/lib/cart/resolve-cart';

const resolved: ResolvedCartItem[] = [];
vi.mock('~/lib/cart/resolve-cart', () => ({
  resolveCartItems: vi.fn(async () => resolved),
}));

const { isInvoiceExpired, newInvoiceToken, resolveInvoiceItems } = await import('./invoices');

function item(artworkId: string, over: Partial<ResolvedCartItem>): ResolvedCartItem {
  return {
    artworkId,
    exhibitionId: 'ex',
    available: true,
    reason: null,
    title: artworkId,
    artistName: null,
    imageUrl: null,
    exhibitionTitle: 'Show',
    priceCents: 1000,
    currency: 'usd',
    artistAccountId: 'artist',
    galleryAccountId: 'gallery',
    commissionPercent: 30,
    relatedArtworkIds: [artworkId],
    requiresAccount: false,
    ...over,
  };
}

const invoice = {
  id: 'inv',
  token: 't'.repeat(32),
  exhibition_id: 'ex',
  gallery_account_id: 'gallery',
  buyer_name: null,
  buyer_email: null,
  note: null,
  currency: 'usd',
  status: 'open' as const,
  order_id: null,
  expires_at: null,
  paid_at: null,
  created_at: '2026-11-22T00:00:00Z',
};

describe('resolveInvoiceItems', () => {
  it('uses the invoiced price and lets a gallery invoice works not listed online', async () => {
    resolved.splice(
      0,
      resolved.length,
      item('a', { reason: 'not_for_sale', available: false, priceCents: 0 }),
      item('b', { reason: 'sales_closed', available: false, priceCents: 5000 }),
      item('c', {}),
    );
    const out = await resolveInvoiceItems({} as never, invoice, [
      { artwork_id: 'a', title: 'A', price_cents: 12000 },
      { artwork_id: 'b', title: 'B', price_cents: 4500 },
      { artwork_id: 'c', title: 'C', price_cents: 999 },
    ]);
    expect(out.map((o) => [o.artworkId, o.available, o.priceCents])).toEqual([
      ['a', true, 12000],
      ['b', true, 4500],
      ['c', true, 999],
    ]);
  });

  it('never sells a work that is sold, held or gone', async () => {
    resolved.splice(
      0,
      resolved.length,
      item('a', { reason: 'sold', available: false }),
      item('b', { reason: 'held', available: false }),
      item('c', { reason: 'not_found', available: false, artistAccountId: '' }),
    );
    const out = await resolveInvoiceItems({} as never, invoice, [
      { artwork_id: 'a', title: 'A', price_cents: 100 },
      { artwork_id: 'b', title: 'B', price_cents: 100 },
      { artwork_id: 'c', title: 'C', price_cents: 100 },
    ]);
    expect(out.map((o) => [o.available, o.reason])).toEqual([
      [false, 'sold'],
      [false, 'held'],
      [false, 'not_found'],
    ]);
  });
});

describe('invoice links', () => {
  it('makes long unguessable tokens', () => {
    const t = newInvoiceToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newInvoiceToken()).not.toBe(t);
  });

  it('expires only when an expiry is set and passed', () => {
    expect(isInvoiceExpired({ expires_at: null })).toBe(false);
    expect(isInvoiceExpired({ expires_at: '2026-01-01T00:00:00Z' }, new Date('2026-02-01'))).toBe(true);
  });
});
