'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

export type PendingClaim = {
  id: string;
  profile_id: string;
  artist_user_id: string;
  gallery_id: string;
  status: string;
  message: string | null;
  gallery_response: string | null;
  created_at: string;
  updated_at: string;
  profile: {
    id: string;
    name: string;
    medium: string | null;
  };
  artist: {
    id: string;
    name: string;
    picture_url: string | null;
  };
};

/**
 * Get pending artist profile claims for a gallery
 */
export async function getPendingClaims(galleryId: string): Promise<PendingClaim[]> {
  try {
    const client = getSupabaseServerClient();
    
    // Verify user is a gallery
    const { data: account } = await client
      .from('accounts')
      .select('id, public_data')
      .eq('id', galleryId)
      .single();

    if (!account) {
      return [];
    }

    const userRole = getUserRole(account.public_data as Record<string, any>);
    if (userRole !== USER_ROLES.GALLERY) {
      return [];
    }

    // Get all claims for profiles created by this gallery
    const { data: claims, error } = await client
      .from('artist_profile_claims')
      .select(`
        id,
        profile_id,
        artist_user_id,
        gallery_id,
        status,
        message,
        gallery_response,
        created_at,
        updated_at,
        profile:user_profiles!profile_id (
          id,
          name,
          medium
        )
      `)
      .eq('gallery_id', galleryId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching claims:', error);
      return [];
    }

    if (!claims || claims.length === 0) {
      return [];
    }

    // Get artist account information for each claim
    const artistIds = [...new Set(claims.map(c => c.artist_user_id))];
    const { data: artists } = await client
      .from('accounts')
      .select('id, name, picture_url')
      .in('id', artistIds);

    const artistMap = new Map(artists?.map(a => [a.id, a]) || []);

    // Combine data
    const pendingClaims: PendingClaim[] = claims.map((claim: any) => ({
      id: claim.id,
      profile_id: claim.profile_id,
      artist_user_id: claim.artist_user_id,
      gallery_id: claim.gallery_id,
      status: claim.status,
      message: claim.message,
      gallery_response: claim.gallery_response,
      created_at: claim.created_at,
      updated_at: claim.updated_at,
      profile: {
        id: claim.profile.id,
        name: claim.profile.name,
        medium: claim.profile.medium,
      },
      artist: {
        id: claim.artist_user_id,
        name: artistMap.get(claim.artist_user_id)?.name || 'Unknown Artist',
        picture_url: artistMap.get(claim.artist_user_id)?.picture_url || null,
      },
    }));

    return pendingClaims;
  } catch (error) {
    console.error('Error in getPendingClaims:', error);
    return [];
  }
}

/**
 * Get unclaimed artist profiles that an artist can claim
 */
export async function getUnclaimedProfiles(artistUserId: string) {
  try {
    const client = getSupabaseServerClient();
    
    // Verify user is an artist
    const { data: account } = await client
      .from('accounts')
      .select('id, public_data')
      .eq('id', artistUserId)
      .single();

    if (!account) {
      return [];
    }

    const userRole = getUserRole(account.public_data as Record<string, any>);
    if (userRole !== USER_ROLES.ARTIST) {
      return [];
    }

    // Check if artist already has a profile
    const { data: existingProfile } = await client
      .from('user_profiles')
      .select('id')
      .eq('user_id', artistUserId)
      .eq('role', 'artist')
      .single();

    if (existingProfile) {
      return []; // Artist already has a profile
    }

    // Get all unclaimed artist profiles
    const { data: profiles, error } = await client
      .from('user_profiles')
      .select(`
        id,
        name,
        medium,
        created_by_gallery_id,
        created_at,
        gallery:accounts!created_by_gallery_id (
          id,
          name
        )
      `)
      .eq('role', 'artist')
      .eq('is_claimed', false)
      .is('user_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching unclaimed profiles:', error);
      return [];
    }

    // Filter out profiles that already have a pending claim from this artist
    const { data: existingClaims } = await client
      .from('artist_profile_claims')
      .select('profile_id')
      .eq('artist_user_id', artistUserId)
      .in('status', ['pending', 'approved']);

    const claimedProfileIds = new Set(existingClaims?.map(c => c.profile_id) || []);

    const availableProfiles = (profiles || [])
      .filter((p: any) => !claimedProfileIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        medium: p.medium,
        created_by_gallery_id: p.created_by_gallery_id,
        created_at: p.created_at,
        gallery: p.gallery ? {
          id: p.gallery.id,
          name: p.gallery.name,
        } : null,
      }));

    return availableProfiles;
  } catch (error) {
    console.error('Error in getUnclaimedProfiles:', error);
    return [];
  }
}

