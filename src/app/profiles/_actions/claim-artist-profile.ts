'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';

/**
 * Claim an unclaimed artist profile
 * Artist requests to claim a profile that was created by a gallery
 */
export async function claimArtistProfile(profileId: string, message?: string) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in to claim a profile' };
    }

    // Verify user is an artist
    const { data: account } = await client
      .from('accounts')
      .select('id, public_data, name')
      .eq('id', user.id)
      .single();

    if (!account) {
      return { error: 'Account not found' };
    }

    const userRole = getUserRole(account.public_data as Record<string, any>);
    if (userRole !== USER_ROLES.ARTIST) {
      return { error: 'Only artists can claim artist profiles' };
    }

    // Check if profile exists and is unclaimed
    const { data: profile, error: profileError } = await client
      .from('user_profiles')
      .select('id, name, is_claimed, user_id, created_by_gallery_id')
      .eq('id', profileId)
      .eq('role', 'artist')
      .single();

    if (profileError || !profile) {
      return { error: 'Profile not found' };
    }

    if (profile.is_claimed || profile.user_id) {
      return { error: 'This profile has already been claimed' };
    }

    if (!profile.created_by_gallery_id) {
      return { error: 'This profile cannot be claimed (no gallery creator)' };
    }

    // Check if user already has an artist profile
    const { data: existingProfile } = await client
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'artist')
      .single();

    if (existingProfile) {
      return { error: 'You already have an artist profile. You can only claim if you don\'t have one yet.' };
    }

    // Check if there's already a pending claim for this profile by this artist
    const { data: existingClaim } = await client
      .from('artist_profile_claims')
      .select('id, status')
      .eq('profile_id', profileId)
      .eq('artist_user_id', user.id)
      .single();

    if (existingClaim) {
      if (existingClaim.status === 'pending') {
        return { error: 'You already have a pending claim for this profile' };
      }
      if (existingClaim.status === 'approved') {
        return { error: 'Your claim has already been approved' };
      }
      // If rejected, allow them to create a new claim
    }

    // Create claim request
    const { data: claim, error: claimError } = await client
      .from('artist_profile_claims')
      .insert({
        profile_id: profileId,
        artist_user_id: user.id,
        gallery_id: profile.created_by_gallery_id,
        status: 'pending',
        message: message?.trim() || null,
      })
      .select('id')
      .single();

    if (claimError) {
      console.error('Error creating claim:', claimError);
      return { error: claimError.message || 'Failed to create claim request' };
    }

    // Notify the gallery
    try {
      await createNotification({
        userId: profile.created_by_gallery_id,
        type: 'artist_profile_claim_request',
        title: `Artist Profile Claim Request: ${profile.name}`,
        message: `${account.name || 'An artist'} is requesting to claim the artist profile "${profile.name}". Please review and approve or reject the claim.`,
        relatedUserId: user.id,
        metadata: {
          profileId,
          claimId: claim.id,
          artistName: account.name,
          message: message?.trim() || null,
        },
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the claim if notification fails
    }

    revalidatePath('/registry');
    revalidatePath('/profile');

    return { success: true, claimId: claim.id };
  } catch (error) {
    console.error('Error in claimArtistProfile:', error);
    return { error: 'An unexpected error occurred' };
  }
}

