'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { createArtworkTransferInvite } from '~/lib/sales/create-transfer-invite';
import { refreshEntityStatsForAccounts } from '~/lib/stats/refresh-entity-stats';
import { logger } from '~/lib/logger';

export interface MarkArtworkSoldInput {
  artworkId: string;
  soldTo?: {
    accountId?: string | null;
    email?: string | null;
    name?: string | null;
  };
  priceCents?: number | null;
  currency?: string | null;
  /** Whether to show the sale price publicly on the certificate. Defaults to false (private). */
  priceIsPublic?: boolean;
  soldAt?: string | null;
  notes?: string | null;
  soldByDisplay?: string | null;
  metadata?: Record<string, any>;
}

export interface MarkArtworkSoldResult {
  success: boolean;
  error?: string;
  saleId?: string;
  inviteToken?: string | null;
}

export async function markArtworkSold(
  input: MarkArtworkSoldInput,
): Promise<MarkArtworkSoldResult> {
  console.log('[Sales] markArtworkSold started', {
    artworkId: input.artworkId,
    hasBuyerAccount: !!input.soldTo?.accountId,
    hasEmail: !!input.soldTo?.email,
  });

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'You must be signed in to mark an artwork as sold' };
    }

    const { data: artwork, error: fetchError } = await (client as any)
      .from('artworks')
      .select('id, account_id, gallery_profile_id, title, sold_by')
      .eq('id', input.artworkId)
      .single();

    if (fetchError || !artwork) {
      return { success: false, error: 'Artwork not found' };
    }

    const canEdit = await canEditGalleryArtworks(user.id, {
      account_id: artwork.account_id,
      gallery_profile_id: artwork.gallery_profile_id ?? undefined,
    });
    if (!canEdit) {
      return { success: false, error: 'You do not have permission to mark this artwork as sold' };
    }

    const soldAt = input.soldAt ?? new Date().toISOString();
    const currency = (input.currency ?? 'USD').toUpperCase();
    const priceCents =
      typeof input.priceCents === 'number' && Number.isFinite(input.priceCents)
        ? Math.round(input.priceCents)
        : null;

    const buyerAccountId = input.soldTo?.accountId?.trim() || null;
    const buyerEmail = input.soldTo?.email?.trim().toLowerCase() || null;
    const buyerName = input.soldTo?.name?.trim() || null;
    const priceIsPublic = input.priceIsPublic ?? false;

    const admin = getSupabaseServerAdminClient();

    // Auto-stamp sold_by from the gallery profile name when it isn't already set
    let soldByDisplay = input.soldByDisplay?.trim() || null;
    if (!soldByDisplay && !artwork.sold_by && artwork.gallery_profile_id) {
      try {
        const { data: galleryProfile } = await (admin as any)
          .from('user_profiles')
          .select('name')
          .eq('id', artwork.gallery_profile_id)
          .maybeSingle();
        if (galleryProfile?.name) {
          soldByDisplay = galleryProfile.name as string;
        }
      } catch (gpErr) {
        console.error('[Sales] markArtworkSold gallery profile lookup failed', gpErr);
      }
    }

    const { error: updateError } = await (admin as any)
      .from('artworks')
      .update({
        is_sold: true,
        sold_by_account_id: artwork.account_id,
        sold_to_account_id: buyerAccountId,
        sold_to_email: buyerEmail,
        sold_to_name: buyerName,
        sold_price_cents: priceCents,
        sold_currency: currency,
        sold_price_is_public: priceIsPublic,
        sold_at: soldAt,
        ...(soldByDisplay ? { sold_by: soldByDisplay } : {}),
        updated_by: user.id,
      })
      .eq('id', input.artworkId);

    if (updateError) {
      console.error('[Sales] markArtworkSold update artworks failed', updateError);
      logger.error('mark_artwork_sold_update_failed', {
        artworkId: input.artworkId,
        error: updateError,
      });
      return { success: false, error: updateError.message || 'Failed to mark artwork as sold' };
    }

    let saleId: string | undefined;
    try {
      const { data: sale, error: saleError } = await (admin as any)
        .from('sales_ledger')
        .insert({
          artwork_id: input.artworkId,
          sold_by_account_id: artwork.account_id,
          sold_to_account_id: buyerAccountId,
          sold_to_email: buyerEmail,
          sold_to_name: buyerName,
          price_cents: priceCents,
          price_is_public: priceIsPublic,
          currency,
          sold_at: soldAt,
          recorded_by: user.id,
          notes: input.notes ?? null,
          metadata: input.metadata ?? {},
        })
        .select('id')
        .single();

      if (saleError) {
        console.error('[Sales] markArtworkSold sales_ledger insert failed', saleError);
        logger.error('mark_artwork_sold_ledger_failed', {
          artworkId: input.artworkId,
          error: saleError,
        });
      } else if (sale?.id) {
        saleId = sale.id as string;
      }
    } catch (ledgerErr) {
      console.error('[Sales] markArtworkSold sales_ledger exception', ledgerErr);
      logger.error('mark_artwork_sold_ledger_exception', {
        artworkId: input.artworkId,
        error: ledgerErr,
      });
    }

    try {
      const { error: eventError } = await (admin as any)
        .from('provenance_events')
        .insert({
          artwork_id: input.artworkId,
          event_type: 'sale',
          actor_account_id: user.id,
          event_date: soldAt,
          metadata: {
            source: 'mark_artwork_sold',
            sold_by_display: soldByDisplay ?? null,
            sold_by_account_id: artwork.account_id,
            sold_to_account_id: buyerAccountId,
            sold_to_email: buyerEmail,
            sold_to_name: buyerName,
            price_cents: priceCents,
            currency,
            sale_id: saleId ?? null,
          },
        });
      if (eventError) {
        console.error('[Sales] markArtworkSold provenance_event insert failed', eventError);
        logger.error('mark_artwork_sold_event_failed', {
          artworkId: input.artworkId,
          error: eventError,
        });
      }
    } catch (eventErr) {
      console.error('[Sales] markArtworkSold provenance_event exception', eventErr);
      logger.error('mark_artwork_sold_event_exception', {
        artworkId: input.artworkId,
        error: eventErr,
      });
    }

    let inviteToken: string | null = null;
    if (buyerAccountId || buyerEmail) {
      try {
        const inviteResult = await createArtworkTransferInvite({
          artworkId: input.artworkId,
          sellerUserId: user.id,
          buyerEmail,
          buyerAccountId,
          workTitle: (artwork.title as string) || 'Untitled',
        });
        inviteToken = inviteResult.token ?? null;
      } catch (inviteErr) {
        console.error('[Sales] markArtworkSold createArtworkTransferInvite failed', inviteErr);
        logger.error('mark_artwork_sold_invite_failed', {
          artworkId: input.artworkId,
          error: inviteErr,
        });
      }
    }

    try {
      await refreshEntityStatsForAccounts(
        [artwork.account_id, buyerAccountId].filter(
          (v): v is string => typeof v === 'string' && v.length > 0,
        ),
      );
    } catch (statsErr) {
      console.error('[Sales] markArtworkSold refreshEntityStatsForAccounts failed', statsErr);
      logger.error('mark_artwork_sold_stats_refresh_failed', {
        artworkId: input.artworkId,
        error: statsErr,
      });
    }

    revalidatePath(`/artworks/${input.artworkId}`);
    revalidatePath(`/artworks/${input.artworkId}/certificate`);
    revalidatePath('/artworks');
    revalidatePath('/artworks/my');
    revalidatePath('/portal');
    revalidatePath('/portal/sales');

    console.log('[Sales] markArtworkSold completed', {
      artworkId: input.artworkId,
      saleId,
      inviteSent: !!inviteToken,
    });

    return { success: true, saleId, inviteToken };
  } catch (error) {
    console.error('[Sales] markArtworkSold failed', error);
    logger.error('mark_artwork_sold_failed', {
      artworkId: input.artworkId,
      error,
    });
    return { success: false, error: (error as Error).message || 'Failed to mark artwork as sold' };
  }
}
