'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { markArtworkSold } from '~/app/artworks/[id]/_actions/mark-artwork-sold';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { logger } from '~/lib/logger';
import { asUntyped } from '~/lib/supabase-untyped';

export interface SellExhibitionWorkInput {
  exhibitionId: string;
  artworkId: string;
  buyerEmail: string;
  buyerName?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  /** YYYY-MM-DD; defaults to today. */
  soldOn?: string | null;
}

export type SellExhibitionWorkResult =
  | { success: true; certificateSent: boolean; inviteError?: string }
  | { success: false; error: string };

/**
 * A curator marks a work in their show as sold and sends the buyer a
 * Certificate of Ownership to claim. The work must be in the show and its
 * certificate (usually the show's Certificate of Show) held by the curator's
 * side; markArtworkSold re-checks that. The artist behind a Certificate of
 * Show is told the work sold, and what it did to its Provenance Value.
 */
export async function sellExhibitionWork(
  input: SellExhibitionWorkInput,
): Promise<SellExhibitionWorkResult> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { success: false, error: 'You must be signed in' };

    const buyerEmail = normalizeInviteEmail(input.buyerEmail);
    if (!buyerEmail || !buyerEmail.includes('@')) {
      return {
        success: false,
        error: "Enter the buyer's email to send their certificate",
      };
    }

    const admin = asUntyped(getSupabaseServerAdminClient());
    const { data: exhibition } = await admin
      .from('exhibitions')
      .select('id, title, gallery_id')
      .eq('id', input.exhibitionId)
      .maybeSingle();
    if (!exhibition) return { success: false, error: 'Exhibition not found' };
    if (
      !(await canManageExhibition(user.id, exhibition.gallery_id as string))
    ) {
      return {
        success: false,
        error: 'Only the curator can record a sale for this show',
      };
    }

    const { data: link } = await admin
      .from('exhibition_artworks')
      .select('artwork_id')
      .eq('exhibition_id', input.exhibitionId)
      .eq('artwork_id', input.artworkId)
      .limit(1)
      .maybeSingle();
    if (!link) return { success: false, error: 'This work is not in the show' };

    const { data: artwork } = await admin
      .from('artworks')
      .select('id, title, account_id, artist_account_id, is_sold')
      .eq('id', input.artworkId)
      .maybeSingle();
    if (!artwork) return { success: false, error: 'Artwork not found' };
    if (artwork.is_sold)
      return { success: false, error: 'This work is already marked sold' };

    const soldAt = input.soldOn
      ? new Date(`${input.soldOn}T12:00:00`).toISOString()
      : new Date().toISOString();
    const buyerName = input.buyerName?.trim() || null;

    const result = await markArtworkSold({
      artworkId: input.artworkId,
      soldTo: { email: buyerEmail, name: buyerName },
      priceCents: input.priceCents ?? null,
      currency: input.currency ?? 'USD',
      soldAt,
      metadata: {
        source: 'exhibition_curate',
        exhibition_id: input.exhibitionId,
      },
    });
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Could not mark the work sold',
      };
    }

    // recordSale tells the artist (with the show's name and the work's new
    // Provenance Value) via metadata.exhibition_id.

    revalidatePath(`/exhibitions/${input.exhibitionId}/curate`);
    revalidatePath(`/exhibitions/${input.exhibitionId}`);

    return {
      success: true,
      certificateSent: Boolean(result.inviteToken),
      inviteError: result.inviteErrors?.[0],
    };
  } catch (err) {
    logger.error('sell_exhibition_work_failed', {
      exhibitionId: input.exhibitionId,
      artworkId: input.artworkId,
      error: err,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not record the sale',
    };
  }
}
