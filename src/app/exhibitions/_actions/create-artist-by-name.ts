'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';

/**
 * Create a new artist account by name
 * This creates a minimal account entry for artists who aren't registered yet
 */
export async function createArtistByName(artistName: string) {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { error: 'Unauthorized', success: false };
    }

    // Verify user is a gallery
    const { data: account } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', user.id)
      .single();

    if (!account) {
      return { error: 'Account not found', success: false };
    }

    const userRole = getUserRole(account.public_data as Record<string, any>);
    if (userRole !== USER_ROLES.GALLERY) {
      return { error: 'Only galleries can create artists', success: false };
    }

    // Check if artist with this name already exists
    const { data: existing } = await client
      .from('accounts')
      .select('id, name, public_data')
      .ilike('name', artistName.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      const existingAccount = existing[0];
      const existingRole = getUserRole(existingAccount.public_data as Record<string, any>);
      
      if (existingRole === USER_ROLES.ARTIST) {
        // Artist already exists, return it
        return {
          success: true,
          artist: {
            id: existingAccount.id,
            name: existingAccount.name,
            picture_url: null,
          },
        };
      }
    }

    // Create a new account for the artist
    // We'll use the admin client to create an account without a user_id
    // This is a placeholder account that can be linked to a real user later
    const adminClient = getSupabaseServerAdminClient();

    const { data: newAccount, error: createError } = await adminClient
      .from('accounts')
      .insert({
        name: artistName.trim(),
        email: null,
        public_data: {
          role: USER_ROLES.ARTIST,
        },
      })
      .select('id, name')
      .single();

    if (createError || !newAccount) {
      console.error('Error creating artist account:', createError);
      return { error: 'Failed to create artist account', success: false };
    }

    return {
      success: true,
      artist: {
        id: newAccount.id,
        name: newAccount.name,
        picture_url: null,
      },
    };
  } catch (error) {
    console.error('Error in createArtistByName:', error);
    return { error: 'An unexpected error occurred', success: false };
  }
}

