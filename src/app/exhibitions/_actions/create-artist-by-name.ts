'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getUserRole, isTeamProfileRole, USER_ROLES } from '~/lib/user-roles';
import { captureCrmContacts } from '~/lib/crm/capture-contact';
import { escapeIlike } from '~/lib/escape-ilike';
import { normalizePersonName } from '~/lib/people/types';

import { asUntyped } from '~/lib/supabase-untyped';
/**
 * Create a new artist account by name
 * This creates a minimal account entry for artists who aren't registered yet
 */
export async function createArtistByName(artistName: string) {
  try {
    const client = asUntyped(getSupabaseServerClient());
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

    const userRole = getUserRole(account.public_data as Record<string, unknown>);
    if (!isTeamProfileRole(userRole)) {
      return { error: 'Only galleries and institutions can create artists', success: false };
    }

    // Reuse an artist account with the same name (ignoring case and spacing).
    const trimmedName = artistName.trim().replace(/\s+/g, ' ');
    const { data: existing } = await client
      .from('accounts')
      .select('id, name, picture_url, public_data')
      .ilike('name', escapeIlike(trimmedName))
      .limit(10);

    const existingArtist = (existing ?? []).find(
      (row: { name: string | null; public_data: unknown }) =>
        normalizePersonName(row.name) === normalizePersonName(trimmedName) &&
        getUserRole(row.public_data as Record<string, unknown>) === USER_ROLES.ARTIST,
    );
    if (existingArtist) {
      return {
        success: true,
        artist: {
          id: existingArtist.id as string,
          name: existingArtist.name as string,
          picture_url: (existingArtist.picture_url as string | null) ?? null,
        },
      };
    }

    // Create a new account for the artist
    // We'll use the admin client to create an account without a user_id
    // This is a placeholder account that can be linked to a real user later
    const adminClient = getSupabaseServerAdminClient();

    const { data: newAccount, error: createError } = await adminClient
      .from('accounts')
      .insert({
        name: trimmedName,
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

    await captureCrmContacts(user.id, [
      { name: newAccount.name, source: 'exhibition', notes: 'Participating artist' },
    ]);

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

