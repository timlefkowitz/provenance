'use server';

/* eslint-disable @typescript-eslint/no-explicit-any -- artworks/exhibitions RLS queries use loosely typed Supabase rows */

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { generateCertificateNumber } from '~/lib/certificate-claims/insert-linked-certificate';
import {
  CERTIFICATE_TYPES,
  USER_ROLES,
  getInitialCertificateStatus,
  posterRequiresArtistClaim,
} from '~/lib/user-roles';
import { ensureArtistProfileForCertificate } from '~/app/artworks/_actions/ensure-artist-profile-for-certificate';
import {
  canAttachGalleryProfile,
  getExhibitionPosterContext,
} from './gallery-posting-context';
import { isEligibleForShowCertificate } from '../_helpers/gallery-posting-helpers';

/**
 * Credits the artist on the show and, while the certificate still needs their
 * claim, sends the claim request (the notification's Claim button issues
 * their linked Certificate of Authenticity).
 */
async function notifyCreditedArtist(params: {
  exhibitionId: string;
  artworkId: string;
  title: string;
  artistAccountId: string;
  galleryAccountId: string;
  certificateNumber: string | null;
  artistName: string;
  requestClaim: boolean;
}): Promise<void> {
  const adminClient = asUntyped(getSupabaseServerAdminClient());

  const { error: creditError } = await adminClient.from('exhibition_artists').insert({
    exhibition_id: params.exhibitionId,
    artist_account_id: params.artistAccountId,
  });
  if (creditError && creditError.code !== '23505') {
    console.error('[Exhibitions] publishExhibitionListing artist credit failed', creditError);
  }

  if (!params.requestClaim) return;

  const { data: gallery } = await adminClient
    .from('accounts')
    .select('name')
    .eq('id', params.galleryAccountId)
    .maybeSingle();

  try {
    await createNotification({
      userId: params.artistAccountId,
      type: 'certificate_claim_request',
      title: `Certificate Claim Request: ${params.title}`,
      message: `${(gallery?.name as string | null) || 'A gallery'} has posted an artwork "${params.title}" and is requesting you to claim the certificate.`,
      artworkId: params.artworkId,
      relatedUserId: params.galleryAccountId,
      metadata: {
        certificateNumber: params.certificateNumber,
        artistName: params.artistName,
        exhibition_id: params.exhibitionId,
      },
    });
  } catch (notifError) {
    console.error('[Exhibitions] publishExhibitionListing artist notification failed', notifError);
  }
}

export type PublishExhibitionListingResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Turns a draft exhibition listing into a public verified Certificate of Show row
 * when the poster meets the same rules as createArtworksBatch for galleries.
 */
export async function publishExhibitionListing(params: {
  exhibitionId: string;
  artworkId: string;
}): Promise<PublishExhibitionListingResult> {
  const { exhibitionId, artworkId } = params;

  console.log('[Exhibitions] publishExhibitionListing started', { exhibitionId, artworkId });

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Exhibitions] publishExhibitionListing: not authenticated');
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: exhibition, error: exErr } = await asUntyped(client)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (exErr || !exhibition || exhibition.gallery_id !== user.id) {
    console.error('[Exhibitions] publishExhibitionListing: exhibition access denied', exErr);
    return { success: false, error: 'Exhibition not found or access denied.' };
  }

  const { data: link, error: linkErr } = await asUntyped(client)
    .from('exhibition_artworks')
    .select('artwork_id')
    .eq('exhibition_id', exhibitionId)
    .eq('artwork_id', artworkId)
    .maybeSingle();

  if (linkErr || !link) {
    console.error('[Exhibitions] publishExhibitionListing: artwork not in exhibition', linkErr);
    return { success: false, error: 'This artwork is not part of this exhibition.' };
  }

  const { data: artwork, error: artErr } = await asUntyped(client)
    .from('artworks')
    .select(
      'id, account_id, title, image_url, status, certificate_number, certificate_status, claimed_by_artist_at, gallery_profile_id, artist_name, artist_account_id, artist_profile_id',
    )
    .eq('id', artworkId)
    .maybeSingle();

  if (artErr || !artwork) {
    console.error('[Exhibitions] publishExhibitionListing: artwork not found', artErr);
    return { success: false, error: 'Artwork not found.' };
  }

  if (artwork.account_id !== user.id) {
    return { success: false, error: 'You can only publish listings you created.' };
  }

  if (artwork.status !== 'draft') {
    return { success: false, error: 'Only draft listings can be published from here.' };
  }

  const title = (artwork.title as string)?.trim?.() ?? '';
  if (!title) {
    return { success: false, error: 'Add a title before publishing.' };
  }

  const imageUrl = artwork.image_url as string | null;
  if (!imageUrl || !String(imageUrl).trim()) {
    return { success: false, error: 'Add a photo before publishing.' };
  }

  const posterContext = await getExhibitionPosterContext(user.id);
  if (
    posterContext.userRole !== USER_ROLES.GALLERY &&
    posterContext.userRole !== USER_ROLES.INSTITUTION
  ) {
    return {
      success: false,
      error: 'Publishing show listings requires a gallery or institution account.',
    };
  }

  if (!isEligibleForShowCertificate(posterContext)) {
    return { success: false, error: 'Could not resolve certificate type for your account.' };
  }

  let galleryProfileId: string | null =
    (artwork.gallery_profile_id as string | null) || posterContext.galleryProfileId;

  if (galleryProfileId) {
    const ok = await canAttachGalleryProfile(user.id, galleryProfileId);
    if (!ok) {
      galleryProfileId = posterContext.galleryProfileId;
    }
  }

  let certificateNumber = artwork.certificate_number as string | null;
  if (!certificateNumber?.trim()) {
    try {
      certificateNumber = await generateCertificateNumber(client);
    } catch (e) {
      console.error('[Exhibitions] publishExhibitionListing: cert number generation failed', e);
      return { success: false, error: 'Could not assign a certificate number. Try again.' };
    }
  }

  let artistAccountId = (artwork.artist_account_id as string | null) ?? null;
  let artistProfileId = (artwork.artist_profile_id as string | null) ?? null;
  const artistNameRaw = ((artwork.artist_name as string) || '').trim();

  // An artist who already claimed this work keeps it verified.
  const alreadyClaimed =
    Boolean(artwork.claimed_by_artist_at) && artwork.certificate_status === 'verified';
  const certificateStatus = alreadyClaimed
    ? 'verified'
    : getInitialCertificateStatus(posterContext.userRole);
  if (!alreadyClaimed && posterRequiresArtistClaim(posterContext.userRole)) {
    if (artistNameRaw) {
      const ensured = await ensureArtistProfileForCertificate({
        artistName: artistNameRaw,
        posterAccountId: user.id,
        medium: '',
        posterRole: posterContext.userRole,
      });
      artistAccountId = ensured.artistAccountId ?? artistAccountId;
      artistProfileId = ensured.artistProfileId ?? artistProfileId;
    }
  }

  const updatePayload: Record<string, unknown> = {
    status: 'verified',
    is_public: true,
    certificate_type: CERTIFICATE_TYPES.SHOW,
    certificate_number: certificateNumber,
    certificate_status: certificateStatus,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
    artist_account_id: artistAccountId,
    artist_profile_id: artistProfileId,
  };

  if (galleryProfileId) {
    updatePayload.gallery_profile_id = galleryProfileId;
  }

  const { error: upErr } = await asUntyped(client)
    .from('artworks')
    .update(updatePayload)
    .eq('id', artworkId)
    .eq('account_id', user.id)
    .eq('status', 'draft');

  if (upErr) {
    console.error('[Exhibitions] publishExhibitionListing: update failed', upErr);
    return { success: false, error: upErr.message || 'Failed to publish listing.' };
  }

  console.log('[Exhibitions] publishExhibitionListing success', { artworkId });

  if (artistAccountId && artistAccountId !== user.id) {
    await notifyCreditedArtist({
      exhibitionId,
      artworkId,
      title,
      artistAccountId,
      galleryAccountId: user.id,
      certificateNumber,
      artistName: artistNameRaw,
      requestClaim: certificateStatus === 'pending_artist_claim',
    });
    revalidatePath(`/artists/${artistAccountId}`);
  }

  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/artworks/${artworkId}`);
  revalidatePath(`/artworks/${artworkId}/certificate`);
  revalidatePath('/artworks');
  revalidatePath('/artworks/my');

  return { success: true };
}
