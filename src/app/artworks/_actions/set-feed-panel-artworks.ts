'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import {
  CERTIFICATE_TYPES,
  FEED_PANEL_ARTWORK_MAX,
  GALLERY_REGISTRY_THUMBNAIL_CERT_TYPES,
} from '~/lib/user-roles';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Save up to FEED_PANEL_ARTWORK_MAX artwork IDs as the feed panel feature photos
 * for an artist or gallery profile. Passing an empty array clears the selection.
 *
 * Artist mode: caller must own the profile (user_profiles.user_id = caller).
 * Gallery mode: caller must be an owner/admin of the gallery profile.
 */
export async function setFeedPanelArtworks(args: {
  profileId: string;
  artworkIds: string[];
  mode: 'artist' | 'gallery';
}): Promise<ActionResult> {
  console.log('[FeedPanel] setFeedPanelArtworks started', {
    profileId: args.profileId,
    count: args.artworkIds.length,
    mode: args.mode,
  });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Deduplicate and enforce max
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of args.artworkIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  if (ordered.length > FEED_PANEL_ARTWORK_MAX) {
    return {
      success: false,
      error: `You can feature at most ${FEED_PANEL_ARTWORK_MAX} artworks in the feed panel.`,
    };
  }

  // Authorization
  if (args.mode === 'gallery') {
    const canManage = await canManageGallery(user.id, args.profileId);
    if (!canManage) {
      return { success: false, error: 'You do not have permission to manage this gallery' };
    }
  } else {
    // Artist: profile must belong to caller
    const sb = client as any;
    const { data: profileRow, error: profileErr } = await sb
      .from('user_profiles')
      .select('id, user_id, role')
      .eq('id', args.profileId)
      .maybeSingle();

    if (profileErr || !profileRow) {
      console.error('[FeedPanel] profile lookup failed', profileErr);
      return { success: false, error: 'Profile not found' };
    }
    if (profileRow.user_id !== user.id) {
      return { success: false, error: 'You do not have permission to manage this profile' };
    }
  }

  // Validate each artwork
  const sb = client as any;
  for (const artworkId of ordered) {
    const { data: artwork, error: artworkError } = await sb
      .from('artworks')
      .select('id, account_id, artist_account_id, artist_profile_id, gallery_profile_id, status, is_public, certificate_type')
      .eq('id', artworkId)
      .maybeSingle();

    if (artworkError || !artwork) {
      console.error('[FeedPanel] artwork not found', artworkError, artworkId);
      return { success: false, error: 'One or more artworks were not found' };
    }
    if (artwork.status !== 'verified') {
      return { success: false, error: `Artwork "${artworkId}" must be verified` };
    }
    if (!artwork.is_public) {
      return { success: false, error: `Artwork "${artworkId}" must be public` };
    }

    if (args.mode === 'artist') {
      if (artwork.certificate_type !== CERTIFICATE_TYPES.AUTHENTICITY) {
        return { success: false, error: 'Only Certificates of Authenticity can be featured for artists' };
      }
      const isRelated =
        artwork.artist_account_id === user.id ||
        artwork.artist_profile_id === args.profileId ||
        artwork.account_id === user.id;
      if (!isRelated) {
        return { success: false, error: 'One or more artworks are not associated with your artist profile' };
      }
    } else {
      // Gallery: certificate type must be eligible
      if (!(GALLERY_REGISTRY_THUMBNAIL_CERT_TYPES as readonly string[]).includes(artwork.certificate_type)) {
        return {
          success: false,
          error: 'Gallery feed panel artworks must be Certificates of Show, Ownership, or Authenticity',
        };
      }
      // Must be posted by this gallery account or tied to this gallery profile
      const isRelated =
        artwork.account_id === user.id ||
        artwork.gallery_profile_id === args.profileId;
      if (!isRelated) {
        return { success: false, error: 'One or more artworks do not belong to this gallery' };
      }
    }
  }

  // Persist
  const { error: updateError } = await sb
    .from('user_profiles')
    .update({ feed_panel_artwork_ids: ordered.length > 0 ? ordered : null })
    .eq('id', args.profileId);

  if (updateError) {
    console.error('[FeedPanel] setFeedPanelArtworks update failed', updateError);
    return { success: false, error: 'Failed to save feed panel artworks' };
  }

  console.log('[FeedPanel] setFeedPanelArtworks saved', {
    profileId: args.profileId,
    count: ordered.length,
    userId: user.id,
  });

  revalidatePath(`/artists/${user.id}`);

  return { success: true };
}

/**
 * Clear the feed panel artwork selection for a profile.
 */
export async function clearFeedPanelArtworks(args: {
  profileId: string;
  mode: 'artist' | 'gallery';
}): Promise<ActionResult> {
  return setFeedPanelArtworks({ ...args, artworkIds: [] });
}
