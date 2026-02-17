'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { createNotification } from '~/lib/notifications';

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
  const client = getSupabaseServerClient();
  
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
  const client = getSupabaseServerClient();
  
  // Check if user is the gallery profile owner
  const { data: profile } = await client
    .from('user_profiles')
    .select('user_id')
    .eq('id', galleryProfileId)
    .eq('role', 'gallery')
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
 * Get all members of a gallery profile
 */
export async function getGalleryMembers(
  galleryProfileId: string
): Promise<{ data: GalleryMember[] | null; error: string | null }> {
  try {
    const client = getSupabaseServerClient();
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
      .select(`
        *,
        user:accounts!gallery_members_user_id_fkey(
          id,
          name,
          email,
          picture_url
        )
      `)
      .eq('gallery_profile_id', galleryProfileId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching gallery members:', error);
      return { data: null, error: error.message };
    }

    // Transform the data to match our interface
    const transformedMembers: GalleryMember[] = (members || []).map((member: any) => ({
      id: member.id,
      gallery_profile_id: member.gallery_profile_id,
      user_id: member.user_id,
      role: member.role,
      invited_by: member.invited_by,
      invited_at: member.invited_at,
      joined_at: member.joined_at,
      created_at: member.created_at,
      updated_at: member.updated_at,
      user: member.user ? {
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        picture_url: member.user.picture_url,
      } : undefined,
    }));

    return { data: transformedMembers, error: null };
  } catch (error: any) {
    console.error('Error in getGalleryMembers:', error);
    return { data: null, error: error.message || 'An unexpected error occurred' };
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
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Verify user can invite members (owner or admin)
    const canInvite = await canManageGallery(user.id, galleryProfileId);
    if (!canInvite) {
      return { success: false, error: 'You do not have permission to invite members' };
    }

    // Verify gallery profile exists
    const { data: profile, error: profileError } = await client
      .from('user_profiles')
      .select('id, name, user_id')
      .eq('id', galleryProfileId)
      .eq('role', 'gallery')
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Gallery profile not found' };
    }

    // Find user by email
    const { data: invitedUser, error: userError } = await client
      .from('accounts')
      .select('id, email, name')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (userError || !invitedUser) {
      return { success: false, error: 'User with this email not found' };
    }

    // Check if user is already a member
    const { data: existingMember } = await client
      .from('gallery_members')
      .select('id')
      .eq('gallery_profile_id', galleryProfileId)
      .eq('user_id', invitedUser.id)
      .single();

    if (existingMember) {
      return { success: false, error: 'User is already a member of this gallery' };
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

    // Send notification to invited user
    try {
      await createNotification({
        userId: invitedUser.id,
        type: 'message',
        title: 'Gallery Invitation',
        message: `You have been added as a ${role} to the gallery "${profile.name}".`,
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the invitation if notification fails
    }

    revalidatePath(`/profiles`);
    revalidatePath(`/artists/${profile.user_id}?role=gallery&profileId=${galleryProfileId}`);

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error in inviteGalleryMember:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
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
    const client = getSupabaseServerClient();
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

    // Prevent removing the last owner
    if (member.role === 'owner' && !isRemovingSelf) {
      const { data: owners } = await client
        .from('gallery_members')
        .select('id')
        .eq('gallery_profile_id', galleryProfileId)
        .eq('role', 'owner');

      if (owners && owners.length <= 1) {
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
      .select('user_id')
      .eq('id', galleryProfileId)
      .single();

    revalidatePath(`/profiles`);
    if (profile) {
      revalidatePath(`/artists/${profile.user_id}?role=gallery&profileId=${galleryProfileId}`);
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error in removeGalleryMember:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
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
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    // Only owners can update roles
    const canUpdate = await canManageGallery(user.id, galleryProfileId);
    if (!canUpdate) {
      // Check if user is owner specifically
      const { data: member } = await client
        .from('gallery_members')
        .select('role')
        .eq('gallery_profile_id', galleryProfileId)
        .eq('user_id', user.id)
        .single();

      const { data: profile } = await client
        .from('user_profiles')
        .select('user_id')
        .eq('id', galleryProfileId)
        .single();

      if (member?.role !== 'owner' && profile?.user_id !== user.id) {
        return { success: false, error: 'Only owners can update member roles' };
      }
    }

    // If demoting an owner, ensure there's at least one other owner
    const { data: currentMember } = await client
      .from('gallery_members')
      .select('role')
      .eq('gallery_profile_id', galleryProfileId)
      .eq('user_id', memberUserId)
      .single();

    if (currentMember?.role === 'owner' && newRole !== 'owner') {
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
  } catch (error: any) {
    console.error('Error in updateGalleryMemberRole:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}
