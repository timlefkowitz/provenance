import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';

/**
 * Explicit consent before personal data is sent to third-party AI
 * (App Store guideline 5.1.2(i); also GDPR-style consent on the web).
 *
 * Bump AI_CONSENT_POLICY_VERSION when the disclosure text in
 * ai-consent-provider.tsx materially changes (e.g. a new AI provider) so
 * everyone is asked again.
 */
export const AI_CONSENT_POLICY_VERSION = '2026-09-28';

/** Error code returned by AI endpoints/actions when consent is missing. */
export const AI_CONSENT_REQUIRED = 'ai_consent_required';

export const AI_CONSENT_REQUIRED_MESSAGE =
  'This feature uses AI. Allow AI features to continue (you can change this in Settings → Privacy).';

/**
 * Server-side check. Uses the admin client so it also works from cron jobs;
 * callers must pass a userId they have already authenticated.
 */
export async function hasAiConsent(userId: string): Promise<boolean> {
  const consented = await getAiConsentedUserIds([userId]);
  return consented.has(userId);
}

/** Batch variant for cron jobs (e.g. the weekly digest). */
export async function getAiConsentedUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  try {
    const admin = asUntyped(getSupabaseServerAdminClient());
    const { data, error } = await admin
      .from('ai_data_consents')
      .select('user_id')
      .in('user_id', userIds)
      .eq('consented', true)
      .eq('policy_version', AI_CONSENT_POLICY_VERSION);
    if (error) {
      console.error('[AiConsent] consent lookup failed', error);
      return new Set();
    }
    return new Set((data ?? []).map((r: { user_id: string }) => r.user_id));
  } catch (err) {
    // Fail closed: no consent record we can read means no AI.
    console.error('[AiConsent] consent lookup threw', err);
    return new Set();
  }
}
