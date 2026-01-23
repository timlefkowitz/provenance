'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { createNotification } from '~/lib/notifications';

/**
 * Approve or reject an artist profile claim
 * Gallery approves/rejects a claim request from an artist
 */
export async function approveArtistProfileClaim(
  claimId: string,
  approved: boolean,
  galleryResponse?: string
) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'You must be signed in' };
    }

    // Get the claim
    const { data: claim, error: claimError } = await client
      .from('artist_profile_claims')
      .select('id, profile_id, artist_user_id, gallery_id, status')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      return { error: 'Claim not found' };
    }

    // Verify user is the gallery that created the profile
    if (claim.gallery_id !== user.id) {
      return { error: 'You are not authorized to approve this claim' };
    }

    if (claim.status !== 'pending') {
      return { error: 'This claim has already been processed' };
    }

    // Verify user is a gallery
    const { data: account } = await client
      .from('accounts')
      .select('id, public_data, name')
      .eq('id', user.id)
      .single();

    if (!account) {
      return { error: 'Account not found' };
    }

    const userRole = getUserRole(account.public_data as Record<string, any>);
    if (userRole !== USER_ROLES.GALLERY) {
      return { error: 'Only galleries can approve artist profile claims' };
    }

    // Get the profile
    const { data: profile } = await client
      .from('user_profiles')
      .select('id, name, is_claimed, user_id')
      .eq('id', claim.profile_id)
      .single();

    if (!profile) {
      return { error: 'Profile not found' };
    }

    // Use admin client to update the claim and profile
    const adminClient = getSupabaseServerAdminClient();

    if (approved) {
      // Check if profile is still unclaimed
      if (profile.is_claimed || profile.user_id) {
        // Update claim status to rejected since profile was already claimed
        await adminClient
          .from('artist_profile_claims')
          .update({
            status: 'rejected',
            gallery_response: 'Profile has already been claimed by another artist',
            updated_at: new Date().toISOString(),
          })
          .eq('id', claimId);

        return { error: 'This profile has already been claimed by another artist' };
      }

      // Check if artist already has a profile
      const { data: existingProfile } = await adminClient
        .from('user_profiles')
        .select('id')
        .eq('user_id', claim.artist_user_id)
        .eq('role', 'artist')
        .single();

      if (existingProfile) {
        // Update claim status to rejected
        await adminClient
          .from('artist_profile_claims')
          .update({
            status: 'rejected',
            gallery_response: 'Artist already has an artist profile',
            updated_at: new Date().toISOString(),
          })
          .eq('id', claimId);

        return { error: 'This artist already has an artist profile' };
      }

      // Approve: Update claim status and link profile to artist
      await adminClient
        .from('artist_profile_claims')
        .update({
          status: 'approved',
          gallery_response: galleryResponse?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      // Link profile to artist user
      await adminClient
        .from('user_profiles')
        .update({
          user_id: claim.artist_user_id,
          is_claimed: true,
          claimed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.profile_id);

      // Notify the artist
      try {
        await createNotification({
          userId: claim.artist_user_id,
          type: 'artist_profile_claim_approved',
          title: `Profile Claim Approved: ${profile.name}`,
          message: `${account.name || 'A gallery'} has approved your claim for the artist profile "${profile.name}". The profile is now linked to your account.`,
          relatedUserId: user.id,
          metadata: {
            profileId: claim.profile_id,
            claimId: claim.id,
            galleryResponse: galleryResponse?.trim() || null,
          },
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }
    } else {
      // Reject: Update claim status
      await adminClient
        .from('artist_profile_claims')
        .update({
          status: 'rejected',
          gallery_response: galleryResponse?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      // Notify the artist
      try {
        await createNotification({
          userId: claim.artist_user_id,
          type: 'artist_profile_claim_rejected',
          title: `Profile Claim Rejected: ${profile.name}`,
          message: `${account.name || 'A gallery'} has rejected your claim for the artist profile "${profile.name}".`,
          relatedUserId: user.id,
          metadata: {
            profileId: claim.profile_id,
            claimId: claim.id,
            galleryResponse: galleryResponse?.trim() || null,
          },
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }
    }

    revalidatePath('/registry');
    revalidatePath('/profile');
    revalidatePath('/notifications');

    return { success: true };
  } catch (error) {
    console.error('Error in approveArtistProfileClaim:', error);
    return { error: 'An unexpected error occurred' };
  }
}

