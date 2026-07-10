'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import {
  CERTIFICATE_TYPES,
  certificateEligibleForRegistryPhoto,
  GALLERY_REGISTRY_THUMBNAIL_MAX,
  USER_ROLES,
} from '~/lib/user-roles';

type SetRegistryArtworkArgs = {
  artworkId: string;
  mode: 'artist' | 'gallery';
  galleryProfileId?: string;
};

type ActionResult = { success: true } | { success: false; error: string };

async function loadGalleryRegistryArtworkForValidate(
  client: any,
  artworkId: string,
) {
  const { data: artwork, error: artworkError } = await asUntyped(client)
    .from('artworks')
    .select('id, account_id, artist_account_id, gallery_profile_id, status, is_public, certificate_type')
    .eq('id', artworkId)
    .single();

  return { artwork, artworkError };
}

function assertGalleryRegistryArtworkEligible(
  artwork: {
    gallery_profile_id: string | null;
    status: string;
    is_public: boolean;
    certificate_type: string | null;
  },
  galleryProfileId: string,
): ActionResult | null {
  if (artwork.status !== 'verified') {
    return { success: false, error: 'Artwork must be verified' };
  }
  if (!artwork.is_public) {
    return { success: false, error: 'Artwork must be public' };
  }
  if (!certificateEligibleForRegistryPhoto(USER_ROLES.GALLERY, artwork.certificate_type)) {
    return {
      success: false,
      error:
        'Only a verified public Certificate of Show, Ownership, or Authenticity tied to this gallery can be used as the registry photo',
    };
  }
  if (artwork.gallery_profile_id !== galleryProfileId) {
    return {
      success: false,
      error: 'This artwork does not belong to the selected gallery profile',
    };
  }
  return null;
}

/**
 * Pin an artwork as the registry preview thumbnail for the calling user's
 * artist profile, or for a specific gallery profile they manage.
 *
 * The artwork must be verified and public. Artists may pin a COA; galleries may pin
 * a COS, COO, or COA tied to the gallery profile.
 * Gallery mode requires the caller to be an owner/admin of the given gallery profile.
 *
 * For galleries, this replaces the directory pick list with a single certificate
 * (see setGalleryDirectoryCertificates for up to five).
 */
export async function setRegistryArtwork(args: SetRegistryArtworkArgs): Promise<ActionResult> {
  console.log('[Registry] setRegistryArtwork started', {
    artworkId: args.artworkId,
    mode: args.mode,
    galleryProfileId: args.galleryProfileId,
  });

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { artwork, artworkError } = await loadGalleryRegistryArtworkForValidate(
    client,
    args.artworkId,
  );

  if (artworkError || !artwork) {
    console.error('[Registry] setRegistryArtwork artwork not found', artworkError);
    return { success: false, error: 'Artwork not found' };
  }

  if (args.mode === 'gallery') {
    if (!args.galleryProfileId) {
      return { success: false, error: 'Gallery profile ID is required in gallery mode' };
    }

    const canManage = await canManageGallery(user.id, args.galleryProfileId);
    if (!canManage) {
      return { success: false, error: 'You do not have permission to manage this gallery' };
    }

    const galleryErr = assertGalleryRegistryArtworkEligible(artwork, args.galleryProfileId);
    if (galleryErr) return galleryErr;

    const { error: updateError } = await asUntyped(client)
      .from('user_profiles')
      .update({
        registry_artwork_id: args.artworkId,
        registry_artwork_ids: [args.artworkId],
      })
      .eq('id', args.galleryProfileId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[Registry] setRegistryArtwork gallery update failed', updateError);
      return { success: false, error: 'Failed to save registry photo' };
    }
  } else {
    if (artwork.certificate_type !== CERTIFICATE_TYPES.AUTHENTICITY) {
      return { success: false, error: 'Only Certificates of Authenticity can be used as a registry photo' };
    }

    if (artwork.status !== 'verified') {
      return { success: false, error: 'Artwork must be verified' };
    }

    if (!artwork.is_public) {
      return { success: false, error: 'Artwork must be public' };
    }

    const isRelated =
      artwork.account_id === user.id || artwork.artist_account_id === user.id;

    if (!isRelated) {
      return {
        success: false,
        error: 'This artwork is not associated with your artist profile',
      };
    }

    const { data: accountRow } = await client
      .from('accounts')
      .select('name')
      .eq('id', user.id)
      .single();

    const { error: upsertError } = await asUntyped(client)
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
 * Replace the gallery's ordered /registry directory certificate picks (max 5).
 */
export async function setGalleryDirectoryCertificates(args: {
  galleryProfileId: string;
  artworkIds: string[];
}): Promise<ActionResult> {
  console.log('[Registry] setGalleryDirectoryCertificates started', {
    galleryProfileId: args.galleryProfileId,
    count: args.artworkIds.length,
  });

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const canManage = await canManageGallery(user.id, args.galleryProfileId);
  if (!canManage) {
    return { success: false, error: 'You do not have permission to manage this gallery' };
  }

  const seen = new Set<string>();
  const orderedUnique: string[] = [];
  for (const id of args.artworkIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    orderedUnique.push(id);
    if (orderedUnique.length > GALLERY_REGISTRY_THUMBNAIL_MAX) {
      return {
        success: false,
        error: `You can pin at most ${GALLERY_REGISTRY_THUMBNAIL_MAX} certificates for the directory`,
      };
    }
  }

  for (const artworkId of orderedUnique) {
    const { artwork, artworkError } = await loadGalleryRegistryArtworkForValidate(
      client,
      artworkId,
    );
    if (artworkError || !artwork) {
      console.error('[Registry] setGalleryDirectoryCertificates artwork not found', artworkError);
      return { success: false, error: 'One or more artworks were not found' };
    }
    const err = assertGalleryRegistryArtworkEligible(artwork, args.galleryProfileId);
    if (err) return err;
  }

  const primary = orderedUnique[0] ?? null;
  const { error: updateError } = await asUntyped(client)
    .from('user_profiles')
    .update({
      registry_artwork_id: primary,
      registry_artwork_ids: orderedUnique.length > 0 ? orderedUnique : null,
    })
    .eq('id', args.galleryProfileId)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[Registry] setGalleryDirectoryCertificates update failed', updateError);
    return { success: false, error: 'Failed to save directory thumbnails' };
  }

  console.log('[Registry] setGalleryDirectoryCertificates saved', {
    galleryProfileId: args.galleryProfileId,
    picked: orderedUnique.length,
    userId: user.id,
  });

  revalidatePath('/registry');
  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

/**
 * Add or remove one artwork from the gallery's directory certificate list (max 5 when adding).
 */
export async function toggleGalleryDirectoryCertificate(args: {
  galleryProfileId: string;
  artworkId: string;
}): Promise<ActionResult> {
  console.log('[Registry] toggleGalleryDirectoryCertificate started', args);

  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const canManage = await canManageGallery(user.id, args.galleryProfileId);
  if (!canManage) {
    return { success: false, error: 'You do not have permission to manage this gallery' };
  }

  const { data: profileRow, error: profileErr } = await asUntyped(client)
    .from('user_profiles')
    .select('registry_artwork_id, registry_artwork_ids')
    .eq('id', args.galleryProfileId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileErr || !profileRow) {
    console.error('[Registry] toggleGalleryDirectoryCertificate profile load failed', profileErr);
    return { success: false, error: 'Gallery profile not found' };
  }

  const fromArray = (profileRow.registry_artwork_ids as string[] | null) ?? [];
  const current: string[] =
    fromArray.length > 0
      ? [...fromArray]
      : profileRow.registry_artwork_id
        ? [profileRow.registry_artwork_id as string]
        : [];

  const idx = current.indexOf(args.artworkId);
  let next: string[];
  if (idx >= 0) {
    next = current.filter((id) => id !== args.artworkId);
  } else {
    const { artwork, artworkError } = await loadGalleryRegistryArtworkForValidate(
      client,
      args.artworkId,
    );
    if (artworkError || !artwork) {
      return { success: false, error: 'Artwork not found' };
    }
    const err = assertGalleryRegistryArtworkEligible(artwork, args.galleryProfileId);
    if (err) return err;
    if (current.length >= GALLERY_REGISTRY_THUMBNAIL_MAX) {
      return {
        success: false,
        error: `You can pin at most ${GALLERY_REGISTRY_THUMBNAIL_MAX} certificates (clear one first)`,
      };
    }
    next = [...current, args.artworkId];
  }

  const primary = next[0] ?? null;
  const { error: updateError } = await asUntyped(client)
    .from('user_profiles')
    .update({
      registry_artwork_id: primary,
      registry_artwork_ids: next.length > 0 ? next : null,
    })
    .eq('id', args.galleryProfileId)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[Registry] toggleGalleryDirectoryCertificate update failed', updateError);
    return { success: false, error: 'Failed to update directory thumbnails' };
  }

  console.log('[Registry] toggleGalleryDirectoryCertificate done', {
    galleryProfileId: args.galleryProfileId,
    nextCount: next.length,
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

  const client = asUntyped(getSupabaseServerClient());
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

    const { error } = await asUntyped(client)
      .from('user_profiles')
      .update({ registry_artwork_id: null, registry_artwork_ids: null })
      .eq('id', args.galleryProfileId)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Registry] clearRegistryArtwork gallery update failed', error);
      return { success: false, error: 'Failed to clear registry photo' };
    }
  } else {
    const { error } = await asUntyped(client)
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
