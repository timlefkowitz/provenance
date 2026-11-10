'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { USER_ROLES } from '~/lib/user-roles';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';

import { asUntyped } from '~/lib/supabase-untyped';
import type { UserProfile } from './get-user-profiles';

export interface CreateManagedArtistInput {
  /** The artist's name, printed on every Certificate of Authenticity */
  artistName: string;
  /** Optional now; required later to send the handoff invite */
  artistEmail?: string;
}

export type CreateManagedArtistResult =
  | { success: true; profile: UserProfile }
  | { success: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create an artist profile the current user manages for an artist who isn't on Provenance
 * (an artist manager, studio assistant, estate). Works posted into it are Certificates of
 * Authenticity, not tied to a gallery or collector, and wait for the artist to accept them.
 *
 * The row has user_id = null like other unclaimed artist profiles, so it never collides with
 * the manager's own artist profile; created_by_gallery_id records the manager. Inserted with
 * the service role because the user_profiles insert policy only allows galleries to create
 * unclaimed artist rows.
 */
export async function createManagedArtist(
  input: CreateManagedArtistInput,
): Promise<CreateManagedArtistResult> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in to add an artist' };
  }

  const artistName = input.artistName?.trim() ?? '';
  if (!artistName) {
    return { success: false, error: "Enter the artist's name" };
  }
  if (containsObjectionableText(artistName)) {
    return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };
  }

  const rawEmail = input.artistEmail?.trim() ?? '';
  if (rawEmail && !EMAIL_PATTERN.test(rawEmail)) {
    return { success: false, error: 'Enter a valid email for the artist' };
  }
  const artistEmail = rawEmail ? normalizeInviteEmail(rawEmail) : null;
  if (artistEmail && user.email && normalizeInviteEmail(user.email) === artistEmail) {
    return { success: false, error: 'This is your own email. Post as yourself in Artist mode instead.' };
  }

  console.log('[Profiles] createManagedArtist', { hasEmail: Boolean(artistEmail) });

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data, error } = await admin
    .from('user_profiles')
    .insert({
      user_id: null,
      role: USER_ROLES.ARTIST,
      name: artistName,
      is_claimed: false,
      is_active: true,
      created_by_gallery_id: user.id,
      managed_for_name: artistName,
      managed_for_email: artistEmail,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[Profiles] createManagedArtist failed', error);
    return { success: false, error: error?.message || 'Failed to add the artist' };
  }

  revalidatePath('/profiles');
  revalidatePath('/artworks/add');

  return { success: true, profile: data as UserProfile };
}
