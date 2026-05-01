'use server';

/* eslint-disable @typescript-eslint/no-explicit-any -- artworks/exhibitions RLS queries use loosely typed Supabase rows */

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { artworkImageUploader } from '~/lib/artwork-storage';
import { CERTIFICATE_TYPES } from '~/lib/user-roles';
import { ensureArtistProfileForCertificate } from '~/app/artworks/_actions/ensure-artist-profile-for-certificate';
import {
  canAttachGalleryProfile,
  getExhibitionPosterContext,
} from './gallery-posting-context';
import { isEligibleForShowCertificate } from '../_helpers/gallery-posting-helpers';

/** Client sends `items` JSON; optional `image_<key>` files in the same FormData. */
export type QuickExhibitionListingInput = {
  key: string;
  title: string;
  artistName?: string;
  price?: string;
  dimensions?: string;
};

/**
 * Creates draft artwork rows for the exhibition host and links them to the exhibition.
 * Sets Certificate of Show fields (certificate_type, gallery_profile_id) when the poster is eligible.
 */
export async function createQuickExhibitionListings(
  formData: FormData,
): Promise<{ success: true; created: number } | { success: false; error: string }> {
  const exhibitionId = (formData.get('exhibitionId') as string)?.trim();
  const itemsRaw = formData.get('items') as string | null;

  console.log('[Exhibitions] createQuickExhibitionListings started', {
    exhibitionId,
    hasItems: Boolean(itemsRaw),
  });

  if (!exhibitionId) {
    return { success: false, error: 'Missing exhibition.' };
  }

  let items: QuickExhibitionListingInput[] = [];
  try {
    items = itemsRaw ? (JSON.parse(itemsRaw) as QuickExhibitionListingInput[]) : [];
    if (!Array.isArray(items)) {
      return { success: false, error: 'Invalid listing payload.' };
    }
  } catch {
    return { success: false, error: 'Invalid listing data.' };
  }

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.error('[Exhibitions] createQuickExhibitionListings: not authenticated');
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: exhibition, error: exErr } = await (client as any)
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (exErr || !exhibition || exhibition.gallery_id !== user.id) {
    console.error('[Exhibitions] createQuickExhibitionListings: exhibition access denied', exErr);
    return { success: false, error: 'Exhibition not found or access denied.' };
  }

  const cleaned = items
    .map((i) => ({
      key: (i.key ?? '').trim(),
      title: (i.title ?? '').trim(),
      artistName: (i.artistName ?? '').trim(),
      price: (i.price ?? '').trim() || null,
      dimensions: (i.dimensions ?? '').trim().slice(0, 100) || null,
    }))
    .filter((i) => i.title.length > 0);

  if (cleaned.length === 0) {
    return { success: false, error: 'Add at least one artwork with a title.' };
  }

  const { data: accountRow } = await client.from('accounts').select('id').eq('id', user.id).maybeSingle();
  if (!accountRow) {
    const { error: acErr } = await client.from('accounts').insert({
      id: user.id,
      name: 'User',
      email: null,
    });
    if (acErr) {
      console.error('[Exhibitions] createQuickExhibitionListings: could not ensure account', acErr);
      return { success: false, error: 'Account setup required. Complete your profile first.' };
    }
  }

  const posterContext = await getExhibitionPosterContext(user.id);
  let galleryProfileId: string | null = null;
  if (
    posterContext.galleryProfileId &&
    (await canAttachGalleryProfile(user.id, posterContext.galleryProfileId))
  ) {
    galleryProfileId = posterContext.galleryProfileId;
  }

  const certificateType = isEligibleForShowCertificate(posterContext)
    ? CERTIFICATE_TYPES.SHOW
    : posterContext.certificateType;

  const adminClient = getSupabaseServerAdminClient();
  let created = 0;

  for (const row of cleaned) {
    const metadata: Record<string, unknown> = {};
    if (row.price) metadata.exhibition_list_price = row.price;

    let imageUrl: string | null = null;
    const fileKey = row.key ? `image_${row.key}` : null;
    const imageFile = fileKey ? (formData.get(fileKey) as File | null) : null;
    if (imageFile && typeof imageFile === 'object' && imageFile.size > 0) {
      try {
        imageUrl = await artworkImageUploader.upload(client, adminClient, imageFile, user.id);
      } catch (uploadErr) {
        console.error('[Exhibitions] createQuickExhibitionListings: image upload failed', uploadErr);
        return {
          success: false,
          error: `Image upload failed for "${row.title}". Try a smaller file or another image.`,
        };
      }
    }

    let artistAccountId: string | null = null;
    let artistProfileId: string | null = null;
    if (row.artistName && posterContext.userRole) {
      const ensured = await ensureArtistProfileForCertificate({
        artistName: row.artistName,
        posterAccountId: user.id,
        medium: '',
        posterRole: posterContext.userRole,
      });
      artistAccountId = ensured.artistAccountId;
      artistProfileId = ensured.artistProfileId;
    }

    const insertPayload: Record<string, unknown> = {
      account_id: user.id,
      title: row.title,
      dimensions: row.dimensions,
      description: null,
      status: 'draft',
      image_url: imageUrl,
      artist_name: row.artistName || null,
      artist_account_id: artistAccountId,
      artist_profile_id: artistProfileId,
      certificate_type: certificateType,
      metadata: Object.keys(metadata).length ? metadata : {},
      created_by: user.id,
      updated_by: user.id,
    };

    if (galleryProfileId) {
      insertPayload.gallery_profile_id = galleryProfileId;
    }

    const { data: inserted, error: insErr } = await (client as any)
      .from('artworks')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insErr || !inserted?.id) {
      console.error('[Exhibitions] createQuickExhibitionListings: artwork insert failed', insErr);
      continue;
    }

    const { error: linkErr } = await (client as any).from('exhibition_artworks').insert({
      exhibition_id: exhibitionId,
      artwork_id: inserted.id,
    });

    if (linkErr) {
      if (linkErr.code !== '23505') {
        console.error('[Exhibitions] createQuickExhibitionListings: link failed', linkErr);
      }
      continue;
    }

    created += 1;
  }

  if (created === 0) {
    return { success: false, error: 'Could not save listings. Try again.' };
  }

  console.log('[Exhibitions] createQuickExhibitionListings success', { created });
  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);

  return { success: true, created };
}
