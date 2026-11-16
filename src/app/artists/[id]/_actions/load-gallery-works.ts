'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { ArtworkCardArtwork } from '~/app/artworks/_components/artwork-card';
import { asUntyped } from '~/lib/supabase-untyped';

import { GALLERY_WORKS_PAGE_SIZE } from '../_components/gallery-works-page-size';


const GALLERY_WORK_COLUMNS =
  'id, title, artist_name, image_url, created_at, certificate_number, account_id, is_public, status';

/**
 * One page of a gallery / institution profile's Certificates of Show, newest
 * first. Private works are included only for the profile's owner.
 */
export async function loadGalleryWorks(
  galleryProfileId: string,
  offset: number,
): Promise<{ artworks: ArtworkCardArtwork[]; error?: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  const { data: profile } = await client
    .from('user_profiles')
    .select('user_id')
    .eq('id', galleryProfileId)
    .maybeSingle();
  if (!profile) return { artworks: [], error: 'Profile not found' };

  const isOwner = Boolean(user && profile.user_id === user.id);
  const start = Math.max(0, Math.floor(offset));

  let query = client
    .from('artworks')
    .select(GALLERY_WORK_COLUMNS)
    .eq('certificate_type', 'show')
    .eq('gallery_profile_id', galleryProfileId)
    .eq('status', 'verified')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + GALLERY_WORKS_PAGE_SIZE - 1);
  if (!isOwner) query = query.eq('is_public', true);

  const { data, error } = await query;
  if (error) {
    console.error('[loadGalleryWorks] fetch failed', { galleryProfileId, offset: start, error });
    return { artworks: [], error: 'Could not load more works' };
  }
  return { artworks: (data ?? []) as ArtworkCardArtwork[] };
}
