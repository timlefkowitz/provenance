'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

const APNS_TOKEN_PATTERN = /^[0-9a-f]{64,200}$/i;

/**
 * Ties this device's APNs token to the signed-in user. A token belongs to one
 * device, so re-registering after a different user signs in on it moves the
 * token to them.
 */
export async function registerPushDevice(token: string): Promise<{ success: boolean; error?: string }> {
  if (!APNS_TOKEN_PATTERN.test(token)) return { success: false, error: 'invalid_token' };

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { success: false, error: 'unauthenticated' };

  const now = new Date().toISOString();
  const { error } = await asUntyped(getSupabaseServerAdminClient())
    .from('push_devices')
    .upsert(
      { token, user_id: user.id, platform: 'ios', last_seen_at: now },
      { onConflict: 'token' },
    );

  if (error) {
    console.error('[Push] registerPushDevice failed', { userId: user.id, error });
    return { success: false, error: error.message };
  }
  console.log('[Push] device registered', { userId: user.id });
  return { success: true };
}

/**
 * Stops pushes to this device, e.g. after sign-out. Holding the token is the
 * proof of ownership, so this works without a session.
 */
export async function unregisterPushDevice(token: string): Promise<{ success: boolean }> {
  if (!APNS_TOKEN_PATTERN.test(token)) return { success: false };

  const { error } = await asUntyped(getSupabaseServerAdminClient())
    .from('push_devices')
    .delete()
    .eq('token', token);

  if (error) {
    console.error('[Push] unregisterPushDevice failed', error);
    return { success: false };
  }
  console.log('[Push] device unregistered');
  return { success: true };
}
