'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { AI_CONSENT_POLICY_VERSION, hasAiConsent } from '~/lib/ai-consent';

export async function getAiConsentStatus(): Promise<{ signedIn: boolean; consented: boolean }> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { signedIn: false, consented: false };
  return { signedIn: true, consented: await hasAiConsent(user.id) };
}

export async function setAiConsent(consented: boolean): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { success: false, error: 'unauthenticated' };

  const now = new Date().toISOString();
  const { error } = await asUntyped(client)
    .from('ai_data_consents')
    .upsert(
      {
        user_id: user.id,
        consented,
        policy_version: AI_CONSENT_POLICY_VERSION,
        updated_at: now,
        ...(consented ? { consented_at: now, revoked_at: null } : { revoked_at: now }),
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[AiConsent] setAiConsent failed', { userId: user.id, consented, error });
    return { success: false, error: error.message };
  }
  console.log('[AiConsent] setAiConsent', { userId: user.id, consented });
  return { success: true };
}
