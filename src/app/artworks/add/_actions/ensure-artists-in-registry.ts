'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

/**
 * Ensure that artists are in the registry as unclaimed profiles
 * This is called to make sure past artists from galleries are available for claiming
 */
export async function ensureArtistsInRegistry(
  artistNames: string[],
  galleryId: string,
  medium?: string
) {
  try {
    const client = getSupabaseServerClient();
    
    // Verify user is a gallery
    const { data: account } = await client
      .from('accounts')
      .select('id, public_data')
      .eq('id', galleryId)
      .single();

    if (!account) {
      return { error: 'Account not found' };
    }

    const userRole = getUserRole(account.public_data as Record<string, any>);
    if (userRole !== USER_ROLES.GALLERY) {
      return { error: 'Only galleries can ensure artists in registry' };
    }

    const results = {
      created: 0,
      existing: 0,
      errors: [] as string[],
    };

    for (const artistName of artistNames) {
      if (!artistName || !artistName.trim()) {
        continue;
      }

      const trimmedName = artistName.trim();

      try {
        // Check if artist already has an account
        const { data: existingAccount } = await client
          .from('accounts')
          .select('id, public_data')
          .eq('name', trimmedName)
          .single();

        if (existingAccount) {
          const artistRole = getUserRole(existingAccount.public_data as Record<string, any>);
          if (artistRole === USER_ROLES.ARTIST) {
            // Artist already has an account, skip
            results.existing++;
            continue;
          }
        }

        // Check if unclaimed profile already exists
        const { data: existingProfile } = await client
          .from('user_profiles')
          .select('id')
          .eq('name', trimmedName)
          .eq('role', 'artist')
          .eq('is_claimed', false)
          .is('user_id', null)
          .single();

        if (existingProfile) {
          // Profile already exists, skip
          results.existing++;
          continue;
        }

        // Check if claimed profile exists
        const { data: claimedProfile } = await client
          .from('user_profiles')
          .select('id')
          .eq('name', trimmedName)
          .eq('role', 'artist')
          .eq('is_claimed', true)
          .single();

        if (claimedProfile) {
          // Profile already claimed, skip
          results.existing++;
          continue;
        }

        // Create unclaimed profile
        const { error: insertError } = await client
          .from('user_profiles')
          .insert({
            user_id: null, // Unclaimed profile
            role: 'artist',
            name: trimmedName,
            medium: medium?.trim() || null,
            is_claimed: false,
            created_by_gallery_id: galleryId,
            is_active: true,
          });

        if (insertError) {
          // Ignore duplicate key errors (race condition)
          if (insertError.code !== '23505') {
            console.error(`Error creating profile for ${trimmedName}:`, insertError);
            results.errors.push(`${trimmedName}: ${insertError.message}`);
          } else {
            results.existing++;
          }
        } else {
          results.created++;
        }
      } catch (error: any) {
        console.error(`Error processing artist ${trimmedName}:`, error);
        results.errors.push(`${trimmedName}: ${error.message || 'Unknown error'}`);
      }
    }

    return { success: true, ...results };
  } catch (error) {
    console.error('Error in ensureArtistsInRegistry:', error);
    return { error: 'An unexpected error occurred' };
  }
}

