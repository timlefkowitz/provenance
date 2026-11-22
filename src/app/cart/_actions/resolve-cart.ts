'use server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { MAX_CART_ITEMS } from '~/lib/cart/cart-types';
import { resolveCartItems, type UnavailableReason } from '~/lib/cart/resolve-cart';
import { asUntyped } from '~/lib/supabase-untyped';

export type CartDisplayItem = {
  artworkId: string;
  exhibitionId: string | null;
  available: boolean;
  reason: UnavailableReason | null;
  title: string;
  artistName: string | null;
  imageUrl: string | null;
  exhibitionTitle: string;
  priceCents: number;
  currency: string;
};

const Lines = z
  .array(z.object({ artworkId: z.string().uuid(), exhibitionId: z.string().uuid().nullable() }))
  .max(MAX_CART_ITEMS);

/** Current price and availability for each work in a cart (guest or signed in). */
export async function resolveCartForDisplay(lines: unknown): Promise<CartDisplayItem[]> {
  const parsed = Lines.safeParse(lines);
  if (!parsed.success || parsed.data.length === 0) return [];
  const resolved = await resolveCartItems(asUntyped(getSupabaseServerAdminClient()), parsed.data);
  return resolved.map((r) => ({
    artworkId: r.artworkId,
    exhibitionId: r.exhibitionId,
    available: r.available,
    reason: r.reason,
    title: r.title,
    artistName: r.artistName,
    imageUrl: r.imageUrl,
    exhibitionTitle: r.exhibitionTitle,
    priceCents: r.priceCents,
    currency: r.currency,
  }));
}
