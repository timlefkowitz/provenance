'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { revalidatePath } from 'next/cache';

/**
 * Fix gallery name display for artworks uploaded today
 * Finds artworks created today by a gallery account and verifies they use the gallery profile name
 */
export async function fixGalleryNamesForToday(
  galleryAccountName: string,
  expectedGalleryProfileName: string
) {
  try {
    const client = getSupabaseServerAdminClient();
    
    // Find the gallery account
    const { data: galleryAccount } = await client
      .from('accounts')
      .select('id, name, public_data')
      .ilike('name', galleryAccountName.trim())
      .limit(1)
      .single();

    if (!galleryAccount) {
      return {
        success: false,
        error: `Gallery account "${galleryAccountName}" not found`,
        updatedCount: 0,
      };
    }

    const galleryRole = getUserRole(galleryAccount.public_data as Record<string, any>);
    if (galleryRole !== USER_ROLES.GALLERY) {
      return {
        success: false,
        error: `Account "${galleryAccountName}" is not a gallery`,
        updatedCount: 0,
      };
    }

    // First, try to find the FL!GHT profile by name for this account
    const { data: profilesByName } = await client
      .from('user_profiles')
      .select('*')
      .eq('user_id', galleryAccount.id)
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true)
      .ilike('name', expectedGalleryProfileName.trim());

    let galleryProfile = profilesByName && profilesByName.length > 0 ? profilesByName[0] : null;

    // If not found by name, get the first gallery profile
    if (!galleryProfile) {
      galleryProfile = await getUserProfileByRole(galleryAccount.id, USER_ROLES.GALLERY);
    }

    // Get all gallery profiles for this account
    const { data: allProfiles } = await client
      .from('user_profiles')
      .select('*')
      .eq('user_id', galleryAccount.id)
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    if (!galleryProfile) {
      return {
        success: false,
        error: `Gallery profile not found for account "${galleryAccountName}". Please create a gallery profile first.`,
        updatedCount: 0,
        galleryAccountId: galleryAccount.id,
        allProfiles: allProfiles || [],
      };
    }

    if (galleryProfile.name !== expectedGalleryProfileName) {
      return {
        success: false,
        error: `Gallery profile name is "${galleryProfile.name}", expected "${expectedGalleryProfileName}"`,
        updatedCount: 0,
        galleryAccountId: galleryAccount.id,
        profileId: galleryProfile.id,
        actualProfileName: galleryProfile.name,
        allProfiles: allProfiles || [],
        canFix: true,
      };
    }

    // Get today's date range (start of today to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();
    const todayEnd = new Date().toISOString();

    // Find all artworks created today by this gallery account
    const { data: artworks, error } = await client
      .from('artworks')
      .select('id, title, account_id, created_at')
      .eq('account_id', galleryAccount.id)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching artworks:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch artworks',
        updatedCount: 0,
      };
    }

    const artworkCount = artworks?.length || 0;

    // Revalidate certificate pages for all today's artworks to clear Next.js cache
    if (artworks && artworks.length > 0) {
      for (const artwork of artworks) {
        revalidatePath(`/artworks/${artwork.id}/certificate`);
      }
    }

    return {
      success: true,
      updatedCount: artworkCount,
      artworks: artworks || [],
      galleryAccountId: galleryAccount.id,
      galleryProfileId: galleryProfile.id,
      galleryProfileName: galleryProfile.name,
      message: `Found ${artworkCount} artwork(s) created today. Revalidated certificate pages - they will now display "${galleryProfile.name}" instead of "${galleryAccount.name}".`,
    };
  } catch (error) {
    console.error('Error in fixGalleryNamesForToday:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      updatedCount: 0,
    };
  }
}

/**
 * Update gallery profile name to the expected name
 */
export async function updateGalleryProfileName(
  profileId: string,
  newName: string
) {
  try {
    const client = getSupabaseServerAdminClient();
    
    const { data: updatedProfile, error } = await client
      .from('user_profiles')
      .update({ name: newName.trim() })
      .eq('id', profileId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating gallery profile:', error);
      return {
        success: false,
        error: error.message || 'Failed to update gallery profile',
      };
    }

    return {
      success: true,
      profile: updatedProfile,
      message: `Successfully updated gallery profile name to "${newName}"`,
    };
  } catch (error) {
    console.error('Error in updateGalleryProfileName:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

