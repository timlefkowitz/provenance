'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { logger } from '~/lib/logger';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  acceptProfileHandoffById,
  consumeProfileHandoff,
  declineProfileHandoffById,
  declineProfileHandoffByToken,
  type ConsumeHandoffResult,
  type DeclineHandoffResult,
} from '~/lib/profile-handoff/handoff';

function revalidateAfterHandoff() {
  revalidatePath('/profiles');
  revalidatePath('/profile');
  revalidatePath('/portal');
  revalidatePath('/notifications');
  revalidatePath('/registry');
}

async function signedInUser() {
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();
  return user;
}

/** Accept from the in-app inbox (no token needed; the invite must be for the signed-in user). */
export async function acceptProfileHandoffInvite(inviteId: string): Promise<ConsumeHandoffResult> {
  try {
    const user = await signedInUser();
    if (!user) return { success: false, error: 'Sign in to accept this invite' };
    const result = await acceptProfileHandoffById(inviteId, user);
    if (result.success) revalidateAfterHandoff();
    return result;
  } catch (error) {
    logger.error('accept_profile_handoff_by_id_failed', { error });
    return { success: false, error: 'Could not accept the invite' };
  }
}

/** Decline by invite id (inbox) or by token (email link). The works stay with whoever built them. */
export async function declineProfileHandoff(params: { inviteId?: string; token?: string }): Promise<DeclineHandoffResult> {
  try {
    const user = await signedInUser();
    if (!user) return { success: false, error: 'Sign in to decline this invite' };
    const result = params.inviteId
      ? await declineProfileHandoffById(params.inviteId, user)
      : await declineProfileHandoffByToken(params.token?.trim() ?? '', user);
    if (result.success) revalidatePath('/profiles');
    return result;
  } catch (error) {
    logger.error('decline_profile_handoff_failed', { error });
    return { success: false, error: 'Could not decline the invite' };
  }
}

export async function acceptProfileHandoff(token: string): Promise<ConsumeHandoffResult> {
  try {
    const client = asUntyped(getSupabaseServerClient());
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return { success: false, error: 'Sign in to accept this invite' };
    }

    const result = await consumeProfileHandoff(token?.trim() ?? '', user);
    if (result.success) revalidateAfterHandoff();
    return result;
  } catch (error) {
    logger.error('accept_profile_handoff_failed', { error });
    return { success: false, error: error instanceof Error ? error.message : 'Could not accept the invite' };
  }
}
