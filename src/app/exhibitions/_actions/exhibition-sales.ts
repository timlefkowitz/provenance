'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { commissionPercentOf } from '~/lib/exhibition-sales/listings';
import { loadExhibitionListings } from '~/lib/exhibition-sales/load-listings';
import { ensurePayoutAccount } from '~/lib/payouts/seller-payouts';
import { asUntyped } from '~/lib/supabase-untyped';

type Result = { success: true } | { success: false; error: string };

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
      isSold: l.isSold,
    })),
  };
}

const SettingsSchema = z.object({
  exhibitionId: z.string().uuid(),
  enabled: z.boolean(),
  commissionPercent: z.number().min(0).max(100),
});

/** Switch online selling on or off for a show and set the gallery's commission. */
export async function updateExhibitionSalesSettings(input: z.infer<typeof SettingsSchema>): Promise<Result> {
  const parsed = SettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Commission must be between 0 and 100%' };
  const { exhibitionId, enabled, commissionPercent } = parsed.data;

  const ctx = await requireManager(exhibitionId);
  if ('error' in ctx) return { success: false, error: ctx.error! };
  const { admin, loaded } = ctx;

  // The gallery is paid its commission, so it needs a payout account (created
  // silently; payout details are added later in Settings → Shop).
  if (enabled && commissionPercent > 0) {
    const { data: galleryAccount } = await admin
      .from('accounts')
      .select('email')
      .eq('id', loaded.exhibition.gallery_id)
      .maybeSingle();
    const payout = await ensurePayoutAccount(
      loaded.exhibition.gallery_id,
      (galleryAccount?.email as string | null) ?? null,
    );
    if (!payout.ok) return { success: false, error: payout.error };
  }

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
  console.log('[ExhibitionSales] settings saved', { exhibitionId, enabled, commissionPercent });
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/exhibitions/${exhibitionId}/edit`);
  return { success: true };
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
