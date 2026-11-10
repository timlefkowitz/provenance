'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { canSellArtwork } from '~/lib/sales/can-sell-artwork';
import { createArtworkTransferInvite } from '~/lib/sales/create-transfer-invite';
import { captureCrmContacts } from '~/lib/crm/capture-contact';
import { recordSale } from '~/lib/sales/record-sale';
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
  soldAt?: string | null;
  notes?: string | null;
  soldByDisplay?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MarkArtworkSoldResult {
  success: boolean;
  error?: string;
  saleId?: string;
  inviteToken?: string | null;
  /** Why the Certificate of Ownership wasn't sent (rate limit, open invite...). */
  inviteErrors?: string[];
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

    const admin = getSupabaseServerAdminClient();
    // Admin read: RLS hides gallery-held certificates from team members.
    const { data: artwork, error: fetchError } = await asUntyped(admin)
      .from('artworks')
      .select('id, account_id, gallery_profile_id, title')
      .eq('id', input.artworkId)
      .single();

    if (fetchError || !artwork) {
      return { success: false, error: 'Artwork not found' };
    }

    // Holder, their gallery / institution team, or a manager of a show that hung the work.
    if (!(await canSellArtwork(user.id, artwork))) {
      return { success: false, error: 'You do not have permission to mark this artwork as sold' };
    }


    const sale = await recordSale(admin, {
      artworkId: input.artworkId,
      buyer: input.soldTo,
      priceCents: input.priceCents,
      currency: input.currency,
      soldAt: input.soldAt,
      notes: input.notes,
      soldByDisplay: input.soldByDisplay,
      recordedBy: user.id,
      metadata: { source: 'mark_artwork_sold', ...(input.metadata ?? {}) },
    });

    if (!sale.success) {
      return { success: false, error: sale.error || 'Failed to mark artwork as sold' };
    }

    const saleId = sale.saleId;
    const buyerAccountId = sale.buyerAccountId ?? null;
    const buyerEmail = sale.buyerEmail ?? null;
    const buyerName = sale.buyerName ?? null;

    let inviteToken: string | null = null;
    let inviteErrors: string[] = [];
    if (buyerAccountId || buyerEmail) {
      try {
        const inviteResult = await createArtworkTransferInvite({
          artworkId: input.artworkId,
          sellerUserId: user.id,
          sellerAccountId: artwork.account_id as string,
          buyerEmail,
          buyerAccountId,
          buyerName,
          workTitle: (artwork.title as string) || 'Untitled',
        });
        inviteToken = inviteResult.token ?? null;
        inviteErrors = inviteResult.errors;
      } catch (inviteErr) {
        console.error('[Sales] markArtworkSold createArtworkTransferInvite failed', inviteErr);
        logger.error('mark_artwork_sold_invite_failed', {
          artworkId: input.artworkId,
          error: inviteErr,
        });
      }
    }

    if (buyerName || buyerEmail) {
      await captureCrmContacts(user.id, [
        {
          name: buyerName,
          email: buyerEmail,
          source: 'sale',
          artworkId: input.artworkId,
          notes: `Marked sold — ${(artwork.title as string) || 'Untitled'}`,
        },
      ]);
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

    return { success: true, saleId, inviteToken, inviteErrors };
  } catch (error) {
    console.error('[Sales] markArtworkSold failed', error);
    logger.error('mark_artwork_sold_failed', {
      artworkId: input.artworkId,
      error,
    });
    return { success: false, error: (error as Error).message || 'Failed to mark artwork as sold' };
  }
}
