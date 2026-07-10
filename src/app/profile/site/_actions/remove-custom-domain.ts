'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveSubscription } from '~/lib/subscription';

export type RemoveDomainResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Remove a custom domain from the user's creator site.
 * Requires an active subscription (same gate as attach).
 */
export async function removeCustomDomainAction(
  profileId: string,
): Promise<RemoveDomainResult> {
  console.log('[Sites] removeCustomDomainAction', { profileId });

  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  const client = getSupabaseServerClient();

  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const subscription = await getActiveSubscription(user.id);
  if (!subscription) {
    return {
      success: false,
      error: 'An active subscription is required to manage custom domains.',
    };
  }

  const { data: siteRow, error: siteErr } = await asUntyped(client)
    .from('profile_sites')
    .select('profile_id, custom_domain')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (siteErr || !siteRow) {
    return { success: false, error: 'Site not found.' };
  }

  if (!siteRow.custom_domain) {
    return { success: false, error: 'No custom domain is connected.' };
  }

  const { data: profile } = await asUntyped(client)
    .from('user_profiles')
    .select('user_id')
    .eq('id', profileId)
    .maybeSingle();

  if (!profile || profile.user_id !== user.id) {
    return { success: false, error: 'Profile not owned by you' };
  }

  const domain = siteRow.custom_domain as string;

  if (token && projectId) {
    const vercelRes = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!vercelRes.ok && vercelRes.status !== 404) {
      const body = await vercelRes.json().catch(() => ({}));
      console.error('[Sites] removeCustomDomainAction Vercel error', body);
    }
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await asUntyped(client)
    .from('profile_sites')
    .update({
      custom_domain: null,
      custom_domain_verified_at: null,
      updated_at: now,
    })
    .eq('profile_id', profileId);

  if (updateErr) {
    console.error('[Sites] removeCustomDomainAction DB update failed', updateErr);
    return { success: false, error: updateErr.message };
  }

  console.log('[Sites] removeCustomDomainAction succeeded', { profileId, domain });
  return { success: true };
}
