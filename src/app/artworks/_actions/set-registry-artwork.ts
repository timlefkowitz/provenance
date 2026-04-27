'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';

type SetRegistryArtworkArgs = {
  artworkId: string;
  mode: 'artist' | 'gallery';
  galleryProfileId?: string;
};

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Pin an artwork as the registry preview thumbnail for the calling user's
 * artist profile, or for a specific gallery profile they manage.
 *
 * The artwork must be verified, public, and have certificate_type='authenticity'.
 * Gallery mode requires the caller to be an owner/admin of the given gallery profile.
 */
export async function setRegistryArtwork(args: SetRegistryArtworkArgs): Promise<ActionResult> {
  console.log('[Registry] setRegistryArtwork started', {
    artworkId: args.artworkId,
    mode: args.mode,
    galleryProfileId: args.galleryProfileId,
  });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Validate the artwork: must be a verified, public COA
  const { data: artwork, error: artworkError } = await (client as any)
    .from('artworks')
    .select('id, account_id, artist_account_id, gallery_profile_id, status, is_public, certificate_type')
    .eq('id', args.artworkId)
    .single();

  if (artworkError || !artwork) {
    console.error('[Registry] setRegistryArtwork artwork not found', artworkError);
    return { success: false, error: 'Artwork not found' };
  }

  if (artwork.status !== 'verified') {
    return { success: false, error: 'Artwork must be verified' };
  }

  if (!artwork.is_public) {
    return { success: false, error: 'Artwork must be public' };
  }

  if (artwork.certificate_type !== 'authenticity') {
    return { success: false, error: 'Only Certificates of Authenticity can be used as a registry photo' };
  }

  if (args.mode === 'gallery') {
    if (!args.galleryProfileId) {
      return { success: false, error: 'Gallery profile ID is required in gallery mode' };
    }

    const canManage = await canManageGallery(user.id, args.galleryProfileId);
    if (!canManage) {
      return { success: false, error: 'You do not have permission to manage this gallery' };
    }

    if (artwork.gallery_profile_id !== args.galleryProfileId) {
      return {
        success: false,
        error: 'This artwork does not belong to the selected gallery profile',
      };
    }

    // Update the gallery user_profile row
    const { error: updateError } = await (client as any)
      .from('user_profiles')
      .update({ registry_artwork_id: args.artworkId })
      .eq('id', args.galleryProfileId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[Registry] setRegistryArtwork gallery update failed', updateError);
      return { success: false, error: 'Failed to save registry photo' };
    }
  } else {
    // Artist mode: the artwork must be owned or credited to this user
    const isRelated =
      artwork.account_id === user.id || artwork.artist_account_id === user.id;

    if (!isRelated) {
      return {
        success: false,
        error: 'This artwork is not associated with your artist profile',
      };
    }

    // Upsert the artist profile row (creates it if it doesn't exist)
    const { data: accountRow } = await client
      .from('accounts')
      .select('name')
      .eq('id', user.id)
      .single();

    const { error: upsertError } = await (client as any)
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          role: 'artist',
          name: accountRow?.name ?? user.email ?? 'Artist',
          is_active: true,
          registry_artwork_id: args.artworkId,
        },
        { onConflict: 'user_id,role' },
      );

    if (upsertError) {
      console.error('[Registry] setRegistryArtwork artist upsert failed', upsertError);
      return { success: false, error: 'Failed to save registry photo' };
    }
  }

  console.log('[Registry] setRegistryArtwork saved', {
    artworkId: args.artworkId,
    mode: args.mode,
    galleryProfileId: args.galleryProfileId,
    userId: user.id,
  });

  revalidatePath('/registry');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

/**
 * Clear the registry preview thumbnail selection for the calling user's
 * artist profile or the specified gallery profile.
 */
export async function clearRegistryArtwork(args: {
  mode: 'artist' | 'gallery';
  galleryProfileId?: string;
}): Promise<ActionResult> {
  console.log('[Registry] clearRegistryArtwork started', args);

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  if (args.mode === 'gallery') {
    if (!args.galleryProfileId) {
      return { success: false, error: 'Gallery profile ID is required' };
    }

    const canManage = await canManageGallery(user.id, args.galleryProfileId);
    if (!canManage) {
      return { success: false, error: 'You do not have permission to manage this gallery' };
    }

    const { error } = await (client as any)
      .from('user_profiles')
      .update({ registry_artwork_id: null })
      .eq('id', args.galleryProfileId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Registry] clearRegistryArtwork gallery update failed', error);
      return { success: false, error: 'Failed to clear registry photo' };
    }
  } else {
    const { error } = await (client as any)
      .from('user_profiles')
      .update({ registry_artwork_id: null })
      .eq('user_id', user.id)
      .eq('role', 'artist');

    if (error) {
      console.error('[Registry] clearRegistryArtwork artist update failed', error);
      return { success: false, error: 'Failed to clear registry photo' };
    }
  }

  console.log('[Registry] clearRegistryArtwork done', { mode: args.mode, userId: user.id });

  revalidatePath('/registry');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}
