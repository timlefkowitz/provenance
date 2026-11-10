'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  cancelProfileHandoff,
  sendProfileHandoffInvite,
  type DeclineHandoffResult,
  type SendHandoffResult,
} from '~/lib/profile-handoff/handoff';

/**
 * Send a managed collection, or a managed artist's certificates, to the person they belong to:
 * an existing account picked by search (in-app + email), or an email address.
 */
export async function sendProfileHandoff(
  profileId: string,
  to: { email?: string; recipientUserId?: string },
): Promise<SendHandoffResult> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }

  const { data: account } = await client.from('accounts').select('name').eq('id', user.id).maybeSingle();

  const result = await sendProfileHandoffInvite({
    builderId: user.id,
    builderEmail: user.email,
    builderName: (account?.name as string | undefined) ?? null,
    profileId,
    email: to.email,
    recipientUserId: to.recipientUserId,
  });

  if (result.success) {
    revalidatePath('/profiles');
  }
  return result;
}

/** Withdraw the live invite for a profile you manage (or clear a declined one). */
export async function cancelProfileHandoffInvite(profileId: string): Promise<DeclineHandoffResult> {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }
  const result = await cancelProfileHandoff(profileId, user.id);
  if (result.success) revalidatePath('/profiles');
  return result;
}
