'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';
import { logger } from '~/lib/logger';
import { sendNotificationEmail } from '~/lib/email';
import { asUntyped } from '~/lib/supabase-untyped';
import { TEAM_PROFILE_ROLES, USER_ROLES } from '~/lib/user-roles';

export interface GalleryMember {
  id: string;
  gallery_profile_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string | null;
    name: string | null;
    picture_url: string | null;
  };
  gallery_profile?: {
    id: string;
    name: string;
  };
}

/**
 * Check if a user is a member of a gallery profile
 */
export async function isGalleryMember(
  userId: string,
  galleryProfileId: string
): Promise<boolean> {
  const client = asUntyped(getSupabaseServerClient());
  
  const { data, error } = await client
    .from('gallery_members')
    .select('id')
    .eq('gallery_profile_id', galleryProfileId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

/**
 * Check if a user can manage a gallery (owner or admin)
 */
export async function canManageGallery(
  userId: string,
  galleryProfileId: string
): Promise<boolean> {
  const client = asUntyped(getSupabaseServerClient());
  
  // Check if user is the gallery / institution profile owner
  const { data: profile } = await client
    .from('user_profiles')
    .select('user_id')
    .eq('id', galleryProfileId)
    .in('role', [...TEAM_PROFILE_ROLES])
    .single();

  if (profile?.user_id === userId) {
    return true;
  }

  // Check if user is a member with owner or admin role
  const { data: member } = await client
    .from('gallery_members')
    .select('role')
    .eq('gallery_profile_id', galleryProfileId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .single();

  return !!member;
}

/**
 * Artwork-like shape for permission checks (account_id and optional gallery_profile_id).
 */
export interface ArtworkForPermission {
  account_id: string;
  gallery_profile_id?: string | null;
}

/**
 * Check if a user can edit/delete an artwork (owner or any gallery team member for that gallery).
 * Use this in server actions that update or delete artworks and certificates.
 */
export async function canEditGalleryArtworks(
  userId: string,
  artwork: ArtworkForPermission
): Promise<boolean> {
  if (artwork.account_id === userId) {
    return true;
  }
  if (artwork.gallery_profile_id) {
    return isGalleryMember(userId, artwork.gallery_profile_id);
  }
  return false;
}

/**
 * Check if a user can manage an exhibition (gallery account owner or any gallery team member for that account).
 * exhibitionGalleryId is the gallery account id (exhibitions.gallery_id).
 */
export async function canManageExhibition(
  userId: string,
  exhibitionGalleryId: string
): Promise<boolean> {
  if (exhibitionGalleryId === userId) {
    return true;
  }
  const client = asUntyped(getSupabaseServerClient());
  const { data: profiles } = await client
    .from('user_profiles')
    .select('id')
    .eq('user_id', exhibitionGalleryId)
    .in('role', [...TEAM_PROFILE_ROLES]);

  if (!profiles?.length) {
    return false;
  }

  for (const p of profiles) {
    const member = await isGalleryMember(userId, p.id);
    if (member) return true;
  }
  return false;
}

/**
 * Get all members of a gallery profile
 */
export async function getGalleryMembers(
  galleryProfileId: string
): Promise<{ data: GalleryMember[] | null; error: string | null }> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { data: null, error: 'Unauthorized' };
    }

    // Verify user can view members (owner, admin, or member)
    const canView = await canManageGallery(user.id, galleryProfileId) ||
                    await isGalleryMember(user.id, galleryProfileId);

    if (!canView) {
      // Also check if user is the gallery profile owner
      const { data: profile } = await client
        .from('user_profiles')
        .select('user_id')
        .eq('id', galleryProfileId)
        .single();

      if (profile?.user_id !== user.id) {
        return { data: null, error: 'You do not have permission to view members' };
      }
    }

    const { data: members, error } = await client
      .from('gallery_members')
      .select('*')
      .eq('gallery_profile_id', galleryProfileId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('get_gallery_members_query_failed', {
        galleryProfileId,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return { data: null, error: error.message };
    }

    const memberRows = members || [];

    // Fetch account info for all member user_ids in a single query
    const userIds = Array.from(
      new Set(
        memberRows
          .map((m: Record<string, unknown>) => m.user_id)
          .filter((id: unknown): id is string => typeof id === 'string'),
      ),
    );

    let accountsById: Record<string, { id: string; email: string | null; name: string | null; picture_url: string | null }> =
      {};

    if (userIds.length > 0) {
      const { data: accounts, error: accountsError } = await client
        .from('accounts')
        .select('id, email, name, picture_url')
        .in('id', userIds);

      if (accountsError) {
        logger.error('get_gallery_members_accounts_query_failed', {
          galleryProfileId,
          message: accountsError.message,
          code: accountsError.code,
          details: accountsError.details,
        });
      } else if (accounts) {
        accountsById = (accounts as Record<string, unknown>[]).reduce<typeof accountsById>((acc, account) => {
          acc[account.id as string] = account as (typeof accountsById)[string];
          return acc;
        }, {});
      }
    }

    // Transform the data to match our interface
    const transformedMembers: GalleryMember[] = memberRows.map((member: any) => {
      const account = accountsById[member.user_id];

      return {
        id: member.id,
        gallery_profile_id: member.gallery_profile_id,
        user_id: member.user_id,
        role: member.role,
        invited_by: member.invited_by,
        invited_at: member.invited_at,
        joined_at: member.joined_at,
        created_at: member.created_at,
        updated_at: member.updated_at,
        user: account
          ? {
              id: account.id,
              email: account.email,
              name: account.name,
              picture_url: account.picture_url,
            }
          : undefined,
      };
    });

    return { data: transformedMembers, error: null };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('get_gallery_members_exception', {
      galleryProfileId,
      message: err.message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { data: null, error: err.message || 'An unexpected error occurred' };
  }
}

/**
 * Invite a user to join a gallery by email
 */
export async function inviteGalleryMember(
  galleryProfileId: string,
  email: string,
  role: 'admin' | 'member' = 'member'
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify user can invite members (owner or admin)
    const canInvite = await canManageGallery(user.id, galleryProfileId);
    if (!canInvite) {
      return { success: false, error: 'You do not have permission to invite members' };
    }

    // Verify gallery / institution profile exists
    const { data: profile, error: profileError } = await client
      .from('user_profiles')
      .select('id, name, user_id, role')
      .eq('id', galleryProfileId)
      .in('role', [...TEAM_PROFILE_ROLES])
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Gallery profile not found' };
    }

    const isInstitution = profile.role === USER_ROLES.INSTITUTION;
    const entity = isInstitution ? 'institution' : 'gallery';
    const modeLabel = isInstitution ? 'Institution' : 'Gallery';

    // Find user by email
    const { data: invitedUser, error: userError } = await client
      .from('accounts')
      .select('id, email, name')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !invitedUser) {
      return { success: false, error: "That email doesn't have a Provenance account yet" };
    }

    // Check if user is already a member
    const { data: existingMember } = await client
      .from('gallery_members')
      .select('id')
      .eq('gallery_profile_id', galleryProfileId)
      .eq('user_id', invitedUser.id)
      .single();

    if (existingMember) {
      return { success: false, error: `User is already a member of this ${entity}` };
    }

    // Create membership
    const { error: insertError } = await client
      .from('gallery_members')
      .insert({
        gallery_profile_id: galleryProfileId,
        user_id: invitedUser.id,
        role: role,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        joined_at: new Date().toISOString(), // Auto-join for now (can add invitation flow later)
      });

    if (insertError) {
      console.error('Error inviting member:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log('[Notifications] creating gallery_team_invite notification', {
      userId: invitedUser.id,
      galleryProfileId,
      role,
    });
    // Send notification to invited user
    try {
      await createNotification({
        userId: invitedUser.id,
        type: 'gallery_team_invite',
        title: `You were added to ${profile.name}`,
        message: `You have been added as a ${role} to the ${entity} "${profile.name}". Switch to ${modeLabel} mode to manage exhibitions and certificates.`,
        metadata: { galleryProfileId, role, galleryName: profile.name, profileRole: profile.role },
      });
      console.log('[Notifications] gallery_team_invite created', { userId: invitedUser.id, galleryProfileId });
    } catch (notifError) {
      console.error('[Notifications] Error creating gallery_team_invite notification:', notifError);
      // Don't fail the invitation if notification fails
    }

    // Send provenance email to invited user (notification type)
    if (invitedUser.email) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
      sendNotificationEmail(
        invitedUser.email,
        invitedUser.name || invitedUser.email.split('@')[0] || 'there',
        `You've been added to ${isInstitution ? 'an institution' : 'a gallery'} on Provenance`,
        {
          title: `You've been added to ${isInstitution ? 'an institution' : 'a gallery'}`,
          body: `You have been added as a ${role} to the ${entity} "${profile.name}". You can now manage collections, post Certificates of Show, and manage exhibitions for this ${entity}.`,
          ctaUrl: `${siteUrl}/profiles`,
          ctaLabel: isInstitution ? 'View institutions' : 'View galleries',
        }
      ).catch((emailError) => {
        console.error('Error sending gallery invite email:', emailError);
      });
    }

    revalidatePath(`/profiles`);
    revalidatePath(`/artists/${profile.user_id}?role=${profile.role}&profileId=${galleryProfileId}`);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in inviteGalleryMember:', error);
    return { success: false, error: (error as Error).message || 'An unexpected error occurred' };
  }
}

/**
 * Remove a member from a gallery
 */
export async function removeGalleryMember(
  galleryProfileId: string,
  memberUserId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify user can remove members (owner or admin) or user is removing themselves
    const canRemove = await canManageGallery(user.id, galleryProfileId);
    const isRemovingSelf = user.id === memberUserId;

    if (!canRemove && !isRemovingSelf) {
      return { success: false, error: 'You do not have permission to remove members' };
    }

    // Get member info before removing
    const { data: member } = await client
      .from('gallery_members')
      .select('role')
      .eq('gallery_profile_id', galleryProfileId)
      .eq('user_id', memberUserId)
      .single();

    if (!member) {
      return { success: false, error: 'Member not found' };
    }

    // Prevent removing the last owner, including the last owner leaving
    if (member.role === 'owner') {
      const { data: owners } = await client
        .from('gallery_members')
        .select('id')
        .eq('gallery_profile_id', galleryProfileId)
        .eq('role', 'owner');

      if (owners && owners.length <= 1) {
        console.log('[Team] blocked removing last owner', { galleryProfileId, memberUserId, isRemovingSelf });
        return { success: false, error: 'Cannot remove the last owner. Transfer ownership first.' };
      }
    }

    // Remove membership
    const { error: deleteError } = await client
      .from('gallery_members')
      .delete()
      .eq('gallery_profile_id', galleryProfileId)
      .eq('user_id', memberUserId);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return { success: false, error: deleteError.message };
    }

    // Get gallery profile info for revalidation
    const { data: profile } = await client
      .from('user_profiles')
      .select('user_id, role')
      .eq('id', galleryProfileId)
      .single();

    revalidatePath(`/profiles`);
    if (profile) {
      revalidatePath(`/artists/${profile.user_id}?role=${profile.role}&profileId=${galleryProfileId}`);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in removeGalleryMember:', error);
    return { success: false, error: (error as Error).message || 'An unexpected error occurred' };
  }
}

/**
 * Update a member's role
 */
export async function updateGalleryMemberRole(
  galleryProfileId: string,
  memberUserId: string,
  newRole: 'owner' | 'admin' | 'member'
): Promise<{ success: boolean; error: string | null }> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Owners and admins can change roles between member and admin
    const canUpdate = await canManageGallery(user.id, galleryProfileId);
    if (!canUpdate) {
      return { success: false, error: 'You do not have permission to update member roles' };
    }

    const { data: currentMember } = await client
      .from('gallery_members')
      .select('role')
      .eq('gallery_profile_id', galleryProfileId)
      .eq('user_id', memberUserId)
      .single();

    if (!currentMember) {
      return { success: false, error: 'Member not found' };
    }

    // Only owners (or the profile creator) can grant or remove owner
    if (newRole === 'owner' || currentMember.role === 'owner') {
      const { data: callerMember } = await client
        .from('gallery_members')
        .select('role')
        .eq('gallery_profile_id', galleryProfileId)
        .eq('user_id', user.id)
        .maybeSingle();

      const { data: profile } = await client
        .from('user_profiles')
        .select('user_id')
        .eq('id', galleryProfileId)
        .single();

      if (callerMember?.role !== 'owner' && profile?.user_id !== user.id) {
        console.log('[Team] blocked owner change by non-owner', { galleryProfileId, memberUserId, newRole });
        return { success: false, error: 'Only owners can add or remove owners' };
      }
    }

    // If demoting an owner, ensure there's at least one other owner

    if (currentMember.role === 'owner' && newRole !== 'owner') {
      const { data: owners } = await client
        .from('gallery_members')
        .select('id')
        .eq('gallery_profile_id', galleryProfileId)
        .eq('role', 'owner');

      if (owners && owners.length <= 1) {
        return { success: false, error: 'Cannot demote the last owner. Transfer ownership first.' };
      }
    }

    // Update role
    const { error: updateError } = await client
      .from('gallery_members')
      .update({ role: newRole })
      .eq('gallery_profile_id', galleryProfileId)
      .eq('user_id', memberUserId);

    if (updateError) {
      console.error('Error updating member role:', updateError);
      return { success: false, error: updateError.message };
    }

    revalidatePath(`/profiles`);

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in updateGalleryMemberRole:', error);
    return { success: false, error: (error as Error).message || 'An unexpected error occurred' };
  }
}
