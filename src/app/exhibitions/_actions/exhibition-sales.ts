'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { commissionPercentOf } from '~/lib/exhibition-sales/listings';
import { loadExhibitionListings } from '~/lib/exhibition-sales/load-listings';
import { asUntyped } from '~/lib/supabase-untyped';

type Result = { success: true } | { success: false; error: string };
type SettingsResult = { success: true; listedCount: number } | { success: false; error: string };

export type ExhibitionSalesSummary = {
  enabled: boolean;
  commissionPercent: number;
  works: Array<{
    artworkId: string;
    title: string;
    artistName: string | null;
    imageUrl: string | null;
    forSale: boolean;
    priceCents: number | null;
    /** 'artist' = taken from the value the artist recorded, not yet saved for the show. */
    priceSource: 'show' | 'artist' | null;
    nfs: boolean;
    isSold: boolean;
  }>;
};

async function requireManager(exhibitionId: string) {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'You must be signed in' } as const;
  const admin = asUntyped(getSupabaseServerAdminClient());
  const loaded = await loadExhibitionListings(admin, exhibitionId);
  if (!loaded) return { error: 'Exhibition not found' } as const;
  if (!(await canManageExhibition(user.id, loaded.exhibition.gallery_id))) {
    return { error: 'Only the show’s gallery can change online sales' } as const;
  }
  return { user, admin, loaded } as const;
}

export async function getExhibitionSalesSummary(exhibitionId: string): Promise<ExhibitionSalesSummary | null> {
  const ctx = await requireManager(exhibitionId);
  if ('error' in ctx) return null;
  const { loaded } = ctx;
  return {
    enabled: !!loaded.exhibition.sales_enabled,
    commissionPercent: commissionPercentOf(loaded.exhibition),
    works: [...loaded.listings.values()].map((l) => ({
      artworkId: l.artworkId,
      title: l.title,
      artistName: l.artistName,
      imageUrl: l.imageUrl,
      forSale: l.forSale,
      priceCents: l.priceCents,
      priceSource: l.priceSource,
      nfs: l.nfs,
      isSold: l.isSold,
    })),
  };
}

const SettingsSchema = z.object({
  exhibitionId: z.string().uuid(),
  enabled: z.boolean(),
  commissionPercent: z.number().min(0).max(100),
});

/**
 * Switch online selling on or off for a show and set the gallery's commission.
 * Switching it on offers every unsold work with a price for sale, at the
 * artist's recorded value, except works the artist marked NFS.
 */
export async function updateExhibitionSalesSettings(
  input: z.infer<typeof SettingsSchema>,
): Promise<SettingsResult> {
  try {
    const parsed = SettingsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Commission must be between 0 and 100%' };
    const { exhibitionId, enabled, commissionPercent } = parsed.data;

    const ctx = await requireManager(exhibitionId);
    if ('error' in ctx) return { success: false, error: ctx.error! };
    const { admin, loaded } = ctx;
    // Switching on (or on with nothing listed yet, e.g. shows switched on
    // before works were listed automatically) offers every priced work.
    const turningOn =
      enabled &&
      (!loaded.exhibition.sales_enabled || ![...loaded.listings.values()].some((l) => l.forSale));

    // No payout account is needed up front: the gallery's commission is
    // booked on each sale and paid once it adds payout details in Settings.
    const { error } = await admin
      .from('exhibitions')
      .update({
        sales_enabled: enabled,
        commission_percent: Math.round(commissionPercent * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exhibitionId);
    if (error) {
      console.error('[ExhibitionSales] settings update failed', { exhibitionId, error });
      return { success: false, error: 'Could not save online sales settings' };
    }

    let listedCount = 0;
    if (turningOn) {
      const toList = [...loaded.listings.values()].filter(
        (l) => !l.isSold && !l.nfs && !l.forSale && (l.priceCents ?? 0) > 0,
      );
      for (const l of toList) {
        const { error: listErr } = await admin
          .from('exhibition_artworks')
          .update({ for_sale: true, sale_price_cents: l.priceCents, sale_currency: 'usd' })
          .eq('exhibition_id', exhibitionId)
          .eq('artwork_id', l.saleArtworkId);
        if (listErr) console.error('[ExhibitionSales] listing work failed', { exhibitionId, artworkId: l.artworkId, listErr });
        else listedCount++;
      }
    }

    console.log('[ExhibitionSales] settings saved', { exhibitionId, enabled, commissionPercent, listedCount });
    revalidatePath(`/exhibitions/${exhibitionId}`);
    revalidatePath(`/exhibitions/${exhibitionId}/edit`);
    return { success: true, listedCount };
  } catch (err) {
    console.error('[ExhibitionSales] settings update threw', { input, err });
    return { success: false, error: 'Could not save online sales settings' };
  }
}

const PriceSchema = z.object({
  exhibitionId: z.string().uuid(),
  artworkId: z.string().uuid(),
  priceCents: z.number().int().positive().max(2_000_000_000).nullable(),
  forSale: z.boolean(),
});

/** Set a work's price in this show and whether it can be bought online. */
export async function setExhibitionWorkPrice(input: z.infer<typeof PriceSchema>): Promise<Result> {
  const parsed = PriceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Enter a valid price' };
  const { exhibitionId, artworkId, priceCents, forSale } = parsed.data;
  if (forSale && !priceCents) return { success: false, error: 'Set a price before offering the work for sale' };

  const ctx = await requireManager(exhibitionId);
  if ('error' in ctx) return { success: false, error: ctx.error! };
  const { admin, loaded } = ctx;

  const listing = loaded.listings.get(artworkId);
  if (!listing) return { success: false, error: 'This work is not in the show' };
  if (listing.isSold && forSale) return { success: false, error: 'This work is already sold' };

  // The price sits on the work's link into the show; clear it from any other
  // link for the same work so there is only one price.
  const { error } = await admin
    .from('exhibition_artworks')
    .update({ for_sale: forSale, sale_price_cents: priceCents, sale_currency: 'usd' })
    .eq('exhibition_id', exhibitionId)
    .eq('artwork_id', listing.saleArtworkId);
  if (error) {
    console.error('[ExhibitionSales] price update failed', { exhibitionId, artworkId, error });
    return { success: false, error: 'Could not save the price' };
  }
  const others = listing.relatedArtworkIds.filter((id) => id !== listing.saleArtworkId);
  if (others.length > 0) {
    await admin
      .from('exhibition_artworks')
      .update({ for_sale: false, sale_price_cents: null })
      .eq('exhibition_id', exhibitionId)
      .in('artwork_id', others);
  }

  revalidatePath(`/exhibitions/${exhibitionId}`);
  return { success: true };
}
