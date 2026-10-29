'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { USER_ROLES } from '~/lib/user-roles';
import { getInstitutionLockError } from '~/lib/institution-account-guard';
import { normalizeInviteEmail } from '~/lib/certificate-claims/tokens';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';

import { asUntyped } from '~/lib/supabase-untyped';
import type { UserProfile } from './get-user-profiles';

export interface CreateManagedCollectionInput {
  /** The real owner's name, shown on certificates */
  ownerName: string;
  /** Optional now; required later to send the handoff invite */
  ownerEmail?: string;
}

export type CreateManagedCollectionResult =
  | { success: true; profile: UserProfile }
  | { success: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create a collector profile the current user builds on someone else's behalf.
 * It stays unclaimed (is_claimed = false) under the creator until it is handed off.
 */
export async function createManagedCollection(
  input: CreateManagedCollectionInput,
): Promise<CreateManagedCollectionResult> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in to create a collection' };
  }

  const ownerName = input.ownerName?.trim() ?? '';
  if (!ownerName) {
    return { success: false, error: "Enter the owner's name" };
  }
  if (containsObjectionableText(ownerName)) {
    return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };
  }

  const rawEmail = input.ownerEmail?.trim() ?? '';
  if (rawEmail && !EMAIL_PATTERN.test(rawEmail)) {
    return { success: false, error: 'Enter a valid email for the owner' };
  }
  const ownerEmail = rawEmail ? normalizeInviteEmail(rawEmail) : null;
  if (ownerEmail && user.email && normalizeInviteEmail(user.email) === ownerEmail) {
    return { success: false, error: 'This is your own email. Use your own collector profile instead.' };
  }

  const lockError = await getInstitutionLockError(user.id, USER_ROLES.COLLECTOR);
  if (lockError) {
    return { success: false, error: lockError };
  }

  console.log('[Profiles] createManagedCollection', { hasEmail: Boolean(ownerEmail) });

  const { data, error } = await client
    .from('user_profiles')
    .insert({
      user_id: user.id,
      role: USER_ROLES.COLLECTOR,
      name: ownerName,
      is_claimed: false,
      managed_for_name: ownerName,
      managed_for_email: ownerEmail,
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[Profiles] createManagedCollection failed', error);
    return { success: false, error: error?.message || 'Failed to create the collection' };
  }

  revalidatePath('/profiles');
  revalidatePath('/artworks/add');

  return { success: true, profile: data as UserProfile };
}
